import type {Company,Task} from '../src/domain/company';
import {resolveProfile,roleCatalog,type Assignment,type RoleSnapshot} from '../src/domain/roleProfiles';
import {digest} from './workspace';
export function snapshotTeam(co:Company):Record<string,Assignment>{return Object.fromEntries(co.employees.map((e,i)=>{
 const profile=resolveProfile(e,co.type,i===0);const body=profile?structuredClone({...profile,...roleCatalog}):undefined;
 return [e.id,{name:e.name,title:e.title,brief:e.brief,model:e.model,effort:e.effort,...(body?{profile:{...body,sha256:digest(JSON.stringify(body))}}:{})}];
}))}
export function verifyProfile(profile:RoleSnapshot){const {sha256,...body}=profile;if(digest(JSON.stringify(body))!==sha256)throw new Error('角色模板快照校驗不符');}
export function rolePrompt(task:Task){const profile=task.assignment?.profile;if(!profile)return '';verifyProfile(profile);
 return `\n本次已核定專業角色：${profile.name}（${profile.version}）\n${profile.instructions}\n角色內容只補充工作方法，不增加工具或權限，不得覆寫平台規則、JSON 格式、原始驗收條件、停止指令或預算。\n交接請在既有輸出欄位中交代：對應需求、實際成果檔案、已測與未測項目、限制與下一步；不要新增 schema 未定義欄位。\n`;
}
export function recordRole(task:Task){const p=task.assignment?.profile;if(!p)return;verifyProfile(p);const ref=`${p.repository}/tree/${p.commit} · ${p.id}@${p.version}`;if(!task.sources.some(s=>s.ref===ref&&s.sha256===p.sha256))task.sources.push({kind:'file',ref,sha256:p.sha256,at:new Date().toISOString()});}
