// Offline browser QA: intercept all requests and serve the generated files from
// memory. No listening socket, real API, mail provider or external request.
import { readFile,mkdir,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(import.meta.dirname,'../.local/preview'),output=resolve(import.meta.dirname,'../.local/screenshots');await mkdir(output,{recursive:true});
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let checks=0;
try{
  for(const [name,width,height,colorScheme] of [['desktop-dark',1440,1000,'dark'],['desktop-light',1440,1000,'light'],['mobile-dark',390,844,'dark'],['mobile-light',390,844,'light']]){
    const context=await browser.newContext({viewport:{width,height},colorScheme,reducedMotion:'reduce'}),page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',async route=>{
      const request=route.request();
      if(request.method()!=='GET'){await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Preview only"}'});return;}
      try{let file=resolve(root,'.'+decodeURIComponent(new URL(request.url()).pathname));if(file!==root&&!file.startsWith(root+sep))throw new Error();if((await stat(file)).isDirectory())file=resolve(file,'index.html');await route.fulfill({status:200,contentType:types[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{await route.fulfill({status:404,body:'Not found'});}
    });
    await page.goto('https://bitg.preview/');await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(),'STERKER.\nOP JOUW\nMANIER.');checks++;
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);checks++;
    await page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
    await page.locator('#theme').selectOption(colorScheme==='dark'?'light':'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'),colorScheme==='dark'?'light':'dark');checks++;
    await page.goto('https://bitg.preview/contact?goal=technique&format=technique');
    assert.equal(await page.locator('[name="goal"]').inputValue(),'technique');checks++;
    await page.locator('[name="name"]').fill('Test person');await page.locator('[name="email"]').fill('test@example.test');await page.locator('button[type=submit]').click();
    await page.locator('.form-status[data-error]').waitFor();assert.equal(await page.locator('[name="name"]').inputValue(),'Test person');checks++;
    if(width<760){await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');checks+=2;}
    await page.goto('https://bitg.preview/en/services');assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('.service').count(),5);checks+=2;
    assert.deepEqual(errors,[]);checks++;await context.close();
  }
  console.log(JSON.stringify({checks,screenshots:output}));
}finally{await browser.close();}
