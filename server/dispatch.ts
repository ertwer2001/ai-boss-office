import type {Company,Model,Store,Task} from '../src/domain/company';
import {autoEligibility,suggestedTask,type AutoTask,type PlannedTask,taipeiDay} from '../src/domain/recommendations';
export function enqueue(store:Store,co:Company,command:string,plans:PlannedTask[],models:Model[],input?:string,origin:'manual'|'automatic'='manual',now=Date.now()){
 if(store.paused)throw new Error('公司已暫停，請先恢復派工');
 if(co.paused)throw new Error('這家公司正在休息，請先恢復手動工作');
 if(store.tasks.filter(t=>taipeiDay(t.createdAt)===taipeiDay(now)).length+plans.length>store.maxTasksPerDay)throw new Error('已達每日任務上限');
 for(const p of plans)if(!co.employees.some(e=>e.id===p.employeeId)||!models.some(m=>m.id===p.model&&m.efforts.includes(p.effort)))throw new Error('員工、模型或推理強度設定不合法');
 const made:AutoTask[]=[];
 for(const p of plans){const id=crypto.randomUUID();made.push({id,companyId:co.id,employeeId:p.employeeId,title:p.title,command,dependsOn:made.length?[made.at(-1)!.id]:[],state:'queued',stage:origin==='automatic'?'自動安排，等待執行':made.length?'等待前一位員工交付':'等待執行',model:p.model,effort:p.effort,createdAt:new Date(now).toISOString(),logs:p.reason?[{at:new Date(now).toISOString(),text:`${origin==='automatic'?'自動派工':'派工建議'}：${p.reason}；${p.model} / ${p.effort}`}]:[],files:[],sources:[],attempt:0,input,external:origin==='manual'&&/發布|發文|寄信|投放|上架|部署|對外|publish|send email|deploy/i.test(p.title),origin,suggestionId:p.suggestionId})}
 store.tasks.push(...made);return made;
}
export function enqueueAutomatic(store:Store,models:Model[],now=Date.now()):Task|undefined{
 for(const co of store.companies){const eligibility=autoEligibility(co,store,now);if(!eligibility.ready||!eligibility.suggestion)continue;
  const plan=suggestedTask(co,eligibility.suggestion,models);
  const task=enqueue(store,co,`老闆給最高負責人的指令：${co.autoDispatch?.instruction}\n無進行中目標時的自動工作：${plan.title}`,[plan],models,undefined,'automatic',now)[0];
  co.autoDispatch!.lastDispatchedAt=new Date(now).toISOString();co.autoDispatch!.lastError=undefined;return task;
 }
}
export function cancelQueuedAuto(co:Company,tasks:Task[],reason:string){for(const t of tasks as AutoTask[])if(t.companyId===co.id&&t.origin==='automatic'&&t.state==='queued'){t.state='cancelled';t.stage=reason}}
