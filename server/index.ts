import {profileIds,roleProfiles,roleCatalog} from '../src/domain/roleProfiles';
import {Hono,type Context} from 'hono';
import {streamSSE} from 'hono/streaming';
import {OfficePresence} from './presence';
import {allowed,haltInactiveJobs} from './execution';
import {QuotaWatch} from './quotaWatch';
import {selectReadyTasks,launchReadyJobs} from './scheduling';
import {findDelivered,entryFile,previewHtml,previewPolicy,readPublished,requirePublished} from './delivery';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {control,quotaLow} from './codex';
import {runTask,children,readTaskFiles} from './runner';
import {terminateOwnedProcess} from './processControl';
import {loadParsedDocument,parseDocumentFile,stopDocumentJobs} from './documentParsing';
import {cancelQueuedAuto} from './dispatch';
import {researchSchema,tradingSettings,tradingStatus} from './tradingAgents';
import {createProject,advanceProjects,runManager,stopProject,beforeProjectCall,autonomousStatus,startAutonomous,pauseProject,resumeProjectWork,retargetUnavailableTask,handleTaskError} from './projects';
import {autoEligibility,defaultAuto,hasActiveGoal,recommendPlan,suggestions,type AutoTask} from '../src/domain/recommendations';
import {safePath,saveFile,digest} from './workspace';
import {makeCompany,plan,ready,completeCount,type Store,type Task,type CompanyType,type Model} from '../src/domain/company';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataRoot=process.env.BOSS_DATA_DIR||path.join(base,'data');
const outputRoot=process.env.BOSS_OUTPUT_DIR||path.resolve(base,'..','員工成果');
fs.mkdirSync(dataRoot,{recursive:true});fs.mkdirSync(outputRoot,{recursive:true});
const statePath=path.join(dataRoot,'company.json');
let state:Store=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath,'utf8')):{version:1,boss:'老闆',companies:[],tasks:[],paused:false,maxTasksPerDay:30};
for(const co of state.companies)if(co.autoDispatch?.enabled&&co.autoDispatch.version!==2){co.autoDispatch.enabled=false;co.autoDispatch.lastError='舊版範本排程已停用；請選擇新版主管模式重新下令。'}
for(const p of state.projects||[])if(!['completed','stopped','blocked'].includes(p.status)){p.status='blocked';p.message='服務中斷，主管已暫停；請檢視紀錄後手動繼續。'}
for(const t of state.tasks)if(t.state==='working'){t.state='blocked';t.error='上次服務中斷，請查看已交付內容後重試。';delete t.pid}
let generation=0,controlRevision=0;function save(){fs.writeFileSync(statePath+'.tmp',JSON.stringify(state,null,2));fs.renameSync(statePath+'.tmp',statePath);generation++}
state.maxConcurrentTasks??=2;
state.paused=true;
for(const co of state.companies)if(co.autoDispatch)co.autoDispatch.enabled=false;
save();
const presence=new OfficePresence(async()=>{state.stopReason='辦公室頁面已關閉或斷線，全部工作已停止';await rest()});
const presenceTimer=setInterval(()=>void presence.sweep(),1000);
function requirePage(c?:Context){if(!presence.available||(c&&!presence.active(c.req.header('x-boss-page')||'',c.req.header('x-boss-page-token')||'')))throw new Error('請先開啟並保持辦公室頁面連線，才可開始工作')}
const app=new Hono();const port=Number(process.env.BOSS_PORT||4317);
app.use('*',async(c,next)=>{
 const host=c.req.header('host');if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host||''))return c.json({error:'只接受本機連線'},403);
 const origin=c.req.header('origin');if(origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port,'http://127.0.0.1:5173'].includes(origin))return c.json({error:'來源不被允許'},403);
 if(!['GET','HEAD'].includes(c.req.method)&&c.req.path!=='/api/presence/close'&&c.req.header('x-boss-office')!=='local')return c.json({error:'請從老闆辦公室操作'},403);
 c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','no-referrer');
 await next();
});
app.onError((e,c)=>c.json({error:e instanceof z.ZodError?'輸入格式不正確：'+e.issues.map(x=>x.message).join('；'):e.message},400));
app.get('/api/role-profiles',c=>c.json({...roleCatalog,profiles:roleProfiles}));
app.get('/api/tradingagents/status',c=>c.json(tradingStatus(dataRoot)));
app.post('/api/companies/:id/trading-research',async c=>{
 requirePage(c);if(process.env.BOSS_DISABLE_INFERENCE==='1')throw new Error('此服務禁止模型推論');
 const research=researchSchema.parse(await c.req.json()),co=state.companies.find(x=>x.id===c.req.param('id'));
 if(!co||co.type!=='advisory')throw new Error('投資研究室僅供投顧研究公司使用');
 if(!tradingStatus(dataRoot).ready)throw new Error(tradingStatus(dataRoot).message);
 const researchSettingsHash=digest(JSON.stringify(tradingSettings(dataRoot)));const models=(await control.status()).models;
 requirePage(c);const worker=co.employees.find(e=>e.title==='產業分析師')||co.employees[1];
 const goal=`研究 ${research.ticker}，截止 ${research.date}：${research.question}。僅供自用研究；交付白話結論、支持與反對證據、資料日期、來源及缺口，不得編造報酬或下單。`;
 const p=createProject(state,co,models,'manual',goal,'',12,[{title:'整理 TradingAgents 研究與原始證據，製作可閱讀的研究報告',employeeId:worker.id,model:worker.model,effort:worker.effort,reason:'老闆指定研究引擎；主管必須審查來源、日期與限制'}]);
 const task=state.tasks.find(t=>t.projectId===p.id&&t.kind==='work')!;task.research=research;task.researchSettingsHash=researchSettingsHash;
 task.acceptance=['報告回答老闆的研究問題，清楚列出支持與反對觀點','所有數值具可核對來源與日期；模型文字不當作外部事實證據','標示缺漏、過期或歷史快照不足；不可捏造數據、績效或聲稱已交易','附平台保存的 tradingagents-evidence.json 原始工具及模型研究紀錄'];
 save();return c.json({project:p});
});
app.get('/api/health',c=>c.json({ok:true,app:'boss-office',version:'2.6.0',pid:process.pid,outputRoot,inferenceEnabled:process.env.BOSS_DISABLE_INFERENCE!=='1',documentParsing:'Docling 2.127.0 / local-only'}));
const leaseSchema=z.object({id:z.string().regex(/^[a-f0-9]{32}$/),token:z.string().regex(/^[a-f0-9]{48}$/)});
app.post('/api/presence/open',c=>c.json(presence.open()));
app.post('/api/presence/ack',async c=>{const b=leaseSchema.parse(await c.req.json());return c.json({ok:presence.ack(b.id,b.token)},presence.valid(b.id,b.token)?200:403)});
app.post('/api/presence/close',async c=>{const b=leaseSchema.parse(await c.req.json());await presence.close(b.id,b.token);return c.json({ok:true})});
app.get('/api/presence/events',c=>{const b=leaseSchema.parse(c.req.query());presence.connect(b.id,b.token);return streamSSE(c,async stream=>{stream.onAbort(()=>presence.close(b.id,b.token));try{while(!stream.aborted&&presence.valid(b.id,b.token)){await stream.writeSSE({data:'heartbeat'});await stream.sleep(3000)}}finally{await presence.close(b.id,b.token)}})});
app.get('/api/status',async c=>{try{return c.json(await control.status())}catch(e){return c.json({connected:false,models:[],error:(e as Error).message})}});
async function listedModels():Promise<Model[]>{if(process.env.BOSS_DISABLE_INFERENCE==='1')return [];try{return (await control.status()).models}catch{return []}}
app.get('/api/state',async c=>{if(!state.companies.length){state.companies.push(makeCompany('AI 營運公司','studio',await listedModels()));save()}return c.json({...state,companies:state.companies.map(co=>({...co,dispatchStatus:autonomousStatus(co,state)})),generation,outputRoot,pageConnected:presence.available,pageCount:presence.count,presenceError:presence.lastError})});
app.post('/api/companies/:id/documents/parse',async c=>{
 requirePage(c);const co=state.companies.find(x=>x.id===c.req.param('id'));if(!co)throw new Error('找不到公司');
 const pageId=c.req.header('x-boss-page')||'',pageToken=c.req.header('x-boss-page-token')||'';
 const b=z.object({name:z.string().trim().min(1).max(180),base64:z.string().min(4).max(14000000)}).parse(await c.req.json());
 const document=await parseDocumentFile({dataRoot,projectRoot:base,companyId:co.id,name:b.name,base64:b.base64,isCurrent:()=>presence.active(pageId,pageToken)});
 return c.json({document});
});
app.patch('/api/settings',async c=>{const b=z.object({boss:z.string().trim().min(1).max(40).optional(),paused:z.boolean().optional(),maxTasksPerDay:z.number().int().min(1).max(200).optional(),maxConcurrentTasks:z.number().int().min(1).max(8).optional()}).parse(await c.req.json());if(b.paused===false)requirePage(c);Object.assign(state,b);save();if(b.paused)await rest();return c.json({ok:true})});
app.post('/api/rest',async c=>{const b=z.object({companyId:z.string().optional()}).parse(await c.req.json());await rest(b.companyId);return c.json({ok:true,message:'已休息；執行與排隊工作已停止，自動派工已關閉'})});
app.post('/api/companies/:id/resume',async c=>{const co=state.companies.find(x=>x.id===c.req.param('id'));if(!co)throw new Error('找不到公司');requirePage(c);co.paused=false;save();return c.json({ok:true,message:'已恢復手動工作；不會重跑已停止任務或重啟自動派工'})});
app.post('/api/companies/:id/auto-dispatch',async c=>{
 const b=z.object({action:z.literal('disable')}).parse(await c.req.json());const co=state.companies.find(x=>x.id===c.req.param('id'));if(!co)throw new Error('找不到公司');if(co.autoDispatch)co.autoDispatch.enabled=false;cancelQueuedAuto(co,state.tasks,'老闆已關閉舊版排程');save();return c.json({ok:true});
});
app.post('/api/companies/:id/manager-projects',async c=>{
 requirePage(c);const revision=controlRevision;
 const b=z.object({resumeOffice:z.boolean().optional(),mode:z.enum(['goal','autonomous']),goal:z.string().trim().max(12000),input:z.string().max(100000).optional(),documentId:z.string().uuid().optional(),dailyLimit:z.number().int().min(1).max(5).default(1),intervalMinutes:z.number().int().min(5).max(1440).default(30),maxCalls:z.number().int().min(4).max(60).default(18)}).parse(await c.req.json());
 const co=state.companies.find(x=>x.id===c.req.param('id'));if(!co)throw new Error('找不到公司');if(b.mode==='goal'&&!b.goal)throw new Error('請輸入要主管完成的目標');if(todayCount()>=state.maxTasksPerDay)throw new Error('已達每日工作步驟上限');
 const loaded=b.documentId?loadParsedDocument(dataRoot,b.documentId,co.id):undefined;
 const documentInput=loaded?`【本機文件：${loaded.attachment.name}；Docling ${loaded.attachment.parserVersion} 解析；原檔 SHA-256 ${loaded.attachment.originalSha256}】\n${loaded.markdown}`:'';
 const combinedInput=[b.input?.trim(),documentInput].filter(Boolean).join('\n\n');if(combinedInput.length>100000)throw new Error('文字資料與文件解析內容合計超過 100,000 字元，請縮短貼上的文字或拆成不同任務');
 const status=await control.status();if(!status.connected||quotaLow(status.quota))throw new Error('登入或額度不足，無法開案');if(revision!==controlRevision)throw new Error('工作已停止，這次下令已撤回');
 const goal=b.goal||'依公司類型自行規畫有價值、可完成的內部專案';
 requirePage(c);const oldPause=state.paused,oldCompanyPause=co.paused;if(b.resumeOffice){state.paused=false;co.paused=false}
 let project;try{project=createProject(state,co,status.models,b.mode,goal,combinedInput,b.maxCalls,undefined,loaded?.attachment)}catch(e){state.paused=oldPause;co.paused=oldCompanyPause;throw e}state.stopReason=undefined;
 co.autoDispatch={version:2,enabled:b.mode==='autonomous',dailyLimit:b.dailyLimit,intervalMinutes:b.intervalMinutes,maxCalls:b.maxCalls,authorizedAt:new Date().toISOString(),authorizedBy:state.boss,managerId:project.managerId,instruction:goal,lastDispatchedAt:new Date().toISOString()};
 save();return c.json({project});
});
app.post('/api/projects/:id/stop',async c=>{const p=state.projects?.find(p=>p.id===c.req.param('id'));if(!p)throw new Error('找不到專案');controlRevision++;const ids=stopProject(state,p);save();await stopProcesses(ids);return c.json({ok:true})});
app.post('/api/projects/:id/resume',async c=>{requirePage(c);
 const b=z.object({answer:z.string().trim().max(6000).default(''),maxCalls:z.number().int().min(4).max(60).optional()}).parse(await c.req.json());
 const p=state.projects?.find(p=>p.id===c.req.param('id'));if(!p)throw new Error('找不到專案');if(p.status!=='blocked')throw new Error('只有暫停待處理的專案可以繼續；已停止專案請重新下令');
 if(p.blockReason==='validation'&&!p.browserContract)throw new Error('舊案沒有事先訂定操作驗收條件，請停止結案後重新下令；增加呼叫不能替代驗收');
 if(state.paused||state.companies.find(c=>c.id===p.companyId)?.paused)throw new Error('請先恢復辦公室手動工作');
 if(p.escalation&&!b.answer)throw new Error('請先回覆這項重大決策');if((b.maxCalls||p.maxCalls)<=p.calls)throw new Error('請明確調高此案的呼叫上限才可繼續');
 const tasks=state.tasks.filter(t=>t.projectId===p.id);if(tasks.some(t=>children.has(t.id)))throw new Error('上次程序尚未結束');
 p.maxCalls=b.maxCalls||p.maxCalls;(p.decisionLog??=[]).push({at:new Date().toISOString(),text:b.answer||'老闆要求在原授權範圍內繼續'});p.escalation=undefined;p.blockReason=undefined;
 const failed=tasks.find(t=>t.state==='blocked'&&t.kind!=='work');
 const unfinished=tasks.find(t=>t.kind==='work'&&['blocked','approve'].includes(t.state));
 if(failed){retargetUnavailableTask(state,failed);failed.state='queued';failed.error=undefined}
 else if(unfinished){resumeProjectWork(state,p,unfinished,b.answer)}
 else if(!tasks.some(t=>t.kind==='work')){const planner=tasks.find(t=>t.kind==='plan');if(planner)planner.state='queued'}
 p.status=tasks.some(t=>t.kind==='work')?'running':'planning';p.message='老闆已手動要求主管繼續';save();return c.json({ok:true});
});
app.post('/api/companies',async c=>{const b=z.object({name:z.string().trim().min(1).max(60),type:z.enum(['studio','advisory','marketing','ecommerce','agency'])}).parse(await c.req.json());const co=makeCompany(b.name,b.type,await listedModels());state.companies.push(co);save();return c.json(co)});
app.patch('/api/companies/:id',async c=>{const b=z.object({name:z.string().trim().min(1).max(60)}).parse(await c.req.json());const co=state.companies.find(x=>x.id===c.req.param('id'));if(!co)throw new Error('找不到公司');co.name=b.name;save();return c.json({ok:true})});
app.patch('/api/employees/:id',async c=>{const b=z.object({name:z.string().trim().min(1).max(40),model:z.string(),effort:z.string(),brief:z.string().max(4000),profileId:z.enum(profileIds).optional()}).parse(await c.req.json());const e=state.companies.flatMap(c=>c.employees).find(e=>e.id===c.req.param('id'));if(!e)throw new Error('找不到員工');const s=await control.status();if(!s.models.some(m=>m.id===b.model&&m.efforts.includes(b.effort)))throw new Error('此模型不支援所選的推理強度');Object.assign(e,b);const retargeted=state.tasks.filter(t=>t.employeeId===e.id&&t.state==='blocked').filter(t=>retargetUnavailableTask(state,t)).length;save();return c.json({ok:true,retargeted})});
app.post('/api/goals',async c=>{const b=z.object({companyId:z.string(),name:z.string().trim().min(1).max(80),target:z.number().int().positive().max(10000)}).parse(await c.req.json());const co=state.companies.find(x=>x.id===b.companyId);if(!co)throw new Error('找不到公司');co.goals.push({id:crypto.randomUUID(),name:b.name,target:b.target,baseline:completeCount(state.tasks,co.id,state.projects||[])});cancelQueuedAuto(co,state.tasks,'已有公司目標，停止無目標自動工作');save();return c.json({ok:true})});
app.post('/api/plan',async c=>{const b=z.object({companyId:z.string(),text:z.string().trim().min(1).max(12000),employeeId:z.string().optional(),suggestionId:z.string().optional()}).parse(await c.req.json());const co=state.companies.find(x=>x.id===b.companyId);if(!co)throw new Error('找不到公司');const s=await control.status();return c.json({tasks:recommendPlan(co,b.text,s.models,b.employeeId,b.suggestionId)})});
app.post('/api/dispatch',async c=>{
 requirePage(c);const intakeRevision=controlRevision;
 const b=z.object({companyId:z.string(),command:z.string().trim().min(1).max(12000),input:z.string().max(100000).optional(),documentId:z.string().uuid().optional(),tasks:z.array(z.object({title:z.string().trim().min(1).max(12000),employeeId:z.string(),model:z.string().optional(),effort:z.string().optional(),reason:z.string().max(500).optional(),suggestionId:z.string().optional()})).min(1).max(8)}).parse(await c.req.json());
 if(state.paused)throw new Error('公司已暫停，請先恢復派工');
 if(todayCount()+b.tasks.length>state.maxTasksPerDay)throw new Error('已達每日任務上限');
 const co=state.companies.find(x=>x.id===b.companyId);if(!co)throw new Error('找不到公司');const s=await control.status();if(!s.connected)throw new Error('請先登入 Codex');if(quotaLow(s.quota))throw new Error('Codex 額度剩餘 2% 以下，已停止派工');
 if(intakeRevision!==controlRevision)throw new Error('老闆已停止工作，這次派工已撤回；需要時請重新派工');
 requirePage(c);
 const loaded=b.documentId?loadParsedDocument(dataRoot,b.documentId,co.id):undefined;const documentInput=loaded?`【本機文件：${loaded.attachment.name}；Docling ${loaded.attachment.parserVersion} 解析；原檔 SHA-256 ${loaded.attachment.originalSha256}】\n${loaded.markdown}`:'';const combinedInput=[b.input?.trim(),documentInput].filter(Boolean).join('\n\n');if(combinedInput.length>100000)throw new Error('文字資料與文件解析內容合計超過 100,000 字元，請縮短貼上的文字或拆成不同任務');
 const plans=b.tasks.map(p=>{const e=co.employees.find(x=>x.id===p.employeeId);if(!e)throw new Error('員工不屬於此公司');return {...p,model:p.model||e.model,effort:p.effort||e.effort}});
 const project=createProject(state,co,s.models,'manual',b.command,combinedInput,Math.min(60,Math.max(18,plans.length*4+2)),plans,loaded?.attachment);
 const ids=state.tasks.filter(t=>t.projectId===project.id).map(t=>t.id);
 save();return c.json({ids});
});
app.post('/api/tasks/:id/action',async c=>{
 const b=z.object({action:z.enum(['cancel','retry','accept']),feedback:z.string().max(6000).optional(),input:z.string().max(100000).optional()}).parse(await c.req.json());const t=state.tasks.find(x=>x.id===c.req.param('id'));if(!t)throw new Error('找不到任務');
 if(b.action==='cancel'){if(t.state==='done')throw new Error('任務已完成');const project=state.projects?.find(p=>p.id===t.projectId);const ids=project?stopProject(state,project):cancelTree(t.id);controlRevision++;const co=state.companies.find(x=>x.id===t.companyId)!;if(co.autoDispatch)co.autoDispatch.enabled=false;cancelQueuedAuto(co,state.tasks,'老闆已停止此案，自動安排已關閉');save();await stopProcesses(ids);}
 if(b.action==='accept'){if(t.projectId)throw new Error('主管專案必須通過 Review，不能手動跳過審查');if(t.state!=='approve')throw new Error('此任務不在待驗收狀態');t.state='done';t.approvedBy=state.boss;t.approvalAt=new Date().toISOString();t.doneAt=t.approvalAt;t.stage='草稿已驗收（未對外發布）'}
 if(b.action==='retry'){requirePage(c);if(t.projectId)throw new Error('請從主管專案卡片處理；員工問題會先請示主管');if(state.paused||state.companies.find(c=>c.id===t.companyId)?.paused)throw new Error('目前正在休息，請先恢復手動工作');if(!['blocked','approve','cancelled'].includes(t.state))throw new Error('此任務無法重試');if(children.has(t.id))throw new Error('上一個執行程序尚未結束');t.state='queued';t.error=undefined;t.feedback=b.feedback;if(b.input)t.input=b.input;t.stage='等待重新執行'}
 save();return c.json({ok:true});
});
function candidate(id:string){const p=state.projects?.find(p=>p.id===id);if(p?.status!=='blocked'||p.blockReason!=='validation'||!p.candidateDelivery)return;const t=state.tasks.find(t=>t.id===p.candidateDelivery!.entryTaskId&&t.projectId===p.id);if(!t)throw new Error('找不到待驗收作品');const content=readTaskFiles(t,dataRoot,outputRoot)[p.candidateDelivery.entryPath];if(content===undefined)throw new Error('待驗收作品版本不符');return {p,t,content}}
app.get('/api/projects/:id/delivery',c=>{const draft=candidate(c.req.param('id'));if(draft)return c.json({delivery:draft.p.candidateDelivery,content:draft.content,taskId:draft.t.id,index:-1,html:true,candidate:true});const p=findDelivered(state,c.req.param('id')),entry=entryFile(state,p);return c.json({delivery:p.delivery,content:readPublished(entry.task,entry.path,outputRoot),taskId:entry.task.id,index:entry.index,html:/\.html?$/i.test(entry.path)})});
app.get('/api/projects/:id/preview',c=>{const draft=candidate(c.req.param('id'));c.header('Content-Security-Policy',previewPolicy);c.header('Cache-Control','no-store');return c.html(draft?'<!doctype html>\n'+draft.content:previewHtml(state,findDelivered(state,c.req.param('id')),outputRoot))});
app.get('/api/projects/:id/browser-evidence/:evidenceId/:scenario/:kind',c=>{
 const p=state.projects?.find(x=>x.id===c.req.param('id'));if(!p)throw new Error('找不到專案');
 const evidence=(p.browserHistory||[]).find(x=>x.evidenceId===c.req.param('evidenceId'));if(!evidence)throw new Error('找不到操作驗收證據');
 const index=Number(c.req.param('scenario')),scenario=evidence.scenarios[index],kind=c.req.param('kind');if(!Number.isInteger(index)||!scenario||!['screenshot','trace'].includes(kind))throw new Error('操作驗收證據索引不正確');
 const ref=kind==='screenshot'?scenario.screenshotPath:scenario.tracePath,hash=kind==='screenshot'?scenario.screenshotSha256:scenario.traceSha256;if(!ref||!hash)throw new Error('此情境沒有該證據檔案');
 const file=safePath(dataRoot,ref);if(!fs.existsSync(file))throw new Error('操作驗收證據檔案遺失');const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(actual!==hash)throw new Error('操作驗收證據檔案校驗不符');
 c.header('Cache-Control','no-store');c.header('Content-Type',kind==='screenshot'?'image/png':'application/zip');if(kind==='trace')c.header('Content-Disposition',`attachment; filename="browser-failure-${index+1}.zip"`);return c.body(new Uint8Array(fs.readFileSync(file)));
});
app.get('/api/download/:id/:index',c=>{const t=requirePublished(state,state.tasks.find(t=>t.id===c.req.param('id')));const f=t.files[Number(c.req.param('index'))];if(!f)throw new Error('找不到成果');const content=readPublished(t,f,outputRoot);c.header('Content-Type','application/octet-stream');c.header('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(path.basename(f))}`);c.header('Content-Security-Policy',"sandbox; default-src 'none'");return c.body(new Uint8Array(Buffer.from(content,'utf8')))});
app.get('/api/tasks/:id/artifact/:index',c=>{const t=requirePublished(state,state.tasks.find(t=>t.id===c.req.param('id')));const f=t.files[Number(c.req.param('index'))];if(!f)throw new Error('找不到成果');return c.json({path:f,content:readPublished(t,f,outputRoot).slice(0,250000)})});
function cancelTree(id:string):string[]{const t=state.tasks.find(t=>t.id===id)!;if(t.state==='done')return [];controlRevision++;t.state='cancelled';t.stage=children.has(id)?'正在停止執行程序':'已停止／休息';return [id,...state.tasks.filter(x=>x.dependsOn.includes(id)).flatMap(next=>cancelTree(next.id))]}
async function stopProcesses(ids:string[]){const results=await Promise.allSettled([...new Set(ids)].map(async id=>{const child=children.get(id),t=state.tasks.find(t=>t.id===id);if(child)await terminateOwnedProcess(child);if(t){t.stage='已停止／休息';t.logs.push({at:new Date().toISOString(),text:'老闆停止工作；已終止本任務的本機執行程序，排隊工作不再啟動。'})}}));save();const failed=results.filter(r=>r.status==='rejected');if(failed.length)throw new Error('部分執行程序停止尚未確認，請再次按總停止。');}
async function rest(companyId?:string){const co=companyId?state.companies.find(c=>c.id===companyId):undefined;if(companyId&&!co)throw new Error('找不到公司');controlRevision++;if(co)co.paused=true;else state.paused=true;for(const c of co?[co]:state.companies)if(c.autoDispatch)c.autoDispatch.enabled=false;for(const p of state.projects||[])if((!companyId||p.companyId===companyId)&&!['completed','stopped'].includes(p.status))stopProject(state,p);const ids=state.tasks.filter(t=>(!companyId||t.companyId===companyId)&&t.state!=='done').flatMap(t=>cancelTree(t.id));save();await Promise.all([stopProcesses(ids),stopDocumentJobs(companyId)])}
function todayCount(){const day=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});return state.tasks.filter(t=>new Date(t.createdAt).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})===day).length}
let scheduling=false,autoCheckAfter=0;
const activeJobs=new Set<string>();
const activeVersions=new Map<string,number>();let halting:Promise<void>|undefined;
function haltInactive(){return halting??=(haltInactiveJobs(state,activeVersions,async id=>{const child=children.get(id);if(child)await terminateOwnedProcess(child)},save).finally(()=>{halting=undefined}))}
async function executeJob(t:Task,models:Model[]){
 const version=t.executionRevision||0;activeVersions.set(t.id,version);
 try{
  requirePage();
  const co=state.companies.find(c=>c.id===t.companyId)!,project=state.projects?.find(p=>p.id===t.projectId),employee=co.employees.find(e=>e.id===t.employeeId)!;
  if(!models.some(m=>m.id===t.model&&m.efforts.includes(t.effort)))throw new Error('此任務模型已不可用，主管已暫停');
  if(project&&t.kind!=='work')await runManager(t,state,models,dataRoot,outputRoot,save);
  else await runTask(t,employee,state.tasks.filter(x=>t.dependsOn.includes(x.id)),dataRoot,outputRoot,save,{isCurrent:()=>allowed(state,t),projectBrief:project?{assumptions:project.assumptions,decisions:project.decisionLog||[],browserContract:project.browserContract}:undefined,beforeInference:()=>{requirePage();if(project)beforeProjectCall(project,state);save()}});
 }catch(e){if((t.executionRevision||0)===version)handleTaskError(state,t,e as Error)}finally{if((t.executionRevision||0)===version&&t.state==='working'){t.state='blocked';t.error=state.projects?.find(p=>p.id===t.projectId)?.message||'執行已暫停'}try{await haltInactive()}catch(e){state.stopReason=(e as Error).message}activeVersions.delete(t.id);save()}
}
async function tick(){
 try{await haltInactive()}catch(e){state.stopReason=(e as Error).message;save();return}
 if(Date.now()<autoCheckAfter||scheduling||state.paused||!presence.available||process.env.BOSS_DISABLE_INFERENCE==='1'||activeJobs.size>=(state.maxConcurrentTasks||2))return;
 advanceProjects(state,save);const revision=controlRevision;
 const canAuto=Date.now()>=autoCheckAfter&&state.companies.some(c=>!autonomousStatus(c,state));if(!selectReadyTasks(state,activeJobs).length&&!canAuto)return;scheduling=true;
 try{
  const status=await control.status();if(!status.connected)throw new Error('Codex 登入已失效');if(quotaLow(status.quota)){state.stopReason='額度剩下 2% 以下，全部工作已停止';await rest();return}
  if(state.paused||!presence.available||revision!==controlRevision)return;
  if(canAuto)startAutonomous(state,status.models);
  launchReadyJobs(state,activeJobs,t=>executeJob(t,status.models),save);
 }catch(e){autoCheckAfter=Date.now()+60000;for(const co of state.companies)if(co.autoDispatch?.enabled)co.autoDispatch.lastError=(e as Error).message;state.stopReason=(e as Error).message}
 finally{scheduling=false;save()}
}
const interval=setInterval(()=>void tick(),1800);
const quotaWatch=new QuotaWatch(()=>control.status(),async()=>{state.stopReason='額度剩下 2% 以下，全部工作已停止';await rest()},message=>{state.stopReason='額度檢查尚未確認：'+message;save()});
const quotaTimer=setInterval(()=>void quotaWatch.check(activeJobs.size>0),15000);
app.use('/*',serveStatic({root:path.join(base,'dist')}));app.get('*',serveStatic({path:path.join(base,'dist/index.html')}));
const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port},()=>console.log(`Boss Office ready http://127.0.0.1:${port} | outputs ${outputRoot}`));
let shutdown:Promise<void>|undefined;
function stop(){if(shutdown)return;clearInterval(interval);clearInterval(presenceTimer);clearInterval(quotaTimer);shutdown=(async()=>{await rest();control.close();server.close();if('closeAllConnections' in server)server.closeAllConnections();process.exitCode=0})().catch(e=>{console.error('停止尚未完成，保留服務以便重試：',e);shutdown=undefined})}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
