import fs from 'node:fs';
const base='http://127.0.0.1:4317/api';
async function api(p:string,method='GET',body?:unknown){const r=await fetch(base+p,{method,headers:{'Content-Type':'application/json','X-Boss-Office':'local'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d}
const co=await api('/companies','POST',{name:'實作驗收室','type':'studio'});
const engineer=co.employees[1],editor=co.employees[4];
await api('/employees/'+engineer.id,'PATCH',{...engineer,effort:'low'});
await api('/employees/'+editor.id,'PATCH',{...editor,effort:'low'});
const command='驗收任務：製作一個 CommonJS calculator.js，匯出 add 與 divide，除數為 0 必須拋錯，並附 3 個使用 require 的行為測試；然後根據程式交付內容撰寫簡短使用說明.md。';
const result=await api('/dispatch','POST',{companyId:co.id,command,tasks:[{employeeId:engineer.id,title:'製作 calculator.js：匯出 add(a,b) 與 divide(a,b)，除數為 0 拋錯；附 3 個 require 程式的行為測試，程式保持精簡。'},{employeeId:editor.id,title:'讀取前一位員工的 calculator.js，撰寫使用說明.md，包含實際函數名称與除以 0 的行為。不要重新產生 JS 檔案。'}]});
fs.mkdirSync('docs/verification',{recursive:true});fs.writeFileSync('docs/verification/live-dispatch.json',JSON.stringify({companyId:co.id,...result},null,2));
console.log(JSON.stringify({companyId:co.id,...result}));
