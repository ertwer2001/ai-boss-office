import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
const base='http://127.0.0.1:4317';
const before=await (await fetch(base+'/api/state')).json();
assert(before.paused&&!before.tasks.some((t:any)=>t.state==='working'),'Only run UI verification in an idle, paused office');
const company=before.companies.find((c:any)=>c.type==='advisory');assert(company,'Create an advisory company first');
fs.mkdirSync('docs/screenshots',{recursive:true});fs.mkdirSync('docs/verification',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true,timeout:30000});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.screenshot({path:'docs/screenshots/tradingagents-before-select.png'});console.log('Office loaded');await page.locator('.co').filter({hasText:company.name}).click();
 console.log('Advisory company selected');
 await page.getByText('TradingAgents 投資研究室 · 手動開案',{exact:true}).click();
 await page.getByRole('button',{name:'重新檢查設定',exact:true}).click();
 await page.getByText('TradingAgents 連線尚未設定',{exact:false}).waitFor();
 assert(await page.getByRole('button',{name:'開始研究並交主管審查'}).isDisabled());
 assert.equal(await page.locator('form form').count(),0);
 await page.getByLabel('研究標的代碼',{exact:true}).fill('AAPL');
 await page.getByLabel('研究截止日期',{exact:true}).fill('2026-01-05');
 assert(await page.getByRole('button',{name:'開始研究並交主管審查'}).isDisabled(),'Missing model must never start research');
 await page.screenshot({path:'docs/screenshots/tradingagents-integration.png',fullPage:true});
 assert.deepEqual(errors,[]);
}finally{await browser.close()}
const after=await (await fetch(base+'/api/state')).json();assert.equal(after.tasks.length,before.tasks.length);assert(after.paused);
const result={at:new Date().toISOString(),company:company.name,ui:true,missingModelDisabled:true,noNestedForm:true,noModelCalls:true,noNewTasks:true,screenshot:'docs/screenshots/tradingagents-integration.png'};
fs.writeFileSync('docs/verification/tradingagents-ui.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
