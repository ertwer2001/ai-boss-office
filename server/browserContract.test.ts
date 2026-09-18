import {it,expect} from 'vitest';
import {browserContract} from './browserContract';
export const counterContract={entryStep:0,entryPath:'index.html',requirements:['累加與重設'],scenarios:[{name:'按一次累加',requirement:'累加與重設',kind:'happy',steps:[{action:'click',selector:'#add',value:''},{action:'text',selector:'#result',value:'1'}]},{name:'空白起點可重設',requirement:'累加與重設',kind:'edge',steps:[{action:'click',selector:'#reset',value:''},{action:'text',selector:'#result',value:'0'}]}]};
it('操作契約拒絕程式執行、任意 selector、無操作及未覆蓋功能',()=>{
 expect(browserContract.safeParse(counterContract).success).toBe(true);
 for(const edit of [
  (c:any)=>c.scenarios[0].steps[0].action='evaluate',
  (c:any)=>c.scenarios[0].steps[0].selector='body > script',
  (c:any)=>c.scenarios[0].steps[0].action='text',
  (c:any)=>c.requirements.push('儲存'),
  (c:any)=>c.scenarios[1].kind='happy',
  (c:any)=>c.scenarios[0].steps[1].value='',
 ]){const c=structuredClone(counterContract);edit(c);expect(browserContract.safeParse(c).success).toBe(false)}
});
