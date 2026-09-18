import {z} from 'zod';
// Declarative commands only. Models cannot provide JavaScript, URLs or arbitrary selectors.
const label=z.string().trim().min(1).max(500);
const selector=z.string().regex(/^#[A-Za-z][\w-]{0,79}$/,'驗收元素必須使用固定 #id');
export const browserStep=z.object({action:z.enum(['click','fill','select','check','uncheck','text','value','visible','hidden']),selector,value:z.string().max(2000)}).strict();
export const browserContract=z.object({
 entryStep:z.number().int().min(0).max(5),entryPath:z.string().regex(/^[\w-]+\.html?$/i),
 requirements:z.array(label).min(1).max(8),
 scenarios:z.array(z.object({name:label,requirement:label,kind:z.enum(['happy','edge']),steps:z.array(browserStep).min(2).max(16)}).strict()).min(2).max(12)
}).strict().superRefine((c,ctx)=>{
 const fail=(message:string)=>ctx.addIssue({code:'custom',message});
 if(new Set(c.requirements).size!==c.requirements.length)fail('必要功能不能重複');
 if(!c.scenarios.some(s=>s.kind==='happy')||!c.scenarios.some(s=>s.kind==='edge'))fail('需同時驗收正常操作及空值／邊界情境');
 for(const r of c.requirements)if(!c.scenarios.some(s=>s.requirement===r))fail('每項必要功能都必須有操作情境');
 for(const s of c.scenarios){
  if(!c.requirements.includes(s.requirement))fail('情境需對應原始必要功能');
  let interacted=false,asserted=false;
  for(const step of s.steps){if(['click','fill','select','check','uncheck'].includes(step.action))interacted=true;
   else if(interacted&&(['visible','hidden'].includes(step.action)||step.value.trim()))asserted=true;}
  if(!asserted)fail('情境必須操作作品後檢查具體結果，不能只有靜態文字或空白斷言');
 }
});
export type BrowserContract=z.infer<typeof browserContract>;
export interface BrowserStepEvidence {action:z.infer<typeof browserStep>['action'];selector:string;expected?:string;passed:boolean;detail:string}
export interface BrowserScenarioEvidence {name:string;requirement?:string;kind?:'happy'|'edge';passed:boolean;steps:number;stepResults?:BrowserStepEvidence[];error?:string;screenshotPath?:string;screenshotSha256?:string;tracePath?:string;traceSha256?:string}
export interface BrowserEvidence {version?:2;evidenceId?:string;at:string;status:'pass'|'fail'|'error';htmlSha256:string;contractSha256:string;environment:string;scenarios:BrowserScenarioEvidence[];errors:string[]}
const str={type:'string'};
const obj=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const browserContractSchema={anyOf:[{type:'null'},obj({entryStep:{type:'integer',minimum:0,maximum:5},entryPath:str,requirements:{type:'array',items:str},scenarios:{type:'array',items:obj({name:str,requirement:str,kind:{type:'string',enum:['happy','edge']},steps:{type:'array',items:obj({action:{type:'string',enum:browserStep.shape.action.options},selector:str,value:str})}})}})]};
