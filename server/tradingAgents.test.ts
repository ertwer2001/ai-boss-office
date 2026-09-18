import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {researchSchema,tradingSettings,tradingStatus,runTradingResearch,executeResearchProcess} from './tradingAgents';
import {spawn} from 'node:child_process';
import {children} from './runner';
import {terminateOwnedProcess} from './processControl';
import {digest} from './workspace';
import type {Task} from '../src/domain/company';
let root:string;
beforeEach(()=>{fs.mkdirSync('docs/verification',{recursive:true});root=fs.mkdtempSync(path.resolve('docs/verification/trading-test-'))});
afterEach(()=>{vi.unstubAllEnvs();fs.rmSync(root,{recursive:true,force:true})});
const query={ticker:'AAPL',date:'2026-01-05',question:'研究風險',maxCalls:20};
describe('TradingAgents research boundary',()=>{
 it('actual research child belongs to office stop control and is removed after termination',async()=>{
  const task={id:crypto.randomUUID(),research:query} as Task;
  const launch=()=>spawn(process.execPath,['-e','process.stdin.resume();setInterval(()=>{},1000)'],{stdio:'pipe',windowsHide:true});
  const pending=executeResearchProcess(task,root,{},()=>{},()=>true,launch).catch(e=>e);
  const child=children.get(task.id)!;expect(child.pid).toBe(task.pid);
  await terminateOwnedProcess(child);expect(await pending).toBeInstanceOf(Error);
  expect(children.has(task.id)).toBe(false);expect(task.pid).toBeUndefined();
 });
 it('rejects path traversal, invalid calendar dates, future dates and unbounded calls',()=>{
  for(const patch of [{ticker:'../secret'},{date:'2026-02-30'},{date:'9999-01-01'},{maxCalls:999}])expect(researchSchema.safeParse({...query,...patch}).success).toBe(false);
  expect(researchSchema.parse({...query,ticker:'aapl'}).ticker).toBe('AAPL');
 });
 it('missing configuration stays disabled without reading credentials',()=>{expect(tradingStatus(root).ready).toBe(false);expect(()=>tradingSettings(root)).toThrow('尚未設定')});
 it('OpenAI requires an API credential; local compatible models need no invented Codex model',()=>{
  vi.stubEnv('OPENAI_API_KEY','');const file=path.join(root,'tradingagents.local.json');
  fs.writeFileSync(file,JSON.stringify({enabled:true,provider:'openai',deepModel:'chosen',quickModel:'chosen'}));expect(()=>tradingSettings(root)).toThrow('憑證');
  fs.writeFileSync(file,JSON.stringify({enabled:true,provider:'ollama',backendUrl:'http://127.0.0.1:11434/v1',deepModel:'installed',quickModel:'installed'}));expect(tradingSettings(root).provider).toBe('ollama');
 });
 it('rejects embedded endpoint credentials and remote plaintext transport',()=>{
  for(const backendUrl of ['http://example.com/v1','https://user:secret@example.com/v1']){fs.writeFileSync(path.join(root,'tradingagents.local.json'),JSON.stringify({enabled:true,provider:'openai_compatible',backendUrl,deepModel:'x',quickModel:'x'}));expect(()=>tradingSettings(root)).toThrow()}
 });
 it('rework reuses hashed research, detects tampering and never retries an interrupted engine',async()=>{
  const t={id:'test',research:query,researchStarted:true} as Task;
  await expect(runTradingResearch(t,root,()=>{},()=>true)).rejects.toThrow('禁止自動重跑');
  const dir=path.join(root,'workspaces/test/tradingagents');fs.mkdirSync(dir,{recursive:true});const raw='{"research":"fixture"}';fs.writeFileSync(path.join(dir,'result.json'),raw);t.researchReceipt={sha256:digest(raw)};
  expect(await runTradingResearch(t,root,()=>{},()=>true)).toBe(raw);
  fs.writeFileSync(path.join(dir,'result.json'),'changed');await expect(runTradingResearch(t,root,()=>{},()=>true)).rejects.toThrow('校驗');
 });
});
