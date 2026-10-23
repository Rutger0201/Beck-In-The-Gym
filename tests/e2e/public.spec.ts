import { test,expect } from "@playwright/test";
test("homepage keeps one fixed design regardless of system theme; menu and language work",async({page,isMobile})=>{
  await page.emulateMedia({colorScheme:"light"});await page.addInitScript(()=>localStorage.setItem("bitg-theme","light"));
  await page.goto("/");await expect(page.locator("h1")).toContainText("STERKER.");
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth",0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);
  await expect(page.locator("#theme")).toHaveCount(0);
  expect(await page.locator("body").evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(13, 14, 15)");
  expect(await page.locator(".tone-light").first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe("rgb(228, 228, 225)");
  await expect(page.locator(".hero-media img")).toHaveJSProperty("complete",true);
  if(isMobile){
    const toggle=page.getByRole("button",{name:"Menu"});await toggle.click();await expect(toggle).toHaveAttribute("aria-expanded","true");
    await expect(page.locator("#navigation a").first()).toBeFocused();await page.keyboard.press("Escape");await expect(toggle).toHaveAttribute("aria-expanded","false");await expect(toggle).toBeFocused();
    await toggle.click();
  }
  await page.getByRole("link",{name:"EN",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("lang","en");await expect(page.locator("h1")).toContainText("STRONGER.");
});
test("preview form keeps input and sends no personal data",async({page})=>{
  const writes:string[]=[];page.on("request",request=>{if(!["GET","HEAD"].includes(request.method()))writes.push(request.url());});
  await page.goto("/contact?goal=technique&format=technique");await expect(page.locator('[name="goal"]')).toHaveValue("technique");await expect(page.locator('[name="format"]')).toHaveValue("technique");
  await page.getByLabel("Je naam",{exact:true}).fill("Test person");await page.getByLabel("E-mailadres",{exact:true}).fill("test@example.test");
  await page.getByRole("button",{name:"Verstuur je aanvraag"}).click();await expect(page.locator('[role="status"]')).toContainText("geen gegevens verstuurd");await expect(page.locator('[name="name"]')).toHaveValue("Test person");expect(writes).toEqual([]);
});

test("menu has an Admin link to the business workspace on Pages",async({page,isMobile})=>{
  await page.goto("/");await expect(page.locator(".admin-link")).toHaveCount(0);
  await page.goto("/Beck-In-The-Gym/preview/");
  if(isMobile)await page.getByRole("button",{name:"Menu"}).click();
  const admin=page.getByRole("link",{name:"Admin",exact:true});await expect(admin).toBeVisible();
  await expect(admin).toHaveAttribute("href","https://rutger0201.github.io/Beck-In-The-Gym/zakelijk/");
});

test("Pages links, vCard and QR work under the repository path",async({page})=>{
  const missing:string[]=[];page.on("response",response=>{if(response.status()>=400)missing.push(response.url());});
  const base="/Beck-In-The-Gym/preview";
  await page.goto(`${base}/visitekaartje/`);
  await expect(page).toHaveTitle(/Digitaal visitekaartje/);
  const qr=page.locator(".qr img");await expect(qr).toBeVisible();expect(await qr.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  const downloadPromise=page.waitForEvent("download");await page.getByRole("link",{name:"Opslaan in contacten"}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe("beck-in-the-gym.vcf");
  const vcard=await page.request.get(`${base}/contact.vcf`);expect(vcard.status()).toBe(200);expect(await vcard.text()).toContain("URL:https://rutger0201.github.io/Beck-In-The-Gym/preview/");
  await page.locator(".card-actions a").last().click();await expect(page).toHaveURL(new RegExp(`${base}/?$`));
  await page.goto(`${base}/en/business-card/`);await expect(page.locator("html")).toHaveAttribute("lang","en");
  expect(missing).toEqual([]);
});

test("preview submission is disabled when JavaScript is unavailable",async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
  await page.goto("http://127.0.0.1:4173/contact/");await expect(page.getByRole("button",{name:"Verstuur je aanvraag"})).toBeDisabled();await context.close();
});
