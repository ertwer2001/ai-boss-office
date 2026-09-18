import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
const evidence=JSON.parse(fs.readFileSync('docs/verification/browser-acceptance-result.json','utf8'));
const root=path.resolve(evidence.fixtureRoot),expected=path.resolve('docs/verification/browser-acceptance')+path.sep;
if(!root.startsWith(expected))throw new Error('驗證資料路徑不符');
const data=path.join(root,'ui-state');fs.mkdirSync(data,{recursive:true});fs.copyFileSync(path.join(root,'state.json'),path.join(data,'company.json'));fs.cpSync(path.join(root,'verification'),path.join(data,'verification'),{recursive:true});
const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{cwd:process.cwd(),env:{...process.env,BOSS_PORT:'4321',BOSS_DATA_DIR:data,BOSS_OUTPUT_DIR:path.join(root,'outputs'),BOSS_DISABLE_INFERENCE:'1'},windowsHide:true,detached:true,stdio:'ignore'});child.unref();
let ready=false;for(let i=0;i<40;i++){try{const h=await (await fetch('http://127.0.0.1:4321/api/health')).json();if(h.pid===child.pid){fs.writeFileSync('docs/verification/browser-ui-service.json',JSON.stringify({pid:child.pid,data,url:'http://127.0.0.1:4321',noModelInference:true},null,2));console.log(JSON.stringify(h));ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}if(!ready)throw new Error('隔離 UI 服務未啟動');
