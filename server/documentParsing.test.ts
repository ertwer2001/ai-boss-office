import fs from 'node:fs';
import path from 'node:path';
import {beforeAll,describe,expect,it} from 'vitest';
import {decodeDocument,documentJobs,loadParsedDocument,MAX_DOCUMENT_BYTES,parseDocumentFile,stopDocumentJobs} from './documentParsing';

const projectRoot=path.resolve('.');
const casesRoot=path.resolve('docs/verification/docling-tests/cases');
const fixtures=path.resolve('docs/verification/docling-tests/fixtures');
beforeAll(()=>fs.mkdirSync(casesRoot,{recursive:true}));
const b64=(file:string)=>fs.readFileSync(path.join(fixtures,file)).toString('base64');
const dataRoot=(label:string)=>fs.mkdtempSync(path.join(casesRoot,label+'-'));

describe('本機文件解析',()=>{
 it('只接受符合副檔名與檔案標頭的 PDF／DOCX',()=>{
  expect(decodeDocument('sample.pdf',Buffer.from('%PDF-1.4\n').toString('base64')).format).toBe('pdf');
  expect(()=>decodeDocument('sample.pdf',Buffer.from('not pdf').toString('base64'))).toThrow('不是 PDF');
  expect(()=>decodeDocument('../sample.pdf',Buffer.from('%PDF-1.4\n').toString('base64'))).toThrow('名稱');
  expect(()=>decodeDocument('sample.exe',Buffer.from('MZ').toString('base64'))).toThrow('只接受');
  expect(()=>decodeDocument('large.pdf',Buffer.alloc(MAX_DOCUMENT_BYTES+1).toString('base64'))).toThrow('10 MB');
 });

 it('以離線 Docling 實際解析繁體中文 DOCX，並驗證來源雜湊',async()=>{
  const root=dataRoot('docx');
  const attachment=await parseDocumentFile({dataRoot:root,projectRoot,companyId:'company-a',name:'phase2-sample.docx',base64:b64('phase2-sample.docx'),isCurrent:()=>true});
  const loaded=loadParsedDocument(root,attachment.id,'company-a');
  expect(loaded.markdown).toContain('老闆辦公室文件解析測試');
  expect(loaded.attachment.localOnly).toBe(true);
  expect(()=>loadParsedDocument(root,attachment.id,'company-b')).toThrow('找不到');
  fs.appendFileSync(path.join(root,attachment.parsedRef),'tampered');
  expect(()=>loadParsedDocument(root,attachment.id,'company-a')).toThrow('校驗不符');
 },120000);

 it('以預先下載的本機模型實際解析數位 PDF',async()=>{
  const root=dataRoot('pdf');
  const attachment=await parseDocumentFile({dataRoot:root,projectRoot,companyId:'company-a',name:'phase2-sample.pdf',base64:b64('phase2-sample.pdf'),isCurrent:()=>true});
  const loaded=loadParsedDocument(root,attachment.id,'company-a');
  expect(loaded.markdown).toContain('Boss Office PDF document parsing test');
  expect(attachment.pages).toBe(1);
 },120000);

 it('頁面失去連線時終止解析程序並清除未完成資料',async()=>{
  const root=dataRoot('stop');let current=true;
  setTimeout(()=>{current=false},150);
  await expect(parseDocumentFile({dataRoot:root,projectRoot,companyId:'company-a',name:'phase2-sample.pdf',base64:b64('phase2-sample.pdf'),isCurrent:()=>current,command:{executable:process.execPath,script:path.resolve('tools/docling/delay_parser.js')},timeoutMs:5000})).rejects.toThrow('已終止');
  expect(documentJobs.size).toBe(0);
  expect(fs.existsSync(path.join(root,'document-imports'))?fs.readdirSync(path.join(root,'document-imports')):[]).toHaveLength(0);
 },10000);
 it('全部停止會終止仍連線頁面的解析程序',async()=>{
  const root=dataRoot('stop-all');
  const pending=parseDocumentFile({dataRoot:root,projectRoot,companyId:'company-a',name:'phase2-sample.pdf',base64:b64('phase2-sample.pdf'),isCurrent:()=>true,command:{executable:process.execPath,script:path.resolve('tools/docling/delay_parser.js')},timeoutMs:5000});
  const rejected=expect(pending).rejects.toThrow('老闆已停止工作');await new Promise(resolve=>setTimeout(resolve,100));await stopDocumentJobs();
  await rejected;expect(documentJobs.size).toBe(0);
 },10000);
});
