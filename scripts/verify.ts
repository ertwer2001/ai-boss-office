import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';

const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function reservePort(){
 return await new Promise<number>((resolve,reject)=>{
  const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(error=>error?reject(error):resolve(typeof address==='object'&&address?address.port:0))});
 });
}

const root=fs.mkdtempSync(path.resolve('docs/verification','public-verify-'));
const port=await reservePort(),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{
 cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],
 env:{...process.env,BOSS_PORT:String(port),BOSS_DATA_DIR:path.join(root,'data'),BOSS_OUTPUT_DIR:path.join(root,'outputs'),BOSS_DISABLE_INFERENCE:'1',BOSS_CODEX_BIN:path.join(root,'missing-codex.exe'),LOCALAPPDATA:path.join(root,'empty-local'),APPDATA:path.join(root,'empty-roaming')}
});
let stdout='',stderr='';child.stdout.on('data',chunk=>stdout=(stdout+chunk).slice(-4000));child.stderr.on('data',chunk=>stderr=(stderr+chunk).slice(-4000));
try{
 let health:Response|undefined;
 for(let attempt=0;attempt<30;attempt++){
  try{health=await fetch(base+'/api/health');if(health.ok)break}catch{}
  await wait(200);
 }
 assert(health?.ok,`隔離服務未啟動：${stderr||stdout}`);
 const state=await fetch(base+'/api/state'),status=await fetch(base+'/api/status');
 assert.equal(state.status,200,'未安裝 Codex 時仍應可開啟辦公室');
 const snapshot=await state.json() as {boss:string;companies:{name:string}[];paused:boolean};
 const codex=await status.json() as {connected:boolean;models:unknown[]};
 assert.equal(snapshot.boss,'老闆');assert.equal(snapshot.companies[0]?.name,'AI 營運公司');assert.equal(snapshot.paused,true);
 assert.equal(codex.connected,false);assert.deepEqual(codex.models,[]);
 const company=await fetch(base+'/api/companies',{method:'POST',headers:{'Content-Type':'application/json','X-Boss-Office':'local'},body:JSON.stringify({name:'離線規畫公司',type:'studio'})});
 assert.equal(company.status,200,'未安裝 Codex 時仍應可建立公司設定');
 const researchStatus=await fetch(base+'/api/tradingagents/status');assert.equal(researchStatus.status,200);assert.equal((await researchStatus.json()).ready,false);
 const denied=await fetch(base+'/api/companies/not-present/trading-research',{method:'POST',headers:{'Content-Type':'application/json','X-Boss-Office':'local'},body:'{}'});assert.equal(denied.status,400,'沒有有效頁面不能啟動研究');
 console.log(JSON.stringify({http:true,noInference:true,codexOptional:true,port},null,2));
}finally{
 if(child.exitCode===null)child.kill('SIGTERM');
 for(let attempt=0;attempt<25&&child.exitCode===null;attempt++)await wait(100);
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(root,{recursive:true,force:true});
}
