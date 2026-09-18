import {ready,type Store,type Task} from '../src/domain/company';
/** Reserve different employees, honor reviewed dependencies and the office-wide concurrency limit. */
export function selectReadyTasks(s:Store,active:Set<string>):Task[]{
 if(s.paused)return [];
 const room=Math.max(0,(s.maxConcurrentTasks||2)-active.size),people=new Set(s.tasks.filter(t=>active.has(t.id)||t.state==='working').map(t=>t.employeeId));
 const result:Task[]=[];
 const candidates=s.tasks.slice().sort((a,b)=>Number(b.kind!=='work')-Number(a.kind!=='work'));
 for(const t of candidates){if(result.length>=room)break;if(active.has(t.id)||people.has(t.employeeId)||!ready(t,s.tasks)||s.companies.find(c=>c.id===t.companyId)?.paused)continue;
  const p=s.projects?.find(p=>p.id===t.projectId);if(t.projectId&&(!p||['blocked','completed','stopped'].includes(p.status)))continue;
  people.add(t.employeeId);result.push(t);
 }
 return result;
}
export function launchReadyJobs(s:Store,active:Set<string>,run:(t:Task)=>Promise<void>,changed:()=>void){
 const selected=selectReadyTasks(s,active);
 for(const t of selected){t.state='working';t.stage=t.kind&&t.kind!=='work'?'主管正在'+({plan:'規畫',review:'審查',consult:'決定方向','final-review':'整案驗收'}[t.kind]):'員工正在製作';active.add(t.id);changed();void run(t).catch(e=>{if(t.state!=='cancelled'){t.state='blocked';t.error=(e as Error).message}}).finally(()=>{active.delete(t.id);changed()})}
 return selected;
}
