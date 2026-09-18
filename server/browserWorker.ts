import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {chromium,expect,type Browser,type BrowserContext,type Page} from '@playwright/test';
import {browserContract,type BrowserEvidence,type BrowserScenarioEvidence} from './browserContract';
import {previewPolicy} from './delivery';
import {digest} from './workspace';

// Runs in an owned subprocess. The parent terminates this entire tree on stop/timeout.
const fileHash=(file:string)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
async function validate(html:string,raw:unknown,evidenceId:string,artifactFolder:string,artifactPrefix:string):Promise<BrowserEvidence>{
 const contract=browserContract.parse(raw);
 if(!/^[a-f0-9-]{36}$/.test(evidenceId)||!path.isAbsolute(artifactFolder)||!/^verification\/[a-f0-9-]+\/[a-f0-9-]+$/.test(artifactPrefix))throw new Error('驗收證據路徑不合法');
 fs.mkdirSync(artifactFolder,{recursive:true});
 const evidence:BrowserEvidence={version:2,evidenceId,at:new Date().toISOString(),status:'error',htmlSha256:digest(html),contractSha256:digest(JSON.stringify(contract)),environment:'Edge headless / 1280×900 / sandbox allow-scripts / no network or persistent storage',scenarios:[],errors:[]};
 let browser:Browser|undefined;
 try{
  browser=await chromium.launch({channel:'msedge',headless:true,timeout:15000,args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
  process.send?.({type:'ready'});
  for(const scenario of contract.scenarios){
   let context:BrowserContext|undefined,page:Page|undefined,traceStarted=false;const failures:string[]=[];let completed=0;
   const record:BrowserScenarioEvidence={name:scenario.name,requirement:scenario.requirement,kind:scenario.kind,passed:false,steps:0,stepResults:[]};
   try{
    // The opaque-origin sandbox itself forbids service workers. Playwright's
    // serviceWorkers:'block' init script accesses navigator.serviceWorker and throws
    // inside that sandbox, producing a harness error on otherwise valid HTML.
    context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:false});
    await context.tracing.start({screenshots:true,snapshots:true});traceStarted=true;
    context.setDefaultTimeout(1800);
    await context.routeWebSocket('**/*',socket=>{failures.push('作品嘗試開啟網路連線');socket.close()});
    let harnessServed=false,artifactServed=false;
    await context.route('**/*',async route=>{
     const url=route.request().url();
     if(url==='https://office-acceptance.invalid/'&&!harnessServed){harnessServed=true;await route.fulfill({contentType:'text/html',body:'<!doctype html><iframe title="作品" sandbox="allow-scripts" style="width:100%;height:850px" src="/artifact"></iframe>'});}
     else if(url==='https://office-acceptance.invalid/artifact'&&!artifactServed){artifactServed=true;await route.fulfill({contentType:'text/html; charset=utf-8',headers:{'Content-Security-Policy':previewPolicy},body:'<!doctype html>\n'+html});}
     else{failures.push('作品要求不允許的資源或導向');await route.abort();}
    });
    page=await context.newPage();
    page.on('pageerror',e=>failures.push(e.message.slice(0,1000)));
    page.on('console',m=>{if(m.type()==='error')failures.push(m.text().slice(0,1000))});
    page.on('download',d=>{failures.push('目前作品環境不允許內嵌下載');void d.cancel()});
    page.on('dialog',d=>{failures.push('請以頁面訊息呈現結果，不使用阻塞對話框');void d.dismiss()});
    page.on('framenavigated',frame=>{if(!['about:blank','https://office-acceptance.invalid/','https://office-acceptance.invalid/artifact'].includes(frame.url()))failures.push('作品離開驗收頁面');});
    await page.goto('https://office-acceptance.invalid/',{waitUntil:'load',timeout:8000});
    const frame=page.frameLocator('iframe');
    for(const step of scenario.steps){
     try{const loc=frame.locator(step.selector);await expect(loc).toHaveCount(1,{timeout:1800});
      if(['text','value'].includes(step.action))await expect(loc).toBeVisible({timeout:1800});
      switch(step.action){case 'click':await loc.click();break;case 'fill':await loc.fill(step.value);break;case 'select':await loc.selectOption(step.value);break;case 'check':await loc.check();break;case 'uncheck':await loc.uncheck();break;case 'text':await expect(loc).toHaveText(step.value,{timeout:1800});break;case 'value':await expect(loc).toHaveValue(step.value,{timeout:1800});break;case 'visible':await expect(loc).toBeVisible({timeout:1800});break;case 'hidden':await expect(loc).toBeHidden({timeout:1800});break;}
      completed++;record.stepResults!.push({action:step.action,selector:step.selector,...(step.value?{expected:step.value}:{}),passed:true,detail:['text','value','visible','hidden'].includes(step.action)?'符合預期':'已完成操作'});
     }catch(e){record.stepResults!.push({action:step.action,selector:step.selector,...(step.value?{expected:step.value}:{}),passed:false,detail:(e as Error).message.slice(0,500)});throw e}
    }
    // Capture errors queued by the last event handler, not just its synchronous DOM update.
    await page.waitForTimeout(100);
    if(failures.length)throw new Error([...new Set(failures)].join('\n'));
    record.passed=true;
   }catch(e){record.error=[...new Set(failures),(e as Error).message].join('\n').slice(0,3000);}
   finally{
    record.steps=completed;const n=String(evidence.scenarios.length+1).padStart(2,'0');
    if(page){const name=`scenario-${n}.png`,file=path.join(artifactFolder,name);try{await page.screenshot({path:file,fullPage:true});record.screenshotPath=`${artifactPrefix}/${name}`;record.screenshotSha256=fileHash(file)}catch(e){record.error=[record.error,`無法保存驗收畫面：${(e as Error).message}`].filter(Boolean).join('\n').slice(0,3000);record.passed=false}}
    if(context&&traceStarted){if(record.passed)await context.tracing.stop();else{const name=`scenario-${n}-failure.zip`,file=path.join(artifactFolder,name);try{await context.tracing.stop({path:file});record.tracePath=`${artifactPrefix}/${name}`;record.traceSha256=fileHash(file)}catch(e){record.error=[record.error,`無法保存失敗追蹤：${(e as Error).message}`].filter(Boolean).join('\n').slice(0,3000)}}}
    await context?.close();evidence.scenarios.push(record);
   }
  }
  evidence.status=evidence.scenarios.length===contract.scenarios.length&&evidence.scenarios.every(s=>s.passed)?'pass':'fail';
 }catch(e){evidence.errors.push((e as Error).message.slice(0,3000));evidence.status='error';}
 finally{await browser?.close();}
 return evidence;
}
process.once('message',async(message:{html:string;contract:unknown;evidenceId:string;artifactFolder:string;artifactPrefix:string})=>{
 try{const evidence=await validate(message.html,message.contract,message.evidenceId,message.artifactFolder,message.artifactPrefix);process.send?.({type:'result',evidence});}
 catch(e){process.send?.({type:'error',error:(e as Error).message});}
 finally{process.disconnect();}
});
