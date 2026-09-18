import type {Store,Model} from '../domain/company';
import {pageHeaders} from './presence';
export async function api<T=any>(url:string,method='GET',body?:unknown):Promise<T>{const response=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json','X-Boss-Office':'local',...pageHeaders()},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(data.error||'服務暫時無法使用');return data}
export type Snapshot=Store&{generation:number;outputRoot:string};
export type Status={connected:boolean;models:Model[];checkedAt?:string;error?:string;quota?:any};
