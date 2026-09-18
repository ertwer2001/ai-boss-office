import {completeCount,plan,types,type Company,type CompanyType,type Employee,type Model,type Task,type Store,type AutoDispatch} from './company';
export interface Suggestion {id:string;label:string;title:string;role:string;model:string;effort:string;reason:string;auto:boolean}
export interface PlannedTask {title:string;employeeId:string;model:string;effort:string;reason?:string;suggestionId?:string;dependsOn?:number[]}
export type AutoTask=Task&{origin?:'manual'|'automatic';suggestionId?:string};
const s=(id:string,label:string,title:string,role:string,model:string,effort:string,reason:string,auto=true):Suggestion=>({id,label,title,role,model,effort,reason,auto});
export const suggestions:Record<CompanyType,Suggestion[]>={
 studio:[
  s('studio-service','規畫工作室服務','製作 AI 工作室服務目錄與交付驗收清單，區分目前可做的文件、JavaScript 與 CSV 能力；交付 Markdown，不虛構客戶或營收。','營運總監','gpt-6-astra','high','主管規畫服務與驗收範圍'),
  s('studio-code','製作可重用小工具','開發一個 JavaScript CommonJS 任務清單工具，提供新增與完成任務函數，交付程式、使用說明與 require 載入程式的行為測試。','軟體工程師','gpt-5.6-sol','high','程式實作與行為驗證'),
  s('studio-guide','整理需求訪談表','撰寫 AI 工作室客戶需求訪談表與專案交接範本，交付可直接填寫的 Markdown，不填入虛構客戶資料。','內容編輯','gpt-5.6-luna','medium','例行文件與範本整理'),
  s('studio-data','分析提供的 CSV','分析我提供的 CSV 資料，列出缺值與工具計算結果，交付統計報告；沒有資料時說明需要的欄位。','資料分析師','gpt-5.6-terra','high','根據實際資料作分析',false)
 ],
 advisory:[
  s('advisory-source','建立研究來源清單','製作自用投資研究的資料來源登錄範本，含交易日、發布日、取得時間與來源欄位。只做空白範本，不聲稱已取得最新行情，不執行回測或交易。','研究總監','gpt-6-astra','high','研究主管建立資料與交付規格'),
  s('advisory-risk','建立風險檢查表','製作自用研究的資料缺口與風險檢查表，列出前視偏誤、樣本外驗證、缺值與來源查證項目，交付 Markdown。不要產生績效或買賣建議。','風控專員','gpt-5.6-terra','high','研究方法與風險檢查'),
  s('advisory-report','製作研究報告範本','製作自用研究週報的空白 Markdown 範本，區分來源事實、推論、未驗證項目與待辦。不要填入個股、價格、回測數字或法律結論。','內容編輯','gpt-5.6-luna','medium','報告結構整理'),
  s('advisory-review','檢查提供的研究資料','檢查我提供的研究資料日期、來源與結論證據，列出可核實與尚缺項目；缺行情或策略定義就停下說明，不執行 Wave60。','產業分析師','gpt-5.6-terra','high','提供資料後進行研究核對',false)
 ],
 marketing:[
  s('marketing-plan','建立行銷企畫架構','製作行銷公司專案企畫與客戶需求表，含受眾、訊息、素材、驗收欄位。未知品牌資料留白，不虛構成效；交付 Markdown。','行銷總監','gpt-6-astra','high','行銷策略與交付規畫'),
  s('marketing-copy','製作文案工作範本','製作三種可填寫的行銷文案範本與用語檢查清單，未知品牌用明確占位欄位，不使用虛構見證；交付 Markdown。','文案企劃','gpt-5.6-luna','medium','文案產出與格式整理'),
  s('marketing-calendar','規畫內容工作流程','製作社群內容企畫表 CSV 範本與編輯審閱流程 Markdown。只安排內部工作，不連接帳號或發送內容。','社群經營','gpt-5.6-terra','medium','內容排程與欄位設計'),
  s('marketing-analysis','分析行銷資料','分析我提供的行銷 CSV，根據工具數據整理成效與資料缺口，不編造轉換率；交付報告。','市場研究員','gpt-5.6-terra','high','行銷資料分析',false)
 ],
 ecommerce:[
  s('ecommerce-ops','建立電商營運流程','製作電商商品資料準備與內部驗收 SOP，標示需要老闆提供的商品、物流與政策資料；交付 Markdown，不更動平台後台。','營運長','gpt-6-astra','high','跨職位營運流程規畫'),
  s('ecommerce-product','製作商品資料範本','製作商品主檔 CSV 範本及填寫指南，含名稱、規格、描述與資料來源欄位。只給空白欄位，不杜撰價格或庫存。','商品編輯','gpt-5.6-luna','medium','商品資料與內容整理'),
  s('ecommerce-service','建立客服回覆範本','製作客服問題分類與回覆範本，未知退換貨政策以待確認欄位保留，不承諾退款或寄送訊息；交付 Markdown。','客服專員','gpt-5.6-luna','medium','客服文件與情境整理'),
  s('ecommerce-data','分析訂單資料','分析我提供的去識別化訂單 CSV，使用工具數值整理銷售與缺值，交付報告；缺資料時列出必要欄位。','數據分析師','gpt-5.6-terra','high','訂單資料分析',false)
 ],
 agency:[
  s('agency-brief','建立創意簡報框架','製作廣告公司創意簡報與提案評選標準範本，交付 Markdown。未知客戶、品牌、預算保留待填欄位，不捏造案例。','創意總監','gpt-6-astra','high','創意方向與提案規格'),
  s('agency-pitch','製作提案交付範本','製作廣告提案 Markdown 範本，包含問題、受眾、核心訊息、素材清單與驗收方式；未知數據留白。','提案企劃','gpt-5.6-terra','high','提案結構與邏輯整理'),
  s('agency-storyboard','製作分鏡表範本','製作品牌影片分鏡表 CSV 與填寫指南 Markdown，包含鏡頭、畫面、旁白、素材來源、驗收欄位。只交付空白範本，不假装已拍攝影片。','影音企劃','gpt-5.6-luna','medium','影音腳本與表格整理'),
  s('agency-client','整理客戶簡報資料','整理我提供的客戶簡報，萃取確認事項、資料缺口與下一步，交付 Markdown。','客戶經理','gpt-5.6-terra','medium','客戶資料整理',false)
 ]};
export function resolveModel(models:Model[],wanted:string,effort:string,fallback?:Employee){
 const model=models.find(m=>m.id===wanted)||models.find(m=>m.id===fallback?.model)||models[0];
 if(!model)throw new Error('尚未取得可用模型，請更新模型清單');
 return {model:model.id,effort:model.efforts.includes(effort)?effort:model.defaultEffort};
}
export function suggestedTask(co:Company,suggestion:Suggestion,models:Model[]):PlannedTask{
 const employee=co.employees.find(e=>e.title===suggestion.role)||co.employees[0];
 return {title:suggestion.title,employeeId:employee.id,...resolveModel(models,suggestion.model,suggestion.effort,employee),reason:`${types[co.type]}：${suggestion.reason}`,suggestionId:suggestion.id};
}
export function recommendPlan(co:Company,text:string,models:Model[],employeeId?:string,suggestionId?:string):PlannedTask[]{
 const exact=suggestions[co.type].find(s=>s.id===suggestionId&&s.title===text);
 if(exact){const p=suggestedTask(co,exact,models);return [{...p,employeeId:employeeId||p.employeeId}]}
 return plan(co,text,employeeId).map(p=>{
  const employee=co.employees.find(e=>e.id===p.employeeId);if(!employee)throw new Error('指定員工不屬於此公司');
  const profile=suggestions[co.type].find(s=>s.role===employee.title);
  // Explicit employee assignments preserve that employee's configured model unless a suggestion was selected.
  return {...p,...resolveModel(models,employeeId?employee.model:profile?.model||employee.model,employeeId?employee.effort:profile?.effort||employee.effort,employee),reason:employeeId?'沿用指定員工的設定':`${types[co.type]} · ${profile?.reason||employee.title}`};
 });
}
export const defaultAuto=():AutoDispatch=>({enabled:false,dailyLimit:3,intervalMinutes:30});
export const taipeiDay=(date:string|number)=>new Date(date).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'});
export function hasActiveGoal(co:Company,tasks:Task[]){const count=completeCount(tasks,co.id);return co.goals.some(g=>count-g.baseline<g.target)}
export function autoEligibility(co:Company,store:Store,now=Date.now()):{ready:boolean;reason:string;suggestion?:Suggestion}{
 const auto=co.autoDispatch||defaultAuto(),tasks=store.tasks as AutoTask[];
 if(!auto.enabled||!co.autoDispatch?.authorizedAt)return {ready:false,reason:'手動派工；尚未下令主管自動安排'};
 if(store.paused)return {ready:false,reason:'全公司已暫停新工作'};
 if(co.paused)return {ready:false,reason:'這家公司正在休息'};
 if(hasActiveGoal(co,tasks))return {ready:false,reason:'有進行中的公司目標，保留手動派工'};
 const own=tasks.filter(t=>t.companyId===co.id);
 if(own.some(t=>['blocked','approve'].includes(t.state)))return {ready:false,reason:'等待老闆補資料或驗收'};
 if(own.some(t=>['working','queued'].includes(t.state)))return {ready:false,reason:'等待目前工作完成'};
 if(tasks.filter(t=>taipeiDay(t.createdAt)===taipeiDay(now)).length>=store.maxTasksPerDay)return {ready:false,reason:'已達全公司每日任務上限'};
 if(own.filter(t=>t.origin==='automatic'&&taipeiDay(t.createdAt)===taipeiDay(now)).length>=auto.dailyLimit)return {ready:false,reason:'已達本公司每日自動派工上限'};
 const suggestion=suggestions[co.type].find(s=>s.auto&&!own.some(t=>t.suggestionId===s.id));
 if(!suggestion)return {ready:false,reason:'本輪建議已安排完成，請設定新的公司目標'};
 if(auto.lastDispatchedAt&&now-Date.parse(auto.lastDispatchedAt)<auto.intervalMinutes*60000)return {ready:false,reason:`等待派工間隔（${auto.intervalMinutes} 分鐘）`,suggestion};
 return {ready:true,reason:'公司閒置，準備自動派工',suggestion};
}
