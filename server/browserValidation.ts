import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
import type {Task} from '../src/domain/company';
import {browserContract,type BrowserContract,type BrowserEvidence} from './browserContract';
import {children} from './runner';import {terminateOwnedProcess} from './processControl';import {digest} from './workspace';
export type ValidateBrowser=(task:Task,html:string,contract:BrowserContract,dataRoot:string,current:()=>boolean)=>Promise<BrowserEvidence>;
export const validateBrowser:ValidateBrowser=async(task,html,raw,dataRoot,current)=>{
 const contract=browserContract.parse(raw);
 if(!current())throw new Error('驗收已停止');
 if(children.has(task.id))throw new Error('前次執行程序尚未結束');
 const evidenceId=crypto.randomUUID(),artifactPrefix=`verification/${task.id}/${evidenceId}`,artifactFolder=path.join(dataRoot,...artifactPrefix.split('/'));
 fs.mkdirSync(artifactFolder,{recursive:true});
 const child=spawn(process.execPath,['--import','tsx',fileURLToPath(new URL('./browserWorker.ts',import.meta.url))],{cwd:path.resolve(fileURLToPath(new URL('..',import.meta.url))),windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
 children.set(task.id,child);task.pid=child.pid;child.stderr?.resume();
 let timer:ReturnType<typeof setTimeout>|undefined,check:ReturnType<typeof setInterval>|undefined,saved=false;
 try{
  const result=await new Promise<BrowserEvidence>((resolve,reject)=>{
   let received:BrowserEvidence|undefined,ended=false;
   const stop=(message:string)=>{if(ended)return;ended=true;void terminateOwnedProcess(child).then(()=>reject(new Error(message)),reject)};
   timer=setTimeout(()=>stop('瀏覽器驗收超過 90 秒上限，已停止'),90000);
   check=setInterval(()=>{if(!current())stop('驗收已停止')},150);
   child.on('error',reject);
   child.on('message',(m:any)=>{if(m.type==='result')received=m.evidence;else if(m.type==='error')stop('瀏覽器驗收環境錯誤：'+m.error)});
   child.once('close',code=>{if(ended)return;ended=true;if(code===0&&received)resolve(received);else reject(new Error('瀏覽器驗收中斷，未取得完整結果'))});
   child.send({html,contract,evidenceId,artifactFolder,artifactPrefix});
  });
  if(!current())throw new Error('驗收已停止');
  if(result.htmlSha256!==digest(html)||result.contractSha256!==digest(JSON.stringify(contract)))throw new Error('操作驗收版本校驗不符');
  if(result.evidenceId!==evidenceId)throw new Error('操作驗收證據識別碼不符');
  for(const scenario of result.scenarios)for(const [ref,hash] of [[scenario.screenshotPath,scenario.screenshotSha256],[scenario.tracePath,scenario.traceSha256]] as const)if(ref){
   const file=path.resolve(dataRoot,...ref.split('/'));if(!file.startsWith(path.resolve(artifactFolder)+path.sep)||!fs.existsSync(file))throw new Error('操作驗收證據檔案遺失');
   const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');if(actual!==hash)throw new Error('操作驗收證據檔案校驗不符');
  }
  fs.writeFileSync(path.join(artifactFolder,'evidence.json'),JSON.stringify(result,null,2));saved=true;
  return result;
 }finally{
  clearTimeout(timer);clearInterval(check);
  // Keep ownership registered if termination fails, so the global stop can retry.
  await terminateOwnedProcess(child);
  if(children.get(task.id)===child)children.delete(task.id);
  if(task.pid===child.pid)delete task.pid;
  if(!saved&&fs.existsSync(artifactFolder))fs.rmSync(artifactFolder,{recursive:true,force:true});
 }
};
