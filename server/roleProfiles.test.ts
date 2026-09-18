import fs from 'node:fs';import path from 'node:path';import {it,expect,beforeEach,afterEach} from 'vitest';
import {roleProfiles,resolveProfile,profileIds} from '../src/domain/roleProfiles';
import {makeCompany,type Store,type Task} from '../src/domain/company';
import {snapshotTeam,rolePrompt,verifyProfile} from './roleProfiles';
import {createProject,runManager,projectWorks,advanceProjects} from './projects';import {runTask} from './runner';
const models=[{id:'test',name:'test',efforts:['low'],defaultEffort:'low'}];let s:Store,root:string;
beforeEach(()=>{fs.mkdirSync('docs/verification/role-tests',{recursive:true});root=fs.mkdtempSync(path.resolve('docs/verification/role-tests/case-'));s={version:1,boss:'測試老闆',companies:[makeCompany('實作驗收室','studio',models)],tasks:[],paused:false,maxTasksPerDay:30}});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
it('職位預設只在新案解析，明確停用及手選優先',()=>{
 const co=s.companies[0];const original=JSON.stringify(co);const team=snapshotTeam(co);expect(team[co.employees[0].id].profile?.id).toBe('manager');expect(team[co.employees[1].id].profile?.id).toBe('frontend');expect(team[co.employees[2].id].profile).toBeUndefined();expect(team[co.employees[3].id].profile?.id).toBe('qa');expect(JSON.stringify(co)).toBe(original);
 expect(resolveProfile({...co.employees[1],profileId:'none'},'studio')).toBeUndefined();expect(resolveProfile({...co.employees[1],profileId:'writer'},'studio')?.id).toBe('writer');expect(()=>resolveProfile({...co.employees[1],profileId:'unknown'},'studio')).toThrow();
});
it('不讓非軟體公司的研究職位自動變工程師',()=>{expect(resolveProfile({title:'研究企劃'},'advisory')).toBeUndefined();expect(resolveProfile({title:'合規專員'},'advisory')?.id).toBe('qa')});
it('新增案件和手動派工保存角色、姓名與說明；舊任務不補套角色',()=>{
 const co=s.companies[0],e=co.employees[1],p=createProject(s,co,models,'manual','文件','',18,[{title:'文件',employeeId:e.id,model:'test',effort:'low',reason:'手動'}]),t=projectWorks(s,p)[0];const original=t.assignment!.name;e.name='新名字';e.brief='新說明';e.profileId='none';expect(t.assignment!.name).toBe(original);expect(t.assignment!.profile!.id).toBe('frontend');expect(rolePrompt({...t,assignment:undefined})).toBe('');
});
it('主管真實呼叫入口只注入自己的模板，計畫前員工變動不改快照',async()=>{
 const co=s.companies[0],p=createProject(s,co,models,'goal','整理文字'),manager=s.tasks[0];manager.state='working';const old=co.employees[1].name;co.employees[1].name='變動後';co.employees[1].profileId='writer';let prompt='';
 await runManager(manager,s,models,root,root+'/out',()=>{},async(_t,text)=>{prompt=text;return {decision:'proceed',title:'文字',reason:'整理',assumptions:[],category:'none',question:'',steps:[{title:'整理',employeeId:co.employees[1].id,model:'test',effort:'low',acceptance:['完整']}]}});
 expect(prompt).toContain('本次已核定專業角色：主管');expect(prompt).toContain(old);expect(prompt).not.toContain('變動後');expect(prompt).not.toContain(roleProfiles.find(p=>p.id==='frontend')!.instructions);expect(projectWorks(s,p)[0].assignment!.profile!.id).toBe('frontend');expect(manager.sources.some(x=>x.ref.includes('manager@1.0.0'))).toBe(true);
});
it('員工真實執行入口使用派工快照，沒有載入整個角色库',async()=>{
 const co=s.companies[0],e=co.employees[1],p=createProject(s,co,models,'manual','整理','',18,[{title:'整理',employeeId:e.id,model:'test',effort:'low',reason:'手動'}]),t=projectWorks(s,p)[0];t.state='working';const name=e.name;e.name='後來改名';e.profileId='writer';let prompt='';
 await runTask(t,e,[],root,root+'/out',()=>{},{execute:async(_t,_r,text)=>{prompt=text;return JSON.stringify({summary:'已整理',needsInput:'',files:[{path:'結果.md',content:'完成'}],checks:[]})}});
 expect(prompt).toContain(name);expect(prompt).not.toContain('後來改名');expect(prompt).toContain('本次已核定專業角色：工程師');expect(prompt).not.toContain(roleProfiles.find(p=>p.id==='writer')!.instructions);expect(t.state).toBe('approve');expect(t.sources.filter(x=>x.ref.includes('frontend@'))).toHaveLength(1);
 advanceProjects(s);expect(s.tasks.at(-1)!.assignment!.profile!.id).toBe('manager');
});
it('驗證雜湊使用保存內容，不依賴日後目錄；竄改會在推論前拒絕',()=>{
 const a=snapshotTeam(s.companies[0])[s.companies[0].employees[1].id];expect(()=>verifyProfile(a.profile!)).not.toThrow();a.profile!.instructions+='改掉';expect(()=>verifyProfile(a.profile!)).toThrow('校驗');
});
it('目錄保留固定來源與精簡職責，不輸出未審核代理命令',()=>{
 expect(roleProfiles).toHaveLength(6);expect(profileIds.includes('none')).toBe(true);
 for(const p of roleProfiles){expect(p.instructions.length).toBeLessThan(1000);expect(p.sources.length).toBeGreaterThan(0);expect(p.instructions).not.toMatch(/qa-playwright-capture|localhost:8000|FluxUI|Laravel|minimum 3-5/)}
});
