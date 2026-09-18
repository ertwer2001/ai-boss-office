import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {makeCompany} from '../src/domain/company';import {terminateOwnedProcess} from '../server/processControl';
fs.mkdirSync('docs/verification/page-close-tests/shutdown',{recursive:true});const root=fs.mkdtempSync(path.resolve('docs/verification/page-close-tests/shutdown/case-')),data=path.join(root,'state');fs.mkdirSync(data,{recursive:true});
const co=makeCompany('服務退出隔離測試','studio',[]);const tasks=['worker-a','worker-b'].map((id,i)=>({id,companyId:co.id,employeeId:co.employees[i].id,title:'測試程序',command:'測試',dependsOn:[],state:'queued',stage:'測試',model:'test',effort:'low',createdAt:new Date().toISOString(),logs:[],files:[],sources:[],attempt:0,external:false}));
fs.writeFileSync(path.join(data,'company.json'),JSON.stringify({version:1,boss:'test',companies:[co],tasks,paused:true,maxTasksPerDay:30}));
const server=spawn(process.execPath,['--import','tsx','scripts/presence-fixture-service.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4320',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:path.join(root,'outputs'),BOSS_DISABLE_INFERENCE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});server.stdout?.resume();let errors='';server.stderr?.on('data',b=>{errors+=b});
const alive=(pid:number)=>{try{process.kill(pid,0);return true}catch{return false}};
try{
 for(let i=0;i<80;i++){if(fs.existsSync(path.join(data,'worker-b-pids.json'))){try{const h=await(await fetch('http://127.0.0.1:4320/api/health')).json();if(h.pid===server.pid)break}catch{}}await new Promise(r=>setTimeout(r,100))}
 const ids=['worker-a','worker-b'].flatMap(id=>Object.values(JSON.parse(fs.readFileSync(path.join(data,id+'-pids.json'),'utf8'))) as number[]);assert(ids.every(alive));const started=Date.now();server.send('verify-graceful-shutdown');
 for(let i=0;i<120&&server.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));assert.equal(server.exitCode,0,errors);assert(ids.every(pid=>!alive(pid)),'所有自有後代程序必須結束');const state=JSON.parse(fs.readFileSync(path.join(data,'company.json'),'utf8'));assert(state.paused);assert(state.tasks.every((t:any)=>t.state==='cancelled'));
 const result={at:new Date().toISOString(),noModelInference:true,actualServiceExit:true,allFourDescendantsStopped:true,pausedStatePersisted:true,stopMs:Date.now()-started};fs.writeFileSync('docs/verification/pro-service-shutdown.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await terminateOwnedProcess(server)}
