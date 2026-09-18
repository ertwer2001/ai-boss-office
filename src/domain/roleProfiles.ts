import catalog from '../../data/catalogs/agency/profiles.json';
import type {CompanyType,Employee} from './company';
export interface RoleProfile {id:string;name:string;summary:string;companies:string[];sources:string[];instructions:string}
export const roleProfiles:RoleProfile[]=catalog.profiles;
export const profileIds=['auto','none',...roleProfiles.map(p=>p.id)] as [string,...string[]];
export const roleCatalog={version:catalog.version,repository:catalog.repository,commit:catalog.commit,license:catalog.license};
export interface RoleSnapshot extends RoleProfile {version:string;repository:string;commit:string;license:string;sha256:string}
export interface Assignment {name:string;title:string;brief:string;model:string;effort:string;profile?:RoleSnapshot}
export function resolveProfile(employee:Pick<Employee,'profileId'|'title'>,type:CompanyType,manager=false){
 const selected=employee.profileId||'auto';
 if(!profileIds.includes(selected))throw new Error('找不到專業角色模板');
 let id=selected;
 if(selected==='auto')id=manager?'manager':/品質|風控|合規/.test(employee.title)?'qa':/內容|商品編輯|客服/.test(employee.title)?'writer':/視覺|美術/.test(employee.title)?'ui':type==='studio'&&/軟體工程/.test(employee.title)?'frontend':type==='studio'&&/研究企劃/.test(employee.title)?'ux':'none';
 return roleProfiles.find(p=>p.id===id);
}
