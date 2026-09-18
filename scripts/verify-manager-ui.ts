import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {chromium} from '@playwright/test';
import {makeCompany,type Store} from '../src/domain/company';import {terminateOwnedProcess} from '../server/processControl';
const folder=path.resolve('docs/verification/manager-ui'),data=path.join(folder,'state');fs.mkdirSync(data,{recursive:true});
const co=makeCompany('主管介面驗收','studio',[{id:'gpt-5.6-luna',name:'Luna',efforts:['low'],defaultEffort:'low'}]);
const state:Store={version:1,boss:'測試老闆',companies:[co],tasks:[],paused:false,maxTasksPerDay:30};fs.writeFileSync(path.join(data,'company.json'),JSON.stringify(state));
const url='http://127.0.0.1:4318',server=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4318',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:path.join(folder,'outputs'),BOSS_DISABLE_INFERENCE:'1'},windowsHide:true});server.stdout?.resume();server.stderr?.resume();
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
async function api(p:string,method='GET',body?:unknown){const r=await fetch(url+'/api'+p,{method,headers:{'X-Boss-Office':'local','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(d.error);return d}
try{
 for(let i=0;i<60;i++){try{if((await fetch(url+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
 assert.equal((await api('/health')).inferenceEnabled,false);
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await page.getByText('頁面連線中 · 關閉即全部停止',{exact:true}).waitFor();
 await page.getByRole('textbox',{name:'老闆指令',exact:true}).fill('設計一個有價值的 APP 原型與使用說明');
 await page.getByText('進階設定、工作範例與附檔',{exact:true}).click();await page.getByRole('button',{name:'調整這個目標的執行上限',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal((await api('/state')).projects,undefined);
 assert.equal(await page.getByRole('textbox',{name:'主管專案目標',exact:true}).inputValue(),'設計一個有價值的 APP 原型與使用說明');
 await page.screenshot({path:'docs/screenshots/manager-goal-order.png',fullPage:true});await page.getByRole('button',{name:'下令主管完成目標',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 let s=await api('/state');assert.equal(s.projects[0].mode,'goal');assert.equal(s.projects[0].goal,'設計一個有價值的 APP 原型與使用說明');assert.equal(s.tasks[0].kind,'plan');assert.equal(s.projects[0].calls,0);assert(!s.companies[0].autoDispatch.enabled);
 await page.getByRole('button',{name:'停止此專案／休息',exact:true}).click();await page.getByRole('main').getByText('已停止／休息，不會自動重跑',{exact:true}).waitFor();s=await api('/state');assert.equal(s.projects[0].status,'stopped');assert.equal(s.tasks[0].state,'cancelled');
 await page.getByRole('button',{name:'下令主管自主規畫…',exact:true}).click();assert.equal((await api('/state')).projects.length,1);await page.getByRole('button',{name:'啟動自主規畫與審查',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 s=await api('/state');assert.equal(s.projects[1].mode,'autonomous');assert.equal(s.companies[0].autoDispatch.version,2);assert(s.companies[0].autoDispatch.enabled);assert(s.projects.every((p:any)=>p.calls===0));
 await page.getByRole('button',{name:'全部停止／休息',exact:true}).click();await page.getByRole('button',{name:'恢復手動工作',exact:true}).waitFor();s=await api('/state');assert(s.paused);assert(s.projects.every((p:any)=>p.status==='stopped'));assert(s.tasks.every((t:any)=>t.state==='cancelled'));assert(!s.companies[0].autoDispatch.enabled);
 await page.getByRole('button',{name:'恢復手動工作',exact:true}).click();await page.getByRole('button',{name:'恢復手動工作',exact:true}).waitFor({state:'hidden'});s=await api('/state');assert(s.projects.every((p:any)=>p.status==='stopped'));
 await page.screenshot({path:'docs/screenshots/manager-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/screenshots/manager-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(errors.length,0);
 const result={at:new Date().toISOString(),goalPrefill:true,openingDialogDoesNotAuthorize:true,goalMode:true,autonomousMode:true,projectStop:true,globalStop:true,resumeDoesNotRestart:true,noModelInference:true,mobileOverflow:false,errors};fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await terminateOwnedProcess(server)}
