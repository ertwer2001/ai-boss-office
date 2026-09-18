import fs from 'node:fs';
import path from 'node:path';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import type {Task} from '../src/domain/company';
import {children} from './runner';
import {terminateOwnedProcess} from './processControl';
import {digest} from './workspace';

export const tradingCommit='2d17df8da1536c121e4d7395ac5a5dcec9e96d6f';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.resolve(base,'..','runtime','tradingagents');
export const researchSchema=z.object({ticker:z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9.^=-]{0,24}$/),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10),'請提供有效且非未來的研究日期'),question:z.string().trim().min(1).max(2000),maxCalls:z.number().int().min(8).max(40).default(20)}).strict();
const settingsSchema=z.object({enabled:z.literal(true),provider:z.enum(['openai','ollama','openai_compatible']),deepModel:z.string().trim().min(1).max(100),quickModel:z.string().trim().min(1).max(100),backendUrl:z.string().url().optional(),effort:z.enum(['low','medium','high']).optional()}).strict();
export function tradingSettings(dataRoot:string){
 const file=path.join(dataRoot,'tradingagents.local.json');
 if(!fs.existsSync(file))throw new Error('TradingAgents 連線尚未設定：請依 tools/tradingagents/README.md 設定本機模型服務。');
 const config=settingsSchema.parse(JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
 if([config.deepModel,config.quickModel].some(m=>m.startsWith('REPLACE_')))throw new Error('請填寫模型服務實際可用的模型名稱');
 if(config.provider==='openai'&&!process.env.OPENAI_API_KEY)throw new Error('TradingAgents 憑證缺少 OPENAI_API_KEY；Codex 登入不能代替 API key。');
 if(config.provider!=='openai'&&!config.backendUrl)throw new Error('TradingAgents 連線缺少 backendUrl。');
 if(config.backendUrl){const u=new URL(config.backendUrl);if(u.username||u.password||u.search||u.hash)throw new Error('模型端點不能包含憑證、查詢或片段');if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('遠端模型端點需要 HTTPS');}
 return config;
}
export function tradingStatus(dataRoot:string){
 const python=path.join(runtime,'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 let installed=false;try{installed=fs.existsSync(python)&&JSON.parse(fs.readFileSync(path.join(runtime,'verified.json'),'utf8').replace(/^\uFEFF/,'')).commit===tradingCommit}catch{}
 try{const c=tradingSettings(dataRoot);return {installed,ready:installed,commit:tradingCommit,provider:c.provider,deepModel:c.deepModel,quickModel:c.quickModel,message:installed?'研究引擎已設定；模型連線尚需實際任務驗證':'研究引擎尚未安裝'}}catch(e){return {installed,ready:false,commit:tradingCommit,message:(e as Error).message}}
}
export async function runTradingResearch(task:Task,dataRoot:string,changed:()=>void,isCurrent:()=>boolean){
 if(process.env.BOSS_DISABLE_INFERENCE==='1')throw new Error('此服務禁止模型推論');
 if(!isCurrent())throw new Error('專案已停止');
 const research=researchSchema.parse(task.research);
 const root=path.join(dataRoot,'workspaces',task.id,'tradingagents');fs.mkdirSync(root,{recursive:true});
 const resultPath=path.join(root,'result.json');
 // A reviewed rework uses the original research evidence; never silently spends another API budget.
 if(task.researchReceipt){const raw=fs.readFileSync(resultPath,'utf8');if(digest(raw)!==task.researchReceipt.sha256)throw new Error('研究原始證據校驗不符');return raw;}
 if(task.researchStarted)throw new Error('TradingAgents 連線／研究已中斷，禁止自動重跑；請停止本案後手動建立新研究。');
 if(!tradingStatus(dataRoot).ready)throw new Error(tradingStatus(dataRoot).message);
 const config=tradingSettings(dataRoot);
 if(task.researchSettingsHash!==digest(JSON.stringify(config)))throw new Error('TradingAgents 連線設定與派工時不同，請手動建立新案');
 if(!isCurrent())throw new Error('專案已停止');
 task.researchStarted=true;task.stage='TradingAgents 正在研究（獨立 API 額度）';changed();
 await executeResearchProcess(task,root,{research,config},changed,isCurrent);
 if(!isCurrent())throw new Error('研究已停止，遲到結果不採用');
 const raw=fs.readFileSync(resultPath,'utf8');
 if(raw.length>100000)throw new Error('研究原始資料超過交接上限，未截斷');
 const result=JSON.parse(raw);
 if(result.commit!==tradingCommit||result.ticker!==research.ticker||result.analysisDate!==research.date||result.researchOnly!==true||!Array.isArray(result.toolEvidence))throw new Error('研究輸出校驗失敗');
 task.researchReceipt={sha256:digest(raw)};
 task.sources.push({kind:'tool',ref:`TradingAgents ${tradingCommit} / ${research.ticker} / ${research.date}（模型研究，非已驗證事實）`,sha256:digest(raw),at:new Date().toISOString()});changed();
 return raw;
}

/** Internal launch seam allows a real zero-model subprocess to test ownership and cancellation. */
export async function executeResearchProcess(task:Task,root:string,request:unknown,changed:()=>void,isCurrent:()=>boolean,launch?:()=>ChildProcessWithoutNullStreams){
 const child=launch?launch():spawn(path.join(runtime,'venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),['-u',path.join(base,'tools/tradingagents/bridge.py')],{cwd:root,windowsHide:true,stdio:'pipe',env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',LANGCHAIN_TRACING_V2:'false',LANGSMITH_TRACING:'false'}});
 children.set(task.id,child);task.pid=child.pid;
 await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{void terminateOwnedProcess(child).then(()=>reject(new Error('TradingAgents 連線逾時：已停止 15 分鐘研究工作')),reject)},900000);
  createInterface({input:child.stdout}).on('line',line=>{try{const event=JSON.parse(line);if(event.event==='call'&&isCurrent()){task.researchCalls=event.calls;task.stage=`TradingAgents 模型呼叫 ${event.calls}／${task.research?.maxCalls}`;changed()}}catch{}});
  // Provider errors may contain credentials; do not return raw stderr to the browser.
  child.stderr.resume();
  child.once('error',()=>{clearTimeout(timer);reject(new Error('TradingAgents 連線失敗：無法啟動研究環境'))});
  child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('TradingAgents 連線／研究中斷：可能是模型、資料來源或呼叫預算；請檢查本機設定後手動建立新案。'))});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(request));
 }).finally(()=>{if(children.get(task.id)===child)children.delete(task.id);delete task.pid});
}
