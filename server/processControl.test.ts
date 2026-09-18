import {it,expect} from 'vitest';
import {spawn} from 'node:child_process';
import {terminateOwnedProcess} from './processControl';
it('實際停止持有的測試程序及子程序，保留無關程序（不呼叫模型）',async()=>{
 const unrelated=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true});
 const parent=spawn(process.execPath,['-e',`const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});console.log(c.pid);setInterval(()=>{},1000)`],{windowsHide:true});
 try{const childPid=await new Promise<number>((resolve,reject)=>{parent.once('error',reject);parent.stdout!.once('data',d=>resolve(Number(d.toString().trim())))});const first=terminateOwnedProcess(parent),second=terminateOwnedProcess(parent);expect(first).toBe(second);await Promise.all([first,second]);expect(()=>process.kill(childPid,0)).toThrow();expect(()=>process.kill(unrelated.pid!,0)).not.toThrow()}
 finally{await terminateOwnedProcess(parent);await terminateOwnedProcess(unrelated)}
},15000);
