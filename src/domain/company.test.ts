import {describe,it,expect} from 'vitest';
import {makeCompany,plan,ready,employeeState,type Task} from './company';
const models=[{id:'gpt-6-astra',name:'Astra',efforts:['medium','high'],defaultEffort:'medium'},{id:'gpt-5.6-sol',name:'Sol',efforts:['low','high'],defaultEffort:'low'}];
describe('派工與接力',()=>{
 it('公司與員工有獨立身分且預設強度合法',()=>{const a=makeCompany('A','studio',models),b=makeCompany('B','studio',models);expect(a.employees[0].id).not.toBe(b.employees[0].id);expect(a.employees.every(e=>models.find(m=>m.id===e.model)?.efforts.includes(e.effort))).toBe(true)});
 it('依工作內容分派並保留依序任務',()=>{const co=makeCompany('A','studio',models);const p=plan(co,'開發程式然後撰寫文案');expect(p).toHaveLength(2);expect(p[0].employeeId).toBe(co.employees[1].id);expect(p[1].employeeId).toBe(co.employees[4].id)});
 it('前置工作待驗收不提前執行',()=>{const parent={id:'1',state:'approve'} as Task;const next={state:'queued',dependsOn:['1']} as Task;expect(ready(next,[parent])).toBe(false);parent.state='done';expect(ready(next,[parent])).toBe(true)});
 it('卡關優先於工作狀態',()=>expect(employeeState([{employeeId:'x',state:'working'},{employeeId:'x',state:'blocked'}] as Task[],'x')).toBe('blocked'));
});
