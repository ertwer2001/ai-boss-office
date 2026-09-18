import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from '@playwright/test';
import {makeCompany,type Project,type Store,type Task} from '../src/domain/company';

const stamp=new Date().toISOString().slice(0,10);
const fixtureRoot=path.resolve('docs/verification/working-simulation',String(Date.now()));
const dataRoot=path.join(fixtureRoot,'data');
const outputRoot=path.join(fixtureRoot,'outputs');
const evidencePath=path.resolve('docs/screenshots/ai-employees-working-simulation.png');
const deliveryDir=process.env.BOSS_SHOWCASE_DIR||path.resolve('docs/screenshots');
const deliveryPath=path.join(deliveryDir,`AI員工協作模擬-${stamp}.png`);
const port='4332';
const url=`http://127.0.0.1:${port}`;
fs.mkdirSync(dataRoot,{recursive:true});
fs.mkdirSync(path.dirname(evidencePath),{recursive:true});
fs.mkdirSync(deliveryDir,{recursive:true});

let models=[{id:'gpt-6-astra',name:'GPT-6 Astra',efforts:['low','medium','high'],defaultEffort:'medium'}];
try{
 const live=await (await fetch('http://127.0.0.1:4317/api/status')).json() as {models?:typeof models};
 if(live.models?.length)models=live.models;
}catch{}

const company=makeCompany('跨境貿易公司｜展示模式','ecommerce',models);
const project:Project={
 id:'simulation-project',companyId:company.id,mode:'goal',title:'Amazon × 義烏選品專案｜協作展示',
 goal:'展示多位 AI 員工同時進行市場研究、採購、成本、上架與主管審查',status:'running',
 managerId:company.employees[0].id,managerModel:company.employees[0].model,managerEffort:company.employees[0].effort,
 createdAt:new Date().toISOString(),authorizedBy:'老闆',calls:0,maxCalls:18,maxRevisions:2,
 assumptions:['本畫面為零推論展示資料','沒有執行採購、上架或外部操作'],
 message:'6 位員工協作中｜展示模式不呼叫模型',
 decisionLog:[{at:new Date().toISOString(),text:'展示主管已分配市場、採購、商品、客服、廣告與數據工作。'}]
};
const stages=[
 '主管正在整合選品條件與 Review 標準',
 '分析 Amazon 需求、競爭度與評論痛點',
 '整理候選商品標題、賣點與上架資料',
 '彙整顧客問題、退貨原因與客服對策',
 '試算廣告成本、轉換率與損益平衡點',
 '計算義烏採購、物流、FBA 與毛利'
];
const logs=[
 ['展示模式啟動：沒有呼叫任何模型','已將工作拆分給 6 位員工','正在檢查各部門交付條件'],
 ['讀取展示用市場資料','比較需求趨勢與競品密度','整理候選品風險'],
 ['建立 Listing 欄位清單','整理產品核心賣點','檢查描述一致性'],
 ['歸納常見客訴情境','建立回覆分級規則','整理退貨預防建議'],
 ['試算展示用廣告情境','比較不同轉換率','標示高風險假設'],
 ['整合採購與物流欄位','計算展示用落地成本','核對毛利公式']
];
const tasks:Task[]=company.employees.map((employee,index)=>({
 id:`simulation-task-${index+1}`,companyId:company.id,employeeId:employee.id,projectId:project.id,
 kind:index===0?'review':'work',title:stages[index],command:project.goal,dependsOn:[],state:'working',stage:stages[index],
 model:employee.model,effort:employee.effort,createdAt:new Date().toISOString(),
 logs:logs[index].map(text=>({at:new Date().toISOString(),text})),files:[],sources:[],attempt:1,external:false,
 acceptance:['清楚標示展示資料','不得宣稱已完成真實交易或市場調查']
}));
const state:Store={version:1,boss:'老闆',companies:[company],tasks,projects:[project],paused:false,maxTasksPerDay:30,maxConcurrentTasks:6};
fs.writeFileSync(path.join(dataRoot,'company.json'),JSON.stringify(state,null,2));

const dist=path.resolve('dist');
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const json=(response:http.ServerResponse,value:unknown)=>{response.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});response.end(JSON.stringify(value))};
const server=http.createServer((request,response)=>{
 const pathname=new URL(request.url||'/',url).pathname;
 if(pathname==='/api/state')return json(response,{...state,generation:1,outputRoot,pageConnected:true,pageCount:1});
 if(pathname==='/api/status')return json(response,{connected:true,models,quota:null});
 if(pathname==='/api/health')return json(response,{ok:true,app:'boss-office-simulation',inferenceEnabled:false});
 if(pathname==='/api/presence/open')return json(response,{id:'1'.repeat(32),token:'2'.repeat(48)});
 if(pathname==='/api/presence/ack'||pathname==='/api/presence/close')return json(response,{ok:true});
 if(pathname==='/api/presence/events'){
  response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});
  response.write('data: heartbeat\n\n');return;
 }
 const requested=pathname==='/'?'index.html':pathname.replace(/^\//,'');
 const file=path.resolve(dist,requested);
 if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404);response.end('Not found');return}
 response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(response);
});
await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(Number(port),'127.0.0.1',resolve)});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 const health=await (await fetch(url+'/api/health')).json() as {inferenceEnabled?:boolean};assert.equal(health.inferenceEnabled,false);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'no-preference'});
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(url);
 await page.getByText('頁面連線中 · 關閉即全部停止',{exact:true}).waitFor();
 await page.locator('.walker.typing').first().waitFor();
 assert.equal(await page.locator('.walker.typing').count(),6);
 await page.locator('.floor-wrap').scrollIntoViewIfNeeded();
 await page.waitForTimeout(900);
 await page.screenshot({path:evidencePath,fullPage:false});
 fs.copyFileSync(evidencePath,deliveryPath);
 assert.equal(errors.length,0);
 const liveState=await (await fetch(url+'/api/state')).json() as Store;
 assert.equal(liveState.tasks.filter(task=>task.state==='working').length,6);
 const result={at:new Date().toISOString(),simulation:true,noModelInference:true,workingEmployees:6,productionStateUntouched:true,evidencePath,deliveryPath,errors};
 fs.writeFileSync(path.join(fixtureRoot,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
}finally{
 await browser?.close();
 await new Promise<void>(resolve=>server.close(()=>resolve()));
}
