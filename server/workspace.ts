import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {getQuickJS} from 'quickjs-emscripten';
import Papa from 'papaparse';
export const digest=(text:string)=>crypto.createHash('sha256').update(text).digest('hex');
export function safePath(root:string,name:string){
 if(!name||name.length>160||/[\\:\x00-\x1f]/.test(name)||path.isAbsolute(name)||name.split('/').some(x=>!x||x==='.'||x==='..'||/[. ]$/.test(x)||/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(x)))throw new Error('檔案路徑不合法');
 const p=path.resolve(root,name),r=path.resolve(root);
 if(!p.startsWith(r+path.sep))throw new Error('檔案必須位於此任務的工作區');
 for(let c=p;c!==r;c=path.dirname(c))if(fs.existsSync(c)&&fs.lstatSync(c).isSymbolicLink())throw new Error('不接受符號連結');
 return p;
}
export function saveFile(root:string,name:string,content:string){const p=safePath(root,name);if(Buffer.byteLength(content)>250000)throw new Error('單檔超過 250 KB');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content,'utf8');return digest(fs.readFileSync(p,'utf8'))}
export async function checkCode(code:string,files:Record<string,string>){
 const Q=await getQuickJS(),runtime=Q.newRuntime();runtime.setMemoryLimit(32*1024*1024);runtime.setMaxStackSize(512*1024);const deadline=Date.now()+2000;runtime.setInterruptHandler(()=>Date.now()>deadline);const vm=runtime.newContext();
 try{
  const prefix=`const __files=${JSON.stringify(files)};const __logs=[];const console={log:(...a)=>__logs.push(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '))};function assert(ok,message='Assertion failed'){if(!ok)throw new Error(message)};function readFile(p){if(!(p in __files))throw new Error('File not found: '+p);return __files[p]};const __cache={};function require(p){p=p.replace(/^\\.\\//,'');if(p in __cache)return __cache[p];const module={exports:{}};new Function('module','exports','require',readFile(p))(module,module.exports,require);return __cache[p]=module.exports;};`;
  const r=vm.evalCode(prefix+'\n'+code+'\nJSON.stringify(__logs)');
  if(r.error){const e=vm.dump(r.error);r.error.dispose();return {passed:false,output:typeof e==='object'?e.message||JSON.stringify(e):String(e)}}
  const output=vm.getString(r.value);r.value.dispose();return {passed:true,output:output.slice(0,16000)};
 }finally{vm.dispose();runtime.dispose()}
}
export function csvStats(csv:string){
 const parsed=Papa.parse<Record<string,string>>(csv,{header:true,skipEmptyLines:true});
 if(parsed.errors.length)throw new Error('CSV 格式錯誤：'+parsed.errors[0].message);
 if(!parsed.meta.fields?.length||!parsed.data.length)throw new Error('CSV 至少需要欄位名稱與一列資料');
 return {rows:parsed.data.length,columns:parsed.meta.fields.map(name=>{let missing=0;const values:number[]=[];let nonNumeric=0;for(const r of parsed.data){const v=r[name]?.trim();if(!v){missing++;continue}const n=Number(v);if(!Number.isFinite(n))nonNumeric++;else values.push(n)}return {name,missing,nonNumeric,numericCount:values.length,...(values.length&&!nonNumeric?{sum:values.reduce((a,b)=>a+b,0),min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length}:{})}})};
}
