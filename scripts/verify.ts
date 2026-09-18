import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {digest,checkCode} from '../server/workspace';
const base='http://127.0.0.1:4317';
const health=await (await fetch(base+'/api/health')).json();assert.equal(health.app,'boss-office');
assert.equal((await fetch(base+'/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:'{"boss":"bad"}'})).status,403);
assert.equal((await fetch(base+'/api/settings',{method:'PATCH',headers:{'Content-Type':'application/json','X-Boss-Office':'local',Origin:'https://example.com'},body:'{"boss":"bad"}'})).status,403);
const data=await (await fetch(base+'/api/state')).json();assert.equal(typeof data.boss,'string');
assert(data.companies.length>0);
const receipt=JSON.parse(fs.readFileSync('docs/verification/live-dispatch.json','utf8'));
const tasks=receipt.ids.map((id:string)=>data.tasks.find((t:any)=>t.id===id));assert(tasks.every((t:any)=>t?.state==='done'),'兩個實際模型任務尚未全部完成');
assert.equal(tasks[0].model,'gpt-5.6-sol');assert.equal(tasks[1].model,'gpt-5.6-luna');assert(tasks[0].checks.every((c:any)=>c.passed));
assert(tasks[1].logs.some((l:any)=>Date.parse(l.at)>=Date.parse(tasks[0].doneAt)));
const artifacts=[];
for(const task of tasks)for(let i=0;i<task.files.length;i++){
 const f=task.files[i];const content=fs.readFileSync(path.join(health.outputRoot,f),'utf8');const response=await fetch(`${base}/api/download/${task.id}/${i}`);assert.equal(response.status,200);assert(response.headers.get('Content-Disposition')?.startsWith('attachment;'));assert.equal(digest(await response.text()),digest(content));assert(task.sources.some((s:any)=>s.ref===f&&s.sha256===digest(content)));artifacts.push({path:f,sha256:digest(content)});
}
const codePath=tasks[0].files.find((f:string)=>f.endsWith('/calculator.js'));const code=fs.readFileSync(path.join(health.outputRoot,codePath),'utf8');
const independent=await checkCode("const {add,divide}=require('calculator.js');assert(add(-2,5)===3);assert(divide(7,2)===3.5);let caught=false;try{divide(3,0)}catch(e){caught=e.name==='RangeError'}assert(caught);console.log('independent assertions passed')",{'calculator.js':code});assert(independent.passed);
const result={at:new Date().toISOString(),http:true,requestProtection:true,downloadAndSha256:true,realModels:tasks.map((t:any)=>({id:t.id,model:t.model,effort:t.effort,state:t.state,usage:t.usage,checks:t.checks})),dependencyHandoff:true,independent,artifacts};
fs.writeFileSync('docs/verification/runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
