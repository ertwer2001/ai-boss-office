export type CompanyType='studio'|'advisory'|'marketing'|'ecommerce'|'agency';
export type State='queued'|'working'|'approve'|'blocked'|'done'|'cancelled';
export interface Model {id:string;name:string;efforts:string[];defaultEffort:string}
export interface Employee {id:string;name:string;title:string;keywords:string[];model:string;effort:string;brief:string}
export interface Employee {profileId?:string}
export interface Task {assignment?:import('./roleProfiles').Assignment}
export interface Project {teamSnapshot?:Record<string,import('./roleProfiles').Assignment>}
export interface AutoDispatch {enabled:boolean;dailyLimit:number;intervalMinutes:number;lastDispatchedAt?:string;lastError?:string;authorizedBy?:string;authorizedAt?:string;managerId?:string;instruction?:string;version?:2;maxCalls?:number}
export interface Company {id:string;name:string;type:CompanyType;employees:Employee[];goals:{id:string;name:string;target:number;baseline:number}[];autoDispatch?:AutoDispatch;paused?:boolean;dispatchStatus?:string}
export interface Source {kind:'file'|'tool'|'model';ref:string;sha256?:string;at:string}
export interface DocumentAttachment {id:string;name:string;format:'pdf'|'docx';originalRef:string;originalSha256:string;parsedRef:string;parsedSha256:string;characters:number;pages?:number;parser:'Docling';parserVersion:string;localOnly:true;limitations:string[]}
export interface Task {id:string;companyId:string;employeeId:string;title:string;command:string;dependsOn:string[];state:State;stage:string;model:string;effort:string;createdAt:string;doneAt?:string;threadId?:string;turnId?:string;logs:{at:string;text:string}[];files:string[];sources:Source[];result?:string;error?:string;input?:string;feedback?:string;attempt:number;usage?:{input_tokens:number;output_tokens:number;cached_input_tokens?:number};checks?:{name:string;passed:boolean;output:string}[];approvedBy?:string;approvalAt?:string;external:boolean;pid?:number}
export type TaskKind='plan'|'work'|'review'|'consult'|'final-review';
export interface ReviewRecord {at:string;reviewerId:string;verdict:'pass'|'fail'|'escalate';reason:string;evidence:{criterion:string;passed:boolean;evidence:string}[];attempt:number;guidance:string}
export interface Task {projectId?:string;kind?:TaskKind;targetTaskId?:string;acceptance?:string[];pendingFiles?:{path:string;sha256:string}[];reviewedAttempt?:number;reviews?:ReviewRecord[];revisions?:number;consultations?:number}
export interface Project {id:string;companyId:string;mode:'goal'|'autonomous'|'manual';title:string;goal:string;input?:string;status:'planning'|'running'|'reviewing'|'blocked'|'completed'|'stopped';managerId:string;managerModel:string;managerEffort:string;createdAt:string;finishedAt?:string;authorizedBy:string;calls:number;maxCalls:number;maxRevisions:number;assumptions:string[];message:string;escalation?:{category:string;question:string};decisionLog?:{at:string;text:string}[]}
export interface Project {delivery?:{summary:string;howToUse:string[];limitations:string[];entryTaskId:string;entryPath:string};deliveryGuide?:string}
export interface Project {blockReason?:'validation';candidateDelivery?:{summary:string;howToUse:string[];limitations:string[];entryTaskId:string;entryPath:string}}
export interface Project {browserContract?:import('../../server/browserContract').BrowserContract;browserContractHash?:string;browserEntryTaskId?:string;browserEvidence?:import('../../server/browserContract').BrowserEvidence;browserHistory?:import('../../server/browserContract').BrowserEvidence[]}
export interface Task {executionRevision?:number;consultedProblems?:string[]}
export interface Project {inputDocument?:DocumentAttachment}
export interface Task {inputDocument?:DocumentAttachment}
export interface Task {research?:{ticker:string;date:string;question:string;maxCalls:number};researchSettingsHash?:string;researchStarted?:boolean;researchCalls?:number;researchReceipt?:{sha256:string}}
export interface Store {version:1;boss:string;companies:Company[];tasks:Task[];projects?:Project[];paused:boolean;maxTasksPerDay:number;maxConcurrentTasks?:number;stopReason?:string}
export const labels:Record<State|'idle',string>={queued:'等待接力',working:'工作中',approve:'待你驗收',blocked:'卡關',done:'完成',idle:'待命',cancelled:'已停止'};
const names=['周敬文','林子崴','許郁庭','陳奕安','李若晴','蘇以寧','張予恩'];
const roles:Record<CompanyType,string[]>={studio:['營運總監','軟體工程師','資料分析師','品質工程師','內容編輯','研究企劃'],advisory:['研究總監','量化研究員','產業分析師','籌碼分析師','風控專員','內容編輯','合規專員'],marketing:['行銷總監','市場研究員','文案企劃','視覺設計師','社群經營','廣告企劃'],ecommerce:['營運長','選品研究員','商品編輯','客服專員','廣告企劃','數據分析師'],agency:['創意總監','客戶經理','提案企劃','美術設計','影音企劃','媒體企劃']};
export const types:Record<CompanyType,string>={studio:'AI 工作室',advisory:'投顧研究公司',marketing:'行銷公司',ecommerce:'電商公司',agency:'廣告公司'};
const kw:Record<string,string[]>={'軟體工程師':['程式','開發','網站','app','javascript','功能','計算器'],'資料分析師':['資料','csv','數據','分析','統計'],'品質工程師':['測試','驗證','品質','檢查'],'內容編輯':['文案','貼文','編輯','文章'],'研究企劃':['研究','企劃','調查'],'量化研究員':['回測','策略','wave60','因子'],'產業分析師':['產業','營收','財報'],'籌碼分析師':['籌碼','外資','法人'],'風控專員':['風險','回撤','風控'],'合規專員':['合規','用語']};
export function makeCompany(name:string,type:CompanyType,models:Model[]):Company{
 const choose=(wanted:string)=>models.find(m=>m.id===wanted)||models[0];
 return {id:crypto.randomUUID(),name,type,goals:[],employees:roles[type].map((title,i)=>{
  const m=choose(i===0?'gpt-6-astra':/工程|量化/.test(title)?'gpt-5.6-sol':/分析|研究|風控|合規/.test(title)?'gpt-5.6-terra':'gpt-5.6-luna');
  const effort=i===0||/工程|量化|風控/.test(title)?'high':'medium';
  return {id:crypto.randomUUID(),title,name:names[i],keywords:kw[title]||[title.slice(0,2),'企劃'],model:m?.id||'',effort:m?.efforts.includes(effort)?effort:m?.defaultEffort||'medium',brief:`你是${title}。交付可使用的檔案，附驗證與限制。${type==='advisory'?'僅供自用研究；缺行情、資料日期或策略定義時明列缺口，不能編造回測或投資績效。':''}`};
 })};
}
export function plan(company:Company,text:string,employeeId?:string){
 const parts=text.split(/(?:然後|接著|並且|並|再|[；;])/).map(s=>s.trim()).filter(Boolean).slice(0,8);
 return parts.map(title=>({title,employeeId:employeeId||[...company.employees].sort((a,b)=>score(b,title)-score(a,title))[0].id}));
}
function score(e:Employee,text:string){return e.keywords.reduce((n,k)=>n+(text.toLowerCase().includes(k.toLowerCase())?k.length:0),0)}
export function employeeState(tasks:Task[],id:string):State|'idle'{
 const mine=tasks.filter(t=>t.employeeId===id);
 for(const s of ['blocked','approve','working','queued'] as State[])if(mine.some(t=>t.state===s))return s;
 if(mine.some(t=>t.state==='done'&&Date.now()-Date.parse(t.doneAt||'')<8000))return 'done';
 return 'idle';
}
export function ready(task:Task,tasks:Task[]){return task.state==='queued'&&task.dependsOn.every(id=>tasks.some(t=>t.id===id&&t.state==='done'))}
export function completeCount(tasks:Task[],companyId:string,projects?:Project[]){return tasks.filter(t=>t.companyId===companyId&&t.state==='done'&&(!t.projectId||(t.kind==='work'&&t.files.length>0&&(!projects||projects.some(p=>p.id===t.projectId&&p.status==='completed'))))).length}
