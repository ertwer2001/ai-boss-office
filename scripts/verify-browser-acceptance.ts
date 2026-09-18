import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {makeCompany,type Store,type Task} from '../src/domain/company';
import {browserContract} from '../server/browserContract';import {validateBrowser} from '../server/browserValidation';
import {createProject,runManager,projectWorks,advanceProjects,stopProject} from '../server/projects';
import {children} from '../server/runner';import {saveFile,digest} from '../server/workspace';import {terminateOwnedProcess} from '../server/processControl';
const root=path.resolve('docs/verification/browser-acceptance',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(root,{recursive:true});
const out=path.join(root,'outputs');const models=[{id:'fixture-model',name:'隔離固定回覆',efforts:['low'],defaultEffort:'low'}];
const s:Store={version:1,boss:'測試老闆',companies:[makeCompany('實作驗收室','studio',models)],tasks:[],paused:false,maxTasksPerDay:100};
const p=createProject(s,s.companies[0],models,'goal','製作一個加法 APP，空值要有錯誤提示');
const contract=browserContract.parse({entryStep:0,entryPath:'index.html',requirements:['輸入兩數取得正確加總','空值不得當成零'],scenarios:[
 {name:'2 加 3 等於 5',requirement:'輸入兩數取得正確加總',kind:'happy',steps:[{action:'fill',selector:'#a',value:'2'},{action:'fill',selector:'#b',value:'3'},{action:'click',selector:'#calc',value:''},{action:'text',selector:'#result',value:'5'}]},
 {name:'空值顯示必要提示',requirement:'空值不得當成零',kind:'edge',steps:[{action:'click',selector:'#calc',value:''},{action:'text',selector:'#error',value:'請輸入兩個數字'}]}
]});
const html=(code:string)=>`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>加法工具</title><h1>加法工具</h1><label>A <input id="a" type="number"></label><label>B <input id="b" type="number"></label><button id="calc">計算</button><output id="result"></output><p id="error"></p><script>document.getElementById('calc').onclick=()=>{${code}}</script></html>`;
const good=html(`const a=document.getElementById('a').value,b=document.getElementById('b').value;if(!a.trim()||!b.trim()){document.getElementById('error').textContent='請輸入兩個數字';return}document.getElementById('error').textContent='';document.getElementById('result').textContent=String(Number(a)+Number(b));`);
const evidence:Record<string,unknown>={at:new Date().toISOString(),noModelInference:true,scope:'Real owned Edge browser; model replies are fixed fixtures'};
const plan=s.tasks[0];plan.state='working';
await runManager(plan,s,models,root,out,()=>{},async()=>({decision:'proceed',title:'可操作加法工具',reason:'製作並驗證',assumptions:[],category:'none',question:'',browserContract:contract,steps:[{title:'製作加法工具',employeeId:s.companies[0].employees[1].id,model:models[0].id,effort:'low',acceptance:contract.requirements,dependsOn:[]}]}));
const worker=projectWorks(s,p)[0];
function draft(content:string){worker.attempt++;worker.state='approve';worker.result='固定測試草稿';worker.checks=[];const rel=`workspaces/${worker.id}/draft/v${worker.attempt}/index.html`;worker.pendingFiles=[{path:rel,sha256:saveFile(root,rel,content)}]}
async function review(){advanceProjects(s);const t=s.tasks.at(-1)!;t.state='working';const requirements=t.kind==='review'?worker.acceptance!:[`整案目標：${p.goal}`,`${worker.id}：所有階段驗收標準已通過且成果相容`];let invoked=false;
 await runManager(t,s,models,root,out,()=>{},async(_t,prompt)=>{invoked=true;if(t.kind==='final-review')assert(prompt.includes('Edge headless'));return {verdict:'pass',reason:'核對完成',evidence:requirements.map(criterion=>({criterion,passed:true,evidence:'測試 fixture 審查'})),guidance:'',category:'none',question:'',targetTaskId:worker.id,delivery:{summary:'輸入兩個數字就能加總；空白時會提示。',howToUse:['輸入 A 與 B，按計算。'],limitations:['離線單頁，關閉不保存資料。'],entryTaskId:worker.id,entryPath:'index.html'}}});return {task:t,invoked};}
// FAIL -> automatic rework, without wasting a final-review model call.
draft(html('throw new Error("按鈕壞掉")'));await review();const calls=p.calls;const failed=await review();assert.equal(failed.invoked,false);assert.equal(p.calls,calls);assert.equal(worker.state,'queued');assert.equal(worker.revisions,1);assert(worker.feedback?.includes('按鈕壞掉'));assert.equal(worker.files.length,0);assert.equal(p.status,'running');
evidence.failureRework={noFinalModelCall:true,noPublishedFiles:true,revision:worker.revisions,results:p.browserHistory};
// Same immutable contract, corrected draft -> real browser PASS -> manager PASS -> publish.
draft(good);await review();await review();assert.equal(p.status,'completed');assert.equal(p.browserHistory?.length,2);assert.equal(p.browserEvidence?.status,'pass');assert.equal(p.browserContractHash,digest(JSON.stringify(contract)));assert(worker.files.some(f=>f.endsWith('index.html')));assert.equal(children.size,0);
for(const [runIndex,run] of p.browserHistory!.entries()){assert.equal(run.version,2);assert(run.evidenceId);for(const scenario of run.scenarios){assert.equal(scenario.stepResults?.length,scenario.steps+(scenario.passed?0:1));assert(scenario.screenshotPath&&fs.existsSync(path.join(root,...scenario.screenshotPath.split('/'))));if(runIndex===0)assert(scenario.tracePath&&fs.existsSync(path.join(root,...scenario.tracePath.split('/'))));else assert.equal(scenario.tracePath,undefined)}}
evidence.correctedDelivery={status:p.status,calls:p.calls,entryPath:p.delivery?.entryPath,evidence:p.browserEvidence};
evidence.savedBrowserProof={runs:p.browserHistory!.length,screenshots:p.browserHistory!.flatMap(x=>x.scenarios).filter(x=>x.screenshotPath).length,failureTraces:p.browserHistory!.flatMap(x=>x.scenarios).filter(x=>x.tracePath).length,stepByStep:true};
const task:Task={...worker,id:crypto.randomUUID(),state:'working',files:[],sources:[]};
for(const [name,content] of [
 ['emptyInputNotHandled',html("document.getElementById('result').textContent=String(Number(document.getElementById('a').value)+Number(document.getElementById('b').value))")],
 ['networkBlocked',good.replace('<script>','<script>fetch("http://127.0.0.1:4317/api/state");')],
 ['storageBlocked',good.replace('<script>','<script>localStorage.setItem("secret","x");')],
 ['parentBlocked',good.replace('<script>','<script>parent.document.body.innerHTML="oops";')],
 ['missingButton',good.replace('id="calc"','id="missing"')],
 ] as const){const result=await validateBrowser(task,content,contract,root,()=>true);assert.equal(result.status,'fail',name);evidence[name]=result;}
// Closing/stopping the owning task must kill the actual browser tree, including a hung renderer.
let current=true;const stopping=validateBrowser(task,good.replace('<script>','<script>while(true){};'),contract,root,()=>current);const stopped=stopping.then(()=>({error:''}),e=>({error:(e as Error).message}));const child=children.get(task.id)!;
await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Browser did not start')),20000);child.on('message',(m:any)=>{if(m.type==='ready'){clearTimeout(timer);resolve()}});child.once('error',reject)});
const processes=JSON.parse((await promisify(execFile)('powershell.exe',['-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress'],{windowsHide:true})).stdout) as {ProcessId:number;ParentProcessId:number}[];
const ids=new Set([child.pid!]);for(let i=0;i<10;i++)for(const x of processes)if(ids.has(x.ParentProcessId))ids.add(x.ProcessId);assert(ids.size>=3,'need a real browser process tree');
const start=Date.now();current=false;await terminateOwnedProcess(child);assert((await stopped).error);const alive=(id:number)=>{try{process.kill(id,0);return true}catch{return false}};assert([...ids].every(id=>!alive(id)));assert.equal(children.size,0);evidence.stop={ms:Date.now()-start,ownedProcessCount:ids.size,allStopped:true};
// An already completed project's files remain unchanged while stopping a different task.
assert.equal(p.status,'completed');fs.writeFileSync(path.join(root,'state.json'),JSON.stringify(s,null,2));fs.writeFileSync(path.resolve('docs/verification/browser-acceptance-result.json'),JSON.stringify({...evidence,fixtureRoot:root},null,2));console.log(JSON.stringify({fixtureRoot:root,workflow:'FAIL -> rework -> browser PASS -> manager PASS -> delivery',negativeCases:5,stop:evidence.stop,noModelInference:true}));
