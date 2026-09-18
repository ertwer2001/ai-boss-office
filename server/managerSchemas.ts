import {z} from 'zod';
import {browserContract,browserContractSchema} from './browserContract';
const text=z.string().trim().min(1).max(12000),short=z.string().max(12000);
export const decisionCategory=z.enum(['none','external_action','cost','credentials','irreversible','scope']);
export const planResult=z.object({decision:z.enum(['proceed','blocked','escalate']),title:text,reason:text,assumptions:z.array(text).max(12),category:decisionCategory,question:short,browserContract:browserContract.nullable().optional(),steps:z.array(z.object({title:text,employeeId:text,model:text,effort:text,acceptance:z.array(text).min(1).max(8),dependsOn:z.array(z.number().int().min(0)).max(6).optional()})).max(6)});
export const reviewResult=z.object({verdict:z.enum(['pass','fail','escalate']),reason:text,evidence:z.array(z.object({criterion:text,passed:z.boolean(),evidence:text})).min(1).max(30),guidance:short,category:decisionCategory,question:short,targetTaskId:short,delivery:z.object({summary:z.string().max(1500),howToUse:z.array(z.string().min(1).max(1000)).max(8),limitations:z.array(z.string().min(1).max(1000)).max(8),entryTaskId:short,entryPath:short}).optional()});
export const consultResult=z.object({decision:z.enum(['direct','blocked','escalate']),reason:text,direction:short,assumptions:z.array(text).max(12),category:decisionCategory,question:short});
const str={type:'string'},category={type:'string',enum:decisionCategory.options};
function object(properties:Record<string,unknown>){return {type:'object',additionalProperties:false,properties,required:Object.keys(properties)}}
function array(items:unknown){return {type:'array',items}}
export const planSchema=object({decision:{type:'string',enum:['proceed','blocked','escalate']},title:str,reason:str,assumptions:array(str),category,question:str,browserContract:browserContractSchema,steps:array(object({title:str,employeeId:str,model:str,effort:str,acceptance:array(str),dependsOn:array({type:'integer',minimum:0})}))});
export const reviewSchema=object({verdict:{type:'string',enum:['pass','fail','escalate']},reason:str,evidence:array(object({criterion:str,passed:{type:'boolean'},evidence:str})),guidance:str,category,question:str,targetTaskId:str,delivery:object({summary:str,howToUse:array(str),limitations:array(str),entryTaskId:str,entryPath:str})});
export const consultSchema=object({decision:{type:'string',enum:['direct','blocked','escalate']},reason:str,direction:str,assumptions:array(str),category,question:str});
