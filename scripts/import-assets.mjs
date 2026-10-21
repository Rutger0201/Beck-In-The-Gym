// Materialise binary assets fetched through the connected repository reader.
// The source manifest is checkout-local, contains no secrets and is not committed.
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'.local/import.json'),'utf8'));
for(const [file,base64] of Object.entries(manifest)){
  if(!/^apps\/web\/public\/fonts\/[a-z0-9.-]+$/.test(file)&&file!=='beck-in-the-gym-starter.zip')throw new Error('Unexpected asset destination');
  const target=resolve(root,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,Buffer.from(base64,'base64'));
  console.log(`Imported ${file}`);
}
