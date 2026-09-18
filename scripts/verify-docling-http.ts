import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const port=Number(process.env.BOSS_PORT||4327),base=`http://127.0.0.1:${port}`;
const dataRoot=path.resolve(process.env.BOSS_DATA_DIR||'docs/verification/docling-tests/http-data');
const fixture=path.resolve('docs/verification/docling-tests/fixtures/phase2-sample.docx');
const jsonHeaders={'Content-Type':'application/json','X-Boss-Office':'local'};
const health=await (await fetch(base+'/api/health')).json() as any;
assert.equal(health.version,'2.6.0');assert.match(health.documentParsing,/local-only/);
const lease=await (await fetch(base+'/api/presence/open',{method:'POST',headers:jsonHeaders})).json() as any;
const headers={...jsonHeaders,'X-Boss-Page':lease.id,'X-Boss-Page-Token':lease.token};
const eventsAbort=new AbortController();const events=await fetch(`${base}/api/presence/events?id=${lease.id}&token=${lease.token}`,{signal:eventsAbort.signal});assert.equal(events.status,200);
try{
 const state=await (await fetch(base+'/api/state')).json() as any;assert.equal(state.companies.length,1);
 const response=await fetch(`${base}/api/companies/${state.companies[0].id}/documents/parse`,{method:'POST',headers,body:JSON.stringify({name:'phase2-sample.docx',base64:fs.readFileSync(fixture).toString('base64')})});
 const body=await response.json() as any;assert.equal(response.status,200,body.error);assert.equal(body.document.localOnly,true);assert.equal(body.document.parserVersion,'2.127.0');
 assert.match(body.document.originalRef,/^document-imports\/文件\//);assert.match(body.document.parsedRef,/^document-imports\/文件\//);
 const original=path.resolve(dataRoot,body.document.originalRef),parsed=path.resolve(dataRoot,body.document.parsedRef);assert(fs.existsSync(original));assert(fs.existsSync(parsed));
 assert(fs.existsSync(path.join(dataRoot,'document-imports','資料',state.companies[0].id,body.document.id,'result.json')));
 const digest=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(digest(original),body.document.originalSha256);assert.equal(digest(parsed),body.document.parsedSha256);assert.match(fs.readFileSync(parsed,'utf8'),/繁體中文/);
 const result={at:new Date().toISOString(),health,endpoint:true,localOnly:true,document:body.document,parsedContainsTraditionalChinese:true,noModelInference:process.env.BOSS_DISABLE_INFERENCE==='1'};
 fs.writeFileSync('docs/verification/docling-tests/http-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{
 eventsAbort.abort();
 await fetch(base+'/api/presence/close',{method:'POST',headers:jsonHeaders,body:JSON.stringify(lease)});
}
