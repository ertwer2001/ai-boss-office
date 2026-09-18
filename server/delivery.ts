import fs from 'node:fs';import path from 'node:path';
import type {Project,Store,Task} from '../src/domain/company';
import {safePath,saveFile,digest} from './workspace';
export interface Delivery {summary:string;howToUse:string[];limitations:string[];entryTaskId:string;entryPath:string}
export function validateDelivery(d:Delivery|undefined,works:Task[],read:(t:Task)=>Record<string,string>,goal=''){
 if(!d?.summary.trim()||!d.howToUse.length)throw new Error('主管尚未提供白話成果說明與使用步驟');
 const task=works.find(t=>t.id===d.entryTaskId);if(!task||!Object.hasOwn(read(task),d.entryPath))throw new Error('主管指定的主要成果不存在');
 if(/(?:製作|開發|建立|實作|做).*(?:APP|網站|網頁)|(?:APP|網站|網頁).*(?:製作|開發|建立|實作)/i.test(goal)&&!/\.html?$/i.test(d.entryPath))throw new Error('目標需要可操作的 APP／網頁，不能用規格文件作為主要成果');
}
export function requirePublished(s:Store,t:Task|undefined){if(!t)throw new Error('找不到成果');if(t.projectId&&s.projects?.find(p=>p.id===t.projectId)?.status!=='completed')throw new Error('尚未完成整案交付，不能下載內部草稿');return t}
export function writeDeliveryGuide(p:Project,outputRoot:string){
 const d=p.delivery!;const content=`# ${p.title}\n\n## 已經做好什麼\n\n${d.summary}\n\n## 怎麼使用\n\n${d.howToUse.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n## 限制與尚未完成事項\n\n${d.limitations.length?d.limitations.map(x=>'- '+x).join('\n'):'主管未列出其他限制；實際驗收範圍請參閱審查紀錄。'}\n`;
 const validation=p.browserEvidence?`\n## 實際操作驗收\n\n${p.browserEvidence.scenarios.map(x=>`- ${x.passed?'通過':'未通過'}：${x.name}`).join('\n')}\n\n驗收範圍：離線單檔 HTML，桌面瀏覽器預覽；僅表示上述情境已實測，不代表所有可能輸入、手機版或外部服務都已驗證。關閉頁面不保留作品輸入資料。\n`:'';
 p.deliveryGuide=`文件/${p.companyId}/專案/${p.id}/交付說明.md`;saveFile(outputRoot,p.deliveryGuide,content+validation);
}
export function findDelivered(s:Store,projectId:string){const p=s.projects?.find(p=>p.id===projectId);if(!p||p.status!=='completed')throw new Error('尚未完成整案驗收');return p}
export function entryFile(s:Store,p:Project){const t=s.tasks.find(t=>t.id===p.delivery?.entryTaskId&&t.projectId===p.id);if(!t)throw new Error('此舊專案未指定主要成果，請展開檔案清單');const i=t.files.findIndex(f=>f.endsWith(`/${t.id}/v${t.attempt}/${p.delivery!.entryPath}`));if(i<0)throw new Error('找不到已交付的主要成果');return {task:t,index:i,path:t.files[i]}}
export const previewPolicy="sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
export function readPublished(t:Task,file:string,root:string){const content=fs.readFileSync(safePath(root,file),'utf8');const source=t.sources.find(x=>x.ref===file&&x.sha256);if(!source||source.sha256!==digest(content))throw new Error('正式成果校驗不符');return content}
export function previewHtml(s:Store,p:Project,root:string){
 const entry=entryFile(s,p);if(!/\.html?$/i.test(entry.path))throw new Error('此成果不是網頁，請閱讀文件或下載');
 const content=readPublished(entry.task,entry.path,root);
 // Only reviewed, self-contained HTML is previewed. The CSP blocks networks, frames, forms and parent access.
 return '<!doctype html>\n'+content;
}
