// Opt-in supplementary verification: reuse the real worker draft; at most TWO additional model calls.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {terminateOwnedProcess} from '../server/processControl';import {digest} from '../server/workspace';
const source=path.resolve('docs/verification/manager-live/state'),folder=path.resolve('docs/verification/manager-review-live'),data=path.join(folder,'state'),output=path.join(folder,'outputs');fs.mkdirSync(data,{recursive:true});
const state=JSON.parse(fs.readFileSync(path.join(source,'company.json'),'utf8')),project=state.projects[0],worker=state.tasks.find((t:any)=>t.kind==='work');assert.equal(project.calls,6);assert(worker.pendingFiles.length>0);
// A separate test fixture carries the preserved candidate. No live company is mutated or resumed.
project.status='blocked';project.maxCalls=8;project.managerModel='gpt-5.6-sol';project.managerEffort='low';project.message='等待追加兩道審查驗收';state.paused=false;
worker.state='approve';for(const t of state.tasks)if(t.kind==='review'){t.state='blocked';t.model='gpt-5.6-sol';t.effort='low';t.error='待補驗主管審查'};
for(const f of worker.pendingFiles){const destination=path.join(data,f.path);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(source,f.path),destination)}
fs.writeFileSync(path.join(data,'company.json'),JSON.stringify(state));
const url='http://127.0.0.1:4319',server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4319',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:output,BOSS_DISABLE_INFERENCE:'0'},windowsHide:true});server.stdout?.resume();server.stderr?.resume();
async function api(p:string,method='GET',body?:unknown){const r=await fetch(url+'/api'+p,{method,headers:{'X-Boss-Office':'local','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d}
try{
 for(let i=0;i<60;i++){try{if((await fetch(url+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
 // Resume only the review task via the same production endpoint, preserving the existing draft.
 // The persisted fixture is loaded once: use a failed review task for production resume routing.
 const status=await api('/state');assert.equal(status.projects[0].status,'blocked');
 // This script's fixture includes a blocked review, so resume runs review rather than remaking the employee draft.
 await api(`/projects/${project.id}/resume`,'POST',{answer:'僅審查既有草稿，不重做員工工作',maxCalls:8});
 let final:any,last='';for(let i=0;i<90;i++){const s=await api('/state'),p=s.projects[0];const text=`${p.status} | calls ${p.calls}/8`;if(text!==last){console.log(text);last=text}if(p.status==='completed'){final=s;break}if(p.status==='blocked')throw new Error(p.message);assert(p.calls<=8);await new Promise(r=>setTimeout(r,4000))}
 assert(final,'六分鐘內未完成');const w=final.tasks.find((t:any)=>t.kind==='work'),reviews=final.tasks.filter((t:any)=>['review','final-review'].includes(t.kind)&&t.state==='done');assert.equal(reviews.length,2);assert(reviews.every((t:any)=>t.reviews.at(-1).verdict==='pass'));assert.equal(w.attempt,worker.attempt);
 const i=w.files.findIndex((f:string)=>f.endsWith('/驗收說明.md'));assert(i>=0);const content=await (await fetch(`${url}/api/download/${w.id}/${i}`)).text();assert(content.includes('MANAGER_REVIEW_OK'));assert.equal(digest(content),digest(fs.readFileSync(path.join(output,w.files[i]),'utf8')));
 const result={at:new Date().toISOString(),source:'manager-live',additionalCalls:final.projects[0].calls-6,realCodex:true,reviewModel:'gpt-5.6-sol',stageReview:'pass',finalReview:'pass',workerNotRerun:true,downloadHashVerified:true,usage:reviews.map((t:any)=>({kind:t.kind,usage:t.usage})),files:w.files};fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}catch(e){fs.writeFileSync(path.join(folder,'failure.json'),JSON.stringify({message:(e as Error).message}));throw e}finally{try{await api('/rest','POST',{})}catch{}await terminateOwnedProcess(server)}
