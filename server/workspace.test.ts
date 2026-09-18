import {describe,it,expect} from 'vitest';
import {safePath,checkCode,csvStats} from './workspace';
import {quotaLow} from './codex';
describe('工作區保護與實際計算',()=>{
 it.each(['../secrets','C:/secrets','/etc/passwd','a\\b','a:stream','a/../../outside','CON.txt','folder./x'])('拒絕不安全檔案路徑 %s',p=>expect(()=>safePath('D:/test',p)).toThrow());
 it('執行交付程式並驗證結果',async()=>expect(await checkCode("const {sum}=require('./math.js');assert(sum(2,3)===5);console.log('passed')",{'math.js':'exports.sum=(a,b)=>a+b'})).toEqual({passed:true,output:'["passed"]'}));
 it('行為錯誤不可通過',async()=>expect((await checkCode("assert(require('math.js').sum(2,3)===5)",{'math.js':'exports.sum=(a,b)=>a-b'})).passed).toBe(false));
 it('沙盒沒有主機或網路能力',async()=>expect((await checkCode("assert(typeof process==='undefined');assert(typeof fetch==='undefined');assert(typeof WebSocket==='undefined');let denied=false;try{require('node:fs')}catch{denied=true}assert(denied)",{})).passed).toBe(true));
 it('停止無窮迴圈',async()=>expect((await checkCode('while(true){}',{})).passed).toBe(false));
 it('CSV 缺值不補零，支援引號逗號',()=>{const r=csvStats('name,value\n"a,b",10\nb,\nc,20');expect(r.rows).toBe(3);expect(r.columns[1]).toMatchObject({missing:1,numericCount:2,mean:15,sum:30})});
 it('只在已知額度剩餘 2% 以下停止',()=>{expect(quotaLow(null)).toBe(false);expect(quotaLow({rateLimits:{primary:{usedPercent:98}}})).toBe(true);expect(quotaLow({rateLimits:{primary:{usedPercent:97}}})).toBe(false)});
});
