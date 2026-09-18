import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {chromium} from '@playwright/test';
import {makeCompany,type Store,type Task,type Project} from '../src/domain/company';import {saveFile} from '../server/workspace';import {terminateOwnedProcess} from '../server/processControl';
const base=path.resolve('docs/verification/page-close-tests'),url='http://127.0.0.1:4320';fs.mkdirSync(base,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});const results:unknown[]=[];
const alive=(pid:number)=>{try{process.kill(pid,0);return true}catch{return false}};
async function api(p:string,method='GET',body?:unknown){const r=await fetch(url+'/api'+p,{method,headers:{'Content-Type':'application/json','X-Boss-Office':'local'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d}
try{for(const mode of ['close','timeout']){
 const folder=path.join(base,mode+'-'+Date.now()),data=path.join(folder,'state'),out=path.join(folder,'outputs');fs.mkdirSync(data,{recursive:true});
 const co=makeCompany('關頁與成果隔離驗收','studio',[{id:'gpt-5.6-luna',name:'Luna',efforts:['low'],defaultEffort:'low'}]);
 const task=(id:string,index:number):Task=>({id,companyId:co.id,employeeId:co.employees[index].id,title:'隔離測試程序 '+id,command:'測試',dependsOn:[],state:'queued',stage:'測試程序',model:'gpt-5.6-luna',effort:'low',createdAt:new Date().toISOString(),logs:[],files:[],sources:[],attempt:1,external:false});
 const published=task('published',1),p:Project={id:'finished-project',companyId:co.id,mode:'goal',title:'已完成的計數器（隔離測試）',goal:'製作計數器',status:'completed',managerId:co.employees[0].id,managerModel:'gpt-5.6-luna',managerEffort:'low',createdAt:new Date().toISOString(),authorizedBy:'測試老闆',calls:4,maxCalls:18,maxRevisions:2,assumptions:[],message:'已完成',delivery:{summary:'點一下就可以累加的計數器已做好。',howToUse:['按開啟成果','按加一，確認數字增加'],limitations:['資料只保留於目前頁面'],entryTaskId:published.id,entryPath:'index.html'}};
 published.state='done';published.projectId=p.id;published.kind='work';const file=`程式/${co.id}/${published.id}/v1/index.html`;const hash=saveFile(out,file,'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>計數器</title><h1>計數器</h1><button id="add">加一</button><output id="n">0</output><script>document.getElementById("add").onclick=()=>{document.getElementById("n").textContent=Number(document.getElementById("n").textContent)+1}</script></html>');published.files=[file];published.sources=[{kind:'file',ref:file,sha256:hash,at:new Date().toISOString()}];
 const state:Store={version:1,boss:'測試老闆',companies:[co],tasks:[task('worker-a',1),task('worker-b',2),published],projects:[p],paused:true,maxTasksPerDay:30,maxConcurrentTasks:2};fs.writeFileSync(path.join(data,'company.json'),JSON.stringify(state));
 const server=spawn(process.execPath,['--import','tsx','scripts/presence-fixture-service.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4320',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:out,BOSS_DISABLE_INFERENCE:'1'},windowsHide:true});server.stdout?.resume();server.stderr?.resume();
 const context=await browser.newContext({viewport:{width:1440,height:1000}});try{
  for(let i=0;i<60;i++){try{if((await fetch(url+'/api/health')).ok&&fs.existsSync(path.join(data,'worker-b-pids.json')))break}catch{}await new Promise(r=>setTimeout(r,250))}
  const pids=['worker-a','worker-b'].flatMap(id=>Object.values(JSON.parse(fs.readFileSync(path.join(data,id+'-pids.json'),'utf8'))) as number[]);assert(pids.every(alive));
  const page=await context.newPage();await page.goto(url);await page.getByText('頁面連線中 · 關閉即全部停止',{exact:true}).waitFor();assert((await api('/state')).pageConnected);
  if(mode==='close'){
   await page.getByRole('button',{name:'開啟成果',exact:true}).click();const frame=page.frameLocator('iframe[title="已完成的作品"]');await frame.getByRole('button',{name:'加一',exact:true}).click();assert.equal(await frame.locator('output').innerText(),'1');assert.equal(await page.frames()[1].evaluate(()=>{try{return parent.document.title}catch{return 'blocked'}}),'blocked');await page.screenshot({path:'docs/screenshots/usable-delivery.png',fullPage:true});await page.getByRole('dialog').getByRole('button',{name:'關閉',exact:true}).click();
   await page.getByRole('combobox',{name:'同時工作人數',exact:true}).selectOption('6');await page.getByRole('status').filter({hasText:'已更新同時工作人數'}).waitFor();assert.equal((await api('/state')).maxConcurrentTasks,6);
   await page.getByRole('textbox',{name:'老闆指令',exact:true}).fill('做一個可使用的待辦清單');await page.getByRole('button',{name:'開始製作',exact:true}).click();await page.getByRole('status').filter({hasText:'已交給主管'}).waitFor();const s=await api('/state');assert.equal(s.projects.at(-1).goal,'做一個可使用的待辦清單');assert.equal(s.projects.at(-1).calls,0);
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/delivery-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const second=await context.newPage();await second.goto(url);await second.getByText('頁面連線中 · 關閉即全部停止',{exact:true}).waitFor();
   // Drop the explicit beacon: closing the SSE connection must still stop every owned process.
   await page.evaluate(()=>{navigator.sendBeacon=()=>true});const started=Date.now();await page.close();
   for(let i=0;i<40&&pids.some(alive);i++)await new Promise(r=>setTimeout(r,200));assert(pids.every(id=>!alive(id)));const closed=await api('/state');assert(closed.paused);assert.equal(closed.tasks.find((t:any)=>t.id==='published').state,'done');assert(closed.tasks.filter((t:any)=>t.id!=='published').every((t:any)=>t.state==='cancelled'));assert.equal(closed.projects.at(-1).status,'stopped');assert(closed.pageCount>=1);
   results.push({mode,stopMs:Date.now()-started,explicitBeaconDropped:true,allFourOwnedProcessesStopped:true,anotherPageStillOpen:true,completedArtifactPreserved:true,oneClickTask:true,workingHtmlPreview:true,parentAccessBlocked:true});
  }else{
   await page.getByRole('button',{name:'恢復手動工作',exact:true}).click();await page.getByRole('button',{name:'恢復手動工作',exact:true}).waitFor({state:'hidden'});await page.route('**/api/presence/ack',route=>route.abort());const started=Date.now();for(let i=0;i<100&&pids.some(alive);i++)await new Promise(r=>setTimeout(r,200));assert(pids.every(id=>!alive(id)));assert((await api('/state')).paused);results.push({mode,stopMs:Date.now()-started,heartbeatLossStopsAllProcesses:true});
  }
 }finally{await context.close();await terminateOwnedProcess(server)}
}
fs.writeFileSync(path.join(base,'result.json'),JSON.stringify({at:new Date().toISOString(),noModelInference:true,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
