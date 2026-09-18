import {execFile,type ChildProcess} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const executeFile=promisify(execFile);
const stopping=new WeakMap<ChildProcess,Promise<void>>();
/** Only accepts a ChildProcess handle owned by this service; never enumerates unrelated Codex processes. */
export function terminateOwnedProcess(child:ChildProcess):Promise<void>{
 const active=stopping.get(child);if(active)return active;
 const pending=terminate(child).finally(()=>stopping.delete(child));stopping.set(child,pending);return pending;
}
async function terminate(child:ChildProcess){
 if(child.exitCode!==null||child.signalCode!==null||!child.pid)return;
 const exited=new Promise<void>(resolve=>child.once('close',()=>resolve()));
 if(process.platform==='win32'){
  try{await executeFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000})}
  catch(e){if(child.exitCode===null&&child.signalCode===null)throw new Error('停止執行程序失敗，請重試總停止：'+(e as Error).message)}
 }else child.kill('SIGTERM');
 if(child.exitCode===null&&child.signalCode===null){let timer:ReturnType<typeof setTimeout>;try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('停止尚未確認，請重試總停止')),4000)})])}finally{clearTimeout(timer!)}}
}
