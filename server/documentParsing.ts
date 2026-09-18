import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {z} from 'zod';
import type {DocumentAttachment} from '../src/domain/company';
import {terminateOwnedProcess} from './processControl';

export const MAX_DOCUMENT_BYTES=10*1024*1024;
export const MAX_DOCUMENT_CHARACTERS=80000;
const parserVersion='2.127.0';
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const storedSchema=z.object({
 id:z.string().regex(idPattern),companyId:z.string().min(1),name:z.string().min(1),format:z.enum(['pdf','docx']),
 originalRef:z.string(),originalSha256:z.string().regex(/^[a-f0-9]{64}$/),parsedRef:z.string(),parsedSha256:z.string().regex(/^[a-f0-9]{64}$/),
 characters:z.number().int().nonnegative(),pages:z.number().int().positive().optional(),parser:z.literal('Docling'),parserVersion:z.string(),localOnly:z.literal(true),limitations:z.array(z.string())
});
type StoredDocument=z.infer<typeof storedSchema>;
type ActiveJob={child:ChildProcess;companyId:string;folders:string[];reason?:string};
export const documentJobs=new Map<string,ActiveJob>();

const sha=(value:Buffer|string)=>crypto.createHash('sha256').update(value).digest('hex');
const relative=(value:string)=>value.replaceAll('\\','/');
function importRoot(dataRoot:string){return path.resolve(dataRoot,'document-imports')}
function safeJobFolders(dataRoot:string,id:string,companyId:string){
 if(!idPattern.test(id))throw new Error('文件識別碼不正確');if(!/^[a-z0-9_-]{1,100}$/i.test(companyId))throw new Error('公司識別碼不正確');
 const root=importRoot(dataRoot),documents=path.resolve(root,'文件',companyId,id),metadata=path.resolve(root,'資料',companyId,id);
 if(path.dirname(documents)!==path.resolve(root,'文件',companyId)||path.dirname(metadata)!==path.resolve(root,'資料',companyId))throw new Error('文件路徑不正確');
 return {root,documents,metadata};
}
function removeJobFolders(folders:{root:string;documents:string;metadata:string}){
 for(const folder of [folders.documents,folders.metadata])if(fs.existsSync(folder))fs.rmSync(folder,{recursive:true,force:true});
 for(const start of [path.dirname(folders.documents),path.dirname(folders.metadata)]){let current=start;while(current!==folders.root&&current.startsWith(folders.root+path.sep)&&fs.existsSync(current)&&!fs.readdirSync(current).length){fs.rmdirSync(current);current=path.dirname(current)}}
 if(fs.existsSync(folders.root)&&!fs.readdirSync(folders.root).length)fs.rmdirSync(folders.root);
}

export function decodeDocument(name:string,base64:string){
 const cleanName=path.basename(name).trim();
 if(!cleanName||cleanName!==name.trim()||cleanName.length>180||/[\u0000-\u001f]/.test(cleanName))throw new Error('文件名稱不正確');
 const ext=path.extname(cleanName).toLowerCase();
 if(!['.pdf','.docx'].includes(ext))throw new Error('只接受 PDF 或 DOCX 文件');
 if(base64.length>Math.ceil(MAX_DOCUMENT_BYTES/3)*4+4)throw new Error('文件超過 10 MB 上限');
 if(!base64||base64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw new Error('文件內容編碼不正確');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length>MAX_DOCUMENT_BYTES)throw new Error('文件超過 10 MB 上限');
 if(bytes.toString('base64').replace(/=+$/,'')!==base64.replace(/=+$/,''))throw new Error('文件內容編碼不正確');
 if(ext==='.pdf'&&bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw new Error('副檔名是 PDF，但檔案內容不是 PDF');
 if(ext==='.docx'&&(bytes[0]!==0x50||bytes[1]!==0x4b))throw new Error('副檔名是 DOCX，但檔案內容不是 DOCX');
 return {name:cleanName,format:ext.slice(1) as 'pdf'|'docx',bytes};
}

export interface ParseDocumentOptions {
 dataRoot:string;projectRoot:string;companyId:string;name:string;base64:string;isCurrent:()=>boolean;
 command?:{executable:string;script:string};timeoutMs?:number;
}

export async function parseDocumentFile(options:ParseDocumentOptions):Promise<DocumentAttachment>{
 if(!options.isCurrent())throw new Error('頁面已關閉，文件解析未啟動');
 const decoded=decodeDocument(options.name,options.base64),id=crypto.randomUUID(),folders=safeJobFolders(options.dataRoot,id,options.companyId);
 const original=path.join(folders.documents,`original.${decoded.format}`),parsed=path.join(folders.documents,'parsed.md'),rawMeta=path.join(folders.metadata,'parser-result.json');
 fs.mkdirSync(folders.documents,{recursive:true});fs.mkdirSync(folders.metadata,{recursive:true});fs.writeFileSync(original,decoded.bytes);
 const runtimeRoot=path.resolve(options.projectRoot,'..','runtime','docling'),parserFolder=path.join(runtimeRoot,'jobs',id),parserInput=path.join(parserFolder,`input.${decoded.format}`);
 fs.mkdirSync(parserFolder,{recursive:true});fs.copyFileSync(original,parserInput);
 const command=options.command??{executable:path.join(runtimeRoot,'venv','Scripts','python.exe'),script:path.join(options.projectRoot,'tools','docling','parse_document.py')};
 if(!fs.existsSync(command.executable)||!fs.existsSync(command.script)){removeJobFolders(folders);fs.rmSync(parserFolder,{recursive:true,force:true});throw new Error('Docling 本機執行環境尚未安裝完成')}
 const models=path.join(runtimeRoot,'models');
 const args=[command.script,'--input',parserInput,'--output',parsed,'--metadata',rawMeta,'--format',decoded.format,'--models',models];
 const child=spawn(command.executable,args,{cwd:options.projectRoot,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1',DOCLING_SERVE_ENABLE_REMOTE_SERVICES:'false'}});
 const job:ActiveJob={child,companyId:options.companyId,folders:[folders.documents,folders.metadata]};documentJobs.set(id,job);
 let stderr='';child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-12000)});
 try{
  await new Promise<void>((resolve,reject)=>{
   let settled=false,stopReason='';
   const finish=(error?:Error)=>{if(settled)return;settled=true;clearInterval(watch);clearTimeout(timeout);error?reject(error):resolve()};
   const watch=setInterval(()=>{if(!options.isCurrent()&&!stopReason){stopReason=job.reason='頁面已關閉或工作已停止，文件解析已終止';void terminateOwnedProcess(child).finally(()=>finish(new Error(stopReason)))}},250);
   const timeout=setTimeout(()=>{stopReason=job.reason='文件解析超過 5 分鐘，已停止';void terminateOwnedProcess(child).finally(()=>finish(new Error(stopReason)))},options.timeoutMs??300000);
   child.once('error',error=>finish(error));
   child.once('close',code=>{stopReason||=job.reason||'';finish(stopReason?new Error(stopReason):code===0?undefined:new Error((stderr.trim()||`Docling 結束碼 ${code}`).slice(-2000)))});
  });
  if(!options.isCurrent())throw new Error('頁面已關閉或工作已停止，文件解析已終止');
  if(!fs.existsSync(parsed)||!fs.existsSync(rawMeta))throw new Error('Docling 沒有產生完整的解析結果');
  const parserResult=z.object({status:z.literal('success'),characters:z.number().int().nonnegative(),pages:z.number().int().positive().nullable()}).parse(JSON.parse(fs.readFileSync(rawMeta,'utf8')));
  let markdown=fs.readFileSync(parsed,'utf8').trim();
  const limitations=['只在本機解析；不連接雲端服務','掃描型 PDF 暫不啟用 OCR','最多解析 200 頁'];
  if(markdown.length>MAX_DOCUMENT_CHARACTERS){markdown=markdown.slice(0,MAX_DOCUMENT_CHARACTERS)+'\n\n[系統註記：文件內容超過 80,000 字元，派工資料已在此截斷。]';limitations.push('派工文字超過 80,000 字元時會截斷')}
  fs.writeFileSync(parsed,markdown,'utf8');
  const originalRef=relative(path.relative(options.dataRoot,original)),parsedRef=relative(path.relative(options.dataRoot,parsed));
  const record:StoredDocument={id,companyId:options.companyId,name:decoded.name,format:decoded.format,originalRef,originalSha256:sha(decoded.bytes),parsedRef,parsedSha256:sha(markdown),characters:markdown.length,...(parserResult.pages?{pages:parserResult.pages}:{}),parser:'Docling',parserVersion,localOnly:true,limitations};
  fs.writeFileSync(path.join(folders.metadata,'result.json'),JSON.stringify(record,null,2),'utf8');
  const {companyId:_,...attachment}=record;return attachment;
 }catch(error){removeJobFolders(folders);throw error}
 finally{documentJobs.delete(id);if(fs.existsSync(parserFolder))fs.rmSync(parserFolder,{recursive:true,force:true})}
}

export function loadParsedDocument(dataRoot:string,id:string,companyId:string){
 const folders=safeJobFolders(dataRoot,id,companyId),recordPath=path.join(folders.metadata,'result.json');
 if(!fs.existsSync(recordPath))throw new Error('找不到已解析文件，請重新選取文件');
 const record=storedSchema.parse(JSON.parse(fs.readFileSync(recordPath,'utf8')));
 if(record.companyId!==companyId)throw new Error('此文件不屬於目前公司');
 const original=path.resolve(dataRoot,record.originalRef),parsed=path.resolve(dataRoot,record.parsedRef);
 if(path.dirname(original)!==folders.documents||path.dirname(parsed)!==folders.documents)throw new Error('文件來源路徑不正確');
 if(!fs.existsSync(original)||!fs.existsSync(parsed))throw new Error('文件來源已遺失，請重新選取文件');
 const markdown=fs.readFileSync(parsed,'utf8');
 if(sha(fs.readFileSync(original))!==record.originalSha256||sha(markdown)!==record.parsedSha256)throw new Error('文件內容校驗不符，請重新選取文件');
 const {companyId:_,...attachment}=record;return {attachment,markdown};
}

export async function stopDocumentJobs(companyId?:string){
 const targets=[...documentJobs.entries()].filter(([,job])=>!companyId||job.companyId===companyId);
 const results=await Promise.allSettled(targets.map(async([id,job])=>{job.reason='老闆已停止工作，文件解析已終止';await terminateOwnedProcess(job.child);documentJobs.delete(id);for(const folder of job.folders)if(fs.existsSync(folder))fs.rmSync(folder,{recursive:true,force:true})}));
 if(results.some(result=>result.status==='rejected'))throw new Error('部分文件解析程序停止尚未確認，請再次按總停止。');
}
