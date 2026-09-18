import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import type {Model} from '../src/domain/company';
export function codexBinary(){
 if(process.env.BOSS_CODEX_BIN&&existsSync(process.env.BOSS_CODEX_BIN))return process.env.BOSS_CODEX_BIN;
 const desktop=path.join(process.env.LOCALAPPDATA||'', 'OpenAI/Codex/bin');
 if(existsSync(desktop))for(const p of readdirSync(desktop).reverse()){const bin=path.join(desktop,p,'codex.exe');if(existsSync(bin))return bin}
 const root=path.join(process.env.APPDATA||'', 'npm/node_modules/@openai/codex/node_modules/@openai');
 if(existsSync(root))for(const p of readdirSync(root)){const bin=path.join(root,p,'vendor/x86_64-pc-windows-msvc/bin/codex.exe');if(existsSync(bin))return bin}
 throw new Error('找不到 Codex CLI，請先安裝並使用 codex login 登入。');
}
export class CodexControl{
 child?:ChildProcessWithoutNullStreams; next=1; pending=new Map<number,{resolve:(x:any)=>void;reject:(e:Error)=>void}>(); connecting?:Promise<void>;
 async connect(){
  if(this.connecting)return this.connecting;
  this.connecting=(async()=>{
   this.child=spawn(codexBinary(),['app-server'],{windowsHide:true,stdio:'pipe'});
   this.child.stderr.resume();
   createInterface({input:this.child.stdout}).on('line',line=>{try{const m=JSON.parse(line),p=this.pending.get(m.id);if(p){this.pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}catch{}});
   this.child.on('error',e=>this.fail(e));this.child.on('exit',()=>this.fail(new Error('Codex 連線中斷')));
   await this.rpc('initialize',{clientInfo:{name:'boss_office',version:'1.0.0'},capabilities:{experimentalApi:true}});
   this.child.stdin.write(JSON.stringify({method:'initialized'})+'\n');
  })();
  try{await this.connecting}catch(e){this.connecting=undefined;throw e}
 }
 fail(e:Error){for(const p of this.pending.values())p.reject(e);this.pending.clear();this.connecting=undefined;this.child=undefined}
 rpc(method:string,params:unknown):Promise<any>{return new Promise((resolve,reject)=>{
  const id=this.next++,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`${method} 連線逾時`))},20000);
  this.pending.set(id,{resolve:x=>{clearTimeout(timer);resolve(x)},reject:e=>{clearTimeout(timer);reject(e)}});
  this.child!.stdin.write(JSON.stringify({id,method,params})+'\n');
 })}
 async status(){await this.connect();const [catalog,account,quota]=await Promise.all([this.rpc('model/list',{limit:100,includeHidden:false}),this.rpc('account/read',{refreshToken:false}),this.rpc('account/rateLimits/read',{}).catch(()=>null)]);
  const models:Model[]=catalog.data.filter((m:any)=>!m.hidden).map((m:any)=>({id:m.model,name:m.displayName,efforts:m.supportedReasoningEfforts.map((e:any)=>e.reasoningEffort),defaultEffort:m.defaultReasoningEffort}));
  return {connected:!!account.account,authType:account.account?.type||'none',models,quota,checkedAt:new Date().toISOString()};
 }
 close(){this.child?.kill()}
}
export const control=new CodexControl();
export function quotaLow(quota:any):boolean{
 const limits=quota?.rateLimitsByLimitId?Object.values(quota.rateLimitsByLimitId):quota?.rateLimits?[quota.rateLimits]:[];
 return limits.some((l:any)=>[l.primary,l.secondary].some(w=>w&&typeof w.usedPercent==='number'&&w.usedPercent>=98));
}
