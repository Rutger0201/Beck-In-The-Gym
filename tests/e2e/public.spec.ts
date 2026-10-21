import { test,expect } from "@playwright/test";
test("homepage, theme, mobile menu and language switch",async({page,isMobile})=>{
  await page.goto("/");await expect(page.locator("h1")).toContainText("STERKER.");
  await expect(page.locator("body")).not.toHaveJSProperty("scrollWidth",0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);
  await page.locator("#theme").selectOption("dark");await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  await page.reload();await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
  if(isMobile)await page.getByRole("button",{name:"Menu"}).click();
  await page.getByRole("link",{name:"EN",exact:true}).click();await expect(page.locator("html")).toHaveAttribute("lang","en");await expect(page.locator("h1")).toContainText("STRONGER.");
});
test("optional fields, preselection and failure preserve contact input",async({page})=>{
  await page.goto("/contact?goal=technique&format=technique");await expect(page.locator('[name="goal"]')).toHaveValue("technique");await expect(page.locator('[name="format"]')).toHaveValue("technique");
  await page.getByLabel("Je naam",{exact:true}).fill("Test person");await page.getByLabel("E-mailadres",{exact:true}).fill("test@example.test");
  await page.getByRole("button",{name:"Verstuur je aanvraag"}).click();await expect(page.locator('[role="status"]')).toContainText("niet gelukt");await expect(page.locator('[name="name"]')).toHaveValue("Test person");
});
