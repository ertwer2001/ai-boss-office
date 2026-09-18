import type {Store,Task} from '../src/domain/company';
export function invalidate(task:Task){task.executionRevision=(task.executionRevision||0)+1}
export function allowed(s:Store,t:Task){const p=s.projects?.find(p=>p.id===t.projectId);return !s.paused&&!s.companies.find(c=>c.id===t.companyId)?.paused&&(!t.projectId||!!p&&!['blocked','stopped','completed'].includes(p.status))}
/** Invalidate before awaiting termination so late results cannot revive the job. */
export async function haltInactiveJobs(s:Store,versions:Map<string,number>,stop:(id:string)=>Promise<void>,changed:()=>void){
 const ids:string[]=[];
 for(const [id,version] of versions){const t=s.tasks.find(t=>t.id===id);if(!t||allowed(s,t)&&(t.executionRevision||0)===version&&t.state!=='cancelled')continue;
  if((t.executionRevision||0)===version)invalidate(t);
  if(t.state==='working'){t.state='blocked';t.stage='已暫停執行';t.error='專案已暫停，執行結果不再採納；手動繼續後才能重新工作'}
  ids.push(id);
 }
 if(!ids.length)return;
 changed();const results=await Promise.allSettled(ids.map(stop));
 if(results.some(r=>r.status==='rejected'))throw new Error('部分工作程序尚未確認停止，請按全部停止重試');
}
