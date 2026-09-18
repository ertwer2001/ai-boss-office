// Opt-in: this script consumes Codex quota, with an isolated project capped at six model calls.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {makeCompany,type Store} from '../src/domain/company';import {terminateOwnedProcess} from '../server/processControl';import {digest} from '../server/workspace';
const folder=path.resolve('docs/verification/manager-live'),data=path.join(folder,'state'),output=path.join(folder,'outputs');fs.mkdirSync(data,{recursive:true});
const co=makeCompany('主管真實驗收室','studio',[{id:'gpt-5.6-luna',name:'Luna',efforts:['low'],defaultEffort:'low'}]);
const state:Store={version:1,boss:'測試老闆',companies:[co],tasks:[],paused:false,maxTasksPerDay:30};fs.writeFileSync(path.join(data,'company.json'),JSON.stringify(state));
const url='http://127.0.0.1:4319',server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4319',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:output,BOSS_DISABLE_INFERENCE:'0'},windowsHide:true});server.stdout?.resume();server.stderr?.resume();
async function api(p:string,method='GET',body?:unknown){const r=await fetch(url+'/api'+p,{method,headers:{'X-Boss-Office':'local','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d}
let projectId='';
try{
 for(let i=0;i<60;i++){try{if((await fetch(url+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
 const status=await api('/status');assert(status.models.some((m:any)=>m.id==='gpt-5.6-luna'));
 const goal='這是最小流程驗收，只安排一件內部文件工作，不要擴張需求。指定內容編輯使用 gpt-5.6-luna / low，製作 驗收說明.md，內文包含字串 MANAGER_REVIEW_OK，並用兩句繁體中文說明「主管 Review 通過後才交付；一般問題先請示主管」。不需市場資料、不需程式、不需其他文件。驗收標準只需核對指定字串與這兩項說明，這不是要求偽造測試紀錄。';
 const r=await api(`/companies/${co.id}/manager-projects`,'POST',{mode:'goal',goal,maxCalls:6,dailyLimit:1,intervalMinutes:30});projectId=r.project.id;
 let last='',final:any;
 for(let i=0;i<120;i++){
  const s=await api('/state'),p=s.projects.find((p:any)=>p.id===projectId);const step=s.tasks.find((t:any)=>t.state==='working');const text=`${p.status} | calls ${p.calls}/6 | ${step?.kind||p.message}`;if(text!==last){console.log(text);last=text}
  if(p.status==='completed'){final=s;break}
  if(['blocked','stopped'].includes(p.status))throw new Error(p.message+' '+s.tasks.map((t:any)=>t.error||'').join(' '));
  assert(p.calls<=6);assert(s.tasks.filter((t:any)=>t.kind==='work').every((t:any)=>t.files.length===0));
  await new Promise(r=>setTimeout(r,4000));
 }
 assert(final,'八分鐘內未完成，驗收停止');
 const p=final.projects[0],work=final.tasks.find((t:any)=>t.kind==='work'),reviews=final.tasks.filter((t:any)=>['review','final-review'].includes(t.kind));
 assert(reviews.length>=2);assert(reviews.every((t:any)=>t.reviews.at(-1).verdict==='pass'));
 assert(work.files.length>0);const index=work.files.findIndex((f:string)=>f.endsWith('/驗收說明.md'));assert(index>=0);
 const downloaded=await (await fetch(`${url}/api/download/${work.id}/${index}`)).text();assert(downloaded.includes('MANAGER_REVIEW_OK'));assert.equal(digest(downloaded),digest(fs.readFileSync(path.join(output,work.files[index]),'utf8')));
 const result={at:new Date().toISOString(),projectId:p.id,calls:p.calls,maxCalls:6,realCodex:true,plan:true,worker:true,stageReview:'pass',finalReview:'pass',noPublicationBeforeFinalPass:true,downloadHashVerified:true,usage:final.tasks.map((t:any)=>({kind:t.kind,model:t.model,effort:t.effort,usage:t.usage})),files:work.files};fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){fs.writeFileSync(path.join(folder,'failure.json'),JSON.stringify({at:new Date().toISOString(),message:(e as Error).message}));throw e}
finally{try{await api('/rest','POST',{})}catch{}await terminateOwnedProcess(server)}
