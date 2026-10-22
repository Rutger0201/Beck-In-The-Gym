import {test,expect} from "@playwright/test";
import {mkdir} from "node:fs/promises";
import {locales,pageKeys,pageUrl} from "../../packages/core/src/routes.ts";

test("logos fit and stay centered on phone, tablet and desktop",async({page},testInfo)=>{
  test.setTimeout(120_000);
  await page.emulateMedia({reducedMotion:"reduce"});
  await mkdir("test-results/review",{recursive:true});
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    for(const theme of ["light","dark"] as const){
      await page.emulateMedia({colorScheme:theme});
      for(const route of ["/","/visitekaartje/"]){
        await page.goto(route);await page.evaluate(()=>document.fonts.ready);
        expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('dark');expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(17, 19, 16)');await expect(page.locator('#theme')).toHaveCount(0);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px ${route}`).toBe(true);
        const frames=page.locator(".logo-lockup");
        for(const frame of await frames.all()){
          const geometry=await frame.evaluate(el=>{
            const image=el.querySelector("img")!,rect=image.getBoundingClientRect(),box=el.getBoundingClientRect(),parent=el.parentElement!.getBoundingClientRect();
            // Pixel bounds of the supplied original PNG, measured once from its alpha channel.
            const art={left:rect.left+rect.width*1188/3840,right:rect.left+rect.width*2652/3840,top:rect.top+rect.height*435/2160,bottom:rect.top+rect.height*1545/2160};
            return{loaded:image.complete&&image.naturalWidth>0,inFrame:art.left>=box.left-1&&art.right<=box.right+1&&art.top>=box.top-1&&art.bottom<=box.bottom+1,inParent:art.left>=parent.left&&art.right<=parent.right&&art.top>=parent.top&&art.bottom<=parent.bottom,center:Math.abs((art.left+art.right)/2-(parent.left+parent.right)/2)};
          });
          expect(geometry.loaded).toBe(true);expect(geometry.inFrame,`${width}px ${route}: logo crop`).toBe(true);expect(geometry.inParent).toBe(true);expect(geometry.center).toBeLessThan(1);
        }
        if(!route.includes("visitekaartje")){
          const circleCenter=await page.locator(".map-dot").evaluate(el=>{const dot=el.getBoundingClientRect(),map=el.parentElement!.getBoundingClientRect();return Math.abs(dot.x+dot.width/2-map.x-map.width/2);});expect(circleCenter).toBeLessThan(1);
        }
        if([390,1440].includes(width))await page.screenshot({path:`test-results/review/${testInfo.project.name}-${width}-${theme}-${route==="/"?"home":"card"}.png`,fullPage:true});
      }
    }
  }
});

test("all Dutch and English pages load without broken images or overflow",async({page})=>{
  test.setTimeout(120_000);
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  for(const width of [320,1280]){
    await page.setViewportSize({width,height:900});
    for(const locale of locales)for(const key of pageKeys){
      const response=await page.goto(pageUrl(locale,key));expect(response?.status()).toBe(200);
      await page.evaluate(()=>document.fonts.ready);await expect(page.locator("html")).toHaveAttribute("lang",locale);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${width}px ${locale}/${key}`).toBe(true);
      const images=await page.locator("img").evaluateAll(imgs=>Promise.all(imgs.map(async img=>{img.loading="eager";try{await img.decode();return img.naturalWidth>0;}catch{return false;}})));
      expect(images.every(Boolean),`${locale}/${key}: broken image`).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
