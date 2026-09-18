import type {Company,Employee} from '../domain/company';
import {roleProfiles,resolveProfile} from '../domain/roleProfiles';
export function RoleProfilePicker({employee,company,onChange}:{employee:Employee;company:Company;onChange:(profileId:string)=>void}){
 const selected=resolveProfile(employee,company.type,company.employees[0]?.id===employee.id);
 return <><label className="field">專業角色模板<select aria-label="專業角色模板" value={employee.profileId||'auto'} onChange={e=>onChange(e.target.value)}><option value="auto">依職位自動套用（新案件）</option><option value="none">不套用模板，使用職位說明</option>{roleProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><p className="exp">{selected?`將套用：${selected.name}。${selected.summary}`:'目前職位沒有預設模板，沿用職位說明。'} 姓名、模型與強度分開設定；既有案件不變。</p>{selected&&<details><summary>查看模板職責與能力限制</summary><p>{selected.instructions}</p><p className="exp">Agency Agents 適配版 · MIT。只補充工作方法，不會增加工具、額度或背景派工。</p></details>}</>;
}
