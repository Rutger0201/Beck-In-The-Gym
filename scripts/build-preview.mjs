import { mkdir,writeFile,readFile,cp } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { header,footer,pageMarkup } from '../apps/web/lib/render.ts';
import { locales,pageKeys,pageUrl } from '../packages/core/src/routes.ts';
const output=resolve(import.meta.dirname,'../.local/preview');await mkdir(output,{recursive:true});
await cp(new URL('../apps/web/public/',import.meta.url),output,{recursive:true});
await cp(new URL('../apps/web/app/global.css',import.meta.url),resolve(output,'preview.css'));
const config={name:'Rutger',verified:false,formAvailable:true};
for(const locale of locales)for(const page of pageKeys){
  const route=pageUrl(locale,page),file=resolve(output,`.${route}/index.html`);await mkdir(dirname(file),{recursive:true});
  const markup=pageMarkup(locale,page,config).replace(/<figure class="qr">[\s\S]*?<\/figure>/,'<p class="small muted">QR-code beschikbaar in de volledige applicatie / QR code available in the full application.</p>');
  const html=`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Beck In The Gym — ontwerpvoorbeeld</title><link rel="stylesheet" href="/preview.css"><script>try{var t=localStorage.getItem('bitg-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script></head><body><div style="padding:8px 20px;background:#d8dac4;color:#1c2119;text-align:center;font:11px system-ui">ONTWERPVOORBEELD · NIET GEPUBLICEERD · FORMULIER VERSTUURT GEEN GEGEVENS</div>${header(locale,page)}<main id="main" tabindex="-1">${markup}</main>${footer(locale,config)}<script src="/site.js" defer></script></body></html>`;
  await writeFile(file,html);
}
console.log(`Built ${locales.length*pageKeys.length} static design previews in ${output}`);
