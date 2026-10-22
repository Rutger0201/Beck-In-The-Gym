import {test,expect} from '@playwright/test';
const business='/Beck-In-The-Gym/zakelijk/';
async function configure(page:any){await page.goto(business);await page.getByRole('button',{name:'Bedrijfsgegevens',exact:true}).click();await page.getByLabel('Btw-behandeling onderneming').selectOption('standard');await page.getByRole('button',{name:'Bedrijfsgegevens bewaren'}).click();}
test('all four activities use their own generator and persist test documents',async({page},info)=>{
 test.setTimeout(90_000);await configure(page);
 const writes:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
 for(const [i,name]of ['Beck In The Gym','Beck on the Rocks','Beveiligingsactiviteiten','Vierde activiteit'].entries()){
  await page.locator(`[data-activity="${['bitg','botr','security','fourth'][i]}"]`).click();await expect(page.getByRole('heading',{level:1})).toHaveText(name);
  await page.getByRole('button',{name:'+ Nieuwe offerte'}).click();await page.getByLabel('Naam',{exact:true}).fill(`Testklant ${i}`);await page.getByLabel('Prijs (€)',{exact:true}).first().fill('10,25');
  await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.locator('.editor-heading h2')).toContainText(`TEST-${['BITG','BOTR','BEV','ACT4'][i]}-O-`);
  await expect(page.locator('.grand-total')).toContainText('12,40');await page.getByRole('button',{name:'← Alle activiteiten'}).click();
 }
 await page.reload();await expect(page.locator('.activity-choice')).toHaveCount(4);await expect(page.locator('.activity-choice').first()).toContainText('1 documenten');expect(writes).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/review/${info.project.name}-business-dashboard.png`,fullPage:true});
});
test('quotation converts to invoice concept with unchanged amounts and source reference',async({page},info)=>{
 await configure(page);await page.locator('[data-activity="bitg"]').click();await page.getByRole('button',{name:'+ Nieuwe offerte'}).click();await page.getByLabel('Naam',{exact:true}).fill('Testpersoon');await page.getByLabel('Prijs (€)',{exact:true}).fill('45');await page.getByRole('button',{name:'Opslaan',exact:true}).click();
 await expect(page.locator('.editor-heading h2')).toContainText('TEST-BITG-O-');const quote=await page.locator('.editor-heading h2').innerText();await page.getByRole('button',{name:'Naar factuur'}).click();await expect(page.getByLabel('Referentie (optioneel)')).toHaveValue(quote);await expect(page.locator('.grand-total')).toContainText('54,45');await page.getByRole('button',{name:'Opslaan',exact:true}).click();await expect(page.locator('.editor-heading h2')).toContainText('TEST-BITG-F-');
 await expect(page.locator('#paper')).toContainText('CONCEPT · TESTDOCUMENT');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/review/${info.project.name}-shared-generator.png`,fullPage:true});
});
test('card shortcut has its own PWA identity, launch target, icons and install instructions',async({page},info)=>{
 const base='/Beck-In-The-Gym/kaart/';await page.goto(base);await expect(page).toHaveTitle('BITG — digitaal visitekaartje');await page.getByRole('button',{name:'Zet op beginscherm'}).click();await expect(page.locator('[data-install-help]')).toBeVisible();
 const response=await page.request.get(`${base}manifest.webmanifest`);expect(response.status()).toBe(200);const manifest=await response.json();expect(manifest.start_url).toBe('./');expect(manifest.scope).toBe('./');expect(manifest.display).toBe('standalone');expect(manifest.name).toContain('visitekaartje');
 for(const icon of manifest.icons)expect((await page.request.get(`${base}${icon.src}`)).status()).toBe(200);
 await expect(page.locator('.qr img')).toBeVisible();expect(await page.locator('.qr img').evaluate((i:HTMLImageElement)=>i.naturalWidth>0)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:`test-results/review/${info.project.name}-separate-card.png`,fullPage:true});
});
