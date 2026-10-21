// Used to transfer this checkout through the connected GitHub API when terminal
// network access is unavailable. Excludes ignored files and original binaries.
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
const names=['.env.example','.gitignore','AGENTS.md','README.md','package.json','tsconfig.base.json','playwright.config.ts'];
function walk(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){if(['node_modules','.next','.local'].includes(entry.name)||entry.name.endsWith('.tsbuildinfo'))continue;const path=join(directory,entry.name);if(entry.isDirectory())walk(path);else if(entry.isFile())names.push(path);}}
for(const directory of ['apps','packages','scripts','docs','tests','.github'])walk(directory);
const unique=[...new Set(names)].filter(name=>!['.png','.jpg','.woff2','.ttf','.zip'].some(ext=>name.endsWith(ext)));
const offset=Number(process.argv[2]||0),count=Number(process.argv[3]||8);
process.stdout.write(JSON.stringify({total:unique.length,entries:unique.slice(offset,offset+count).map(path=>({path,mode:'100644',type:'blob',content:readFileSync(path,'utf8')}))}));
