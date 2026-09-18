import fs from 'node:fs';import path from 'node:path';import {roleProfiles,roleCatalog} from '../src/domain/roleProfiles';
const root=path.resolve('docs/role-profiles/agency');fs.mkdirSync(root,{recursive:true});
for(const p of roleProfiles)fs.writeFileSync(path.join(root,p.id+'.md'),`# ${p.name}\n\n${p.summary}\n\n## 已適配職責\n\n${p.instructions}\n\n## 來源\n\n版本 ${roleCatalog.version}，MIT；上游 commit ${roleCatalog.commit}。\n\n${p.sources.map(s=>`- [${s}](${roleCatalog.repository}/blob/${roleCatalog.commit}/${s})`).join('\n')}\n\n本卡由 data/catalogs/agency/profiles.json 產生，執行時只使用目錄中本次所需的角色。未提供額外工具、記憶、模型額度或自主執行權。原始授權見 ../../licenses/agency-agents-MIT.txt。\n`);
console.log('Exported '+roleProfiles.length+' adapted role cards');
