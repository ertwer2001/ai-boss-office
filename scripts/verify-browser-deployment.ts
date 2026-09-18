import fs from 'node:fs';import assert from 'node:assert/strict';
const url='http://127.0.0.1:4317';
const [health,state,html]=await Promise.all([fetch(url+'/api/health').then(r=>r.json()),fetch(url+'/api/state').then(r=>r.json()),fetch(url).then(r=>r.text())]);
const before=JSON.parse(fs.readFileSync('docs/verification/production-before-browser-update.json','utf8'));
assert.equal(health.version,'2.3.0');assert.equal(state.paused,true);assert(!state.tasks.some((t:any)=>t.state==='working'));
assert.deepEqual(state.tasks,before.tasks);assert.deepEqual(state.projects,before.projects);
assert.deepEqual(state.companies.map(({dispatchStatus,...c}:any)=>c),before.companies);
const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(x=>x[1]);assert(assets.some(x=>x.endsWith('.js')));
for(const a of assets){const r=await fetch(url+a);assert(r.ok,a);assert((await r.text()).length>100)}
const result={at:new Date().toISOString(),health,companies:state.companies.length,tasks:state.tasks.length,projects:state.projects.length,states:state.projects.map((p:any)=>({id:p.id,status:p.status,calls:p.calls})),allUserRecordsPreserved:true,paused:true,working:0,assets};
fs.writeFileSync('docs/verification/production-browser-update.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
