// Isolated browser/process verification only. Never launches a model.
import {spawn} from 'node:child_process';import path from 'node:path';
if(process.env.BOSS_DISABLE_INFERENCE!=='1'||process.env.BOSS_PORT!=='4320'||!process.env.BOSS_DATA_DIR?.includes('page-close-tests'))throw new Error('僅可使用隔離測試環境');
await import('../server/index');
if(process.send)process.on('message',message=>{if(message==='verify-graceful-shutdown'){process.emit('SIGTERM','SIGTERM');process.disconnect?.()}});
const {children}=await import('../server/runner');
for(const id of ['worker-a','worker-b']){
 const file=path.join(process.env.BOSS_DATA_DIR,id+'-pids.json');
 const program=`const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true});fs.writeFileSync(process.argv[1],JSON.stringify({parent:process.pid,child:child.pid}));setInterval(()=>{},1000);`;
 const child=spawn(process.execPath,['-e',program,file],{windowsHide:true,stdio:'ignore'});children.set(id,child);
}
