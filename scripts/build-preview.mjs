import { mkdir,writeFile,readFile,cp } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { header,footer,pageMarkup } from '../apps/web/lib/render.ts';
import { locales,pageKeys,pageUrl } from '../packages/core/src/routes.ts';
import { buildVcard } from '../packages/core/src/security.ts';

const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const basePath=(option('--base-path')||'').replace(/\/$/,'');
if(basePath&&!/^\/[a-zA-Z0-9/_-]+$/.test(basePath))throw new Error('Invalid preview base path');
const origin=new URL(option('--origin')||'http://127.0.0.1:4173').origin;
const output=resolve(import.meta.dirname,'..',option('--output')||'.local/preview');
const prefix=markup=>markup.replace(/\b(href|src|action)="\/(?!\/)/g,`$1="${basePath}/`);
// On Pages the test workspace sits next to /preview; without a base path there is none.
const adminUrl=option('--admin-url')||(basePath.endsWith('/preview')?`${origin}${basePath.slice(0,-'/preview'.length)}/zakelijk/`:undefined);
const asset=name=>`${basePath}/${name}`;
const QRCode=process.argv.includes('--qr')?createRequire(new URL('../apps/web/package.json',import.meta.url))('qrcode'):null;
await mkdir(output,{recursive:true});
await cp(new URL('../apps/web/public/',import.meta.url),output,{recursive:true});
const css=(await readFile(new URL('../apps/web/app/global.css',import.meta.url),'utf8')).replaceAll("url('/",`url('${basePath}/`);
const js=await readFile(new URL('../apps/web/public/site.js',import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,12);
await writeFile(resolve(output,'preview.css'),css);
await writeFile(resolve(output,'contact.vcf'),buildVcard({name:'Rutger',website:`${origin}${basePath}/`}));
await writeFile(resolve(output,'.nojekyll'),'');
const config={name:'Rutger',verified:false,formAvailable:true};
for(const locale of locales){
  if(QRCode)await writeFile(resolve(output,`qr-${locale}.svg`),await QRCode.toString(`${origin}${basePath}${pageUrl(locale,'card')}/`,{type:'svg',errorCorrectionLevel:'M',margin:4,color:{dark:'#000000',light:'#ffffff'}}));
  for(const page of pageKeys){
    const route=pageUrl(locale,page),file=resolve(output,`.${route}/index.html`);await mkdir(dirname(file),{recursive:true});
    const nl=locale==='nl';
    let markup=pageMarkup(locale,page,config);
    markup=QRCode?markup.replace(`/qr.svg?lang=${locale}`,`/qr-${locale}.svg`):markup.replace(/<figure class="qr">[\s\S]*?<\/figure>/,'');
    // Keep native submission disabled until the demonstration handler is ready.
    markup=markup.replace('method="post"','method="post" data-preview-form').replace('type="submit"','type="submit" disabled');
    if(page==='contact')markup=markup.replace('<form ',`<p class="preview-notice">${nl?'Je kunt dit formulier uitproberen. Er worden geen gegevens verstuurd of opgeslagen.':'Try the form here. No information is sent or stored.'}</p><form `);
    const label={home:'Beck In The Gym',card:nl?'Digitaal visitekaartje':'Business card',privacy:'Privacy',contact:'Contact',services:nl?'Diensten':'Services',about:nl?'Over mij':'About me',approach:nl?'Werkwijze':'Approach',faq:'FAQ',results:nl?'Ervaringen':'Experiences',training:'Personal training'}[page];
    const title=page==='home'?label:`${label} — Beck In The Gym`;
    const html=`<!doctype html><html lang="${locale}" data-theme="dark" data-preview><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#111310"><title>${title} — ${nl?'testversie':'test version'}</title><link rel="icon" href="${asset('icon-192.png')}" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="${asset('icon-192.png')}"><link rel="stylesheet" href="${asset('preview.css')}?v=${hash(css)}"></head><body><div class="preview-banner">${nl?'TESTVERSIE · FORMULIER VERSTUURT GEEN GEGEVENS':'TEST VERSION · THE FORM DOES NOT SEND ANY DATA'}</div>${prefix(header(locale,page,adminUrl))}<main id="main" tabindex="-1">${prefix(markup)}</main>${prefix(footer(locale,config))}<script src="${asset('site.js')}?v=${hash(js)}" defer></script></body></html>`;
    await writeFile(file,html);
  }
}
console.log(`Built ${locales.length*pageKeys.length} safe previews in ${output}${basePath?` (base path: ${basePath})`:''}`);
