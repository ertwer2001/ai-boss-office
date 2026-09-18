import fs from 'node:fs';import assert from 'node:assert/strict';
const before=JSON.parse(fs.readFileSync('docs/verification/production-before-manager.json','utf8').replace(/^\uFEFF/,''));
const after=await (await fetch('http://127.0.0.1:4317/api/state')).json();
// PowerShell's snapshot serialization trims trailing fractional-second zeros; compare equal instants.
const canonical=(value:unknown)=>JSON.parse(JSON.stringify(value,(_key,v)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)?new Date(v).toISOString():v));
assert.deepEqual(canonical(after.tasks),canonical(before.tasks));assert.equal(after.boss,before.boss);
for(const c of after.companies){const {dispatchStatus,...stored}=c;assert.deepEqual(canonical(stored),canonical(before.companies.find((x:any)=>x.id===c.id)))}
const health=await (await fetch('http://127.0.0.1:4317/api/health')).json();assert.equal(health.version,'2.0.0');
const result={at:new Date().toISOString(),version:health.version,pid:health.pid,bossAndCompaniesPreserved:true,existingTasksPreserved:after.tasks.length,automaticEnabled:after.companies.filter((c:any)=>c.autoDispatch?.enabled).length,workingTasks:after.tasks.filter((t:any)=>t.state==='working').length,inferenceEnabled:health.inferenceEnabled};
fs.writeFileSync('docs/verification/production-manager.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
