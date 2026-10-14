import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { phase2ServiceSlugs } from "../content/services";
import { serviceDisplayOrder } from "../content/service-presentation";

for (const slug of phase2ServiceSlugs) {
  test(`R7 services: ${slug} layout, images, anchors, SEO and accessibility`, async ({ page }) => {
    await page.goto(`/uslugi/${slug}`);
    await expect(page.locator('main')).toHaveAttribute('data-service',slug);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/uslugi/${slug}$`));
    await expect(page.locator('#hero figure')).toHaveAttribute('data-image-kind','ai-visualization');
    await expect(page.locator('#hero figcaption')).toHaveText('Визуализация решения');
    await expect.poll(()=>page.locator('#hero img').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const cta=await page.locator('#hero [data-testid="hero-entry"]').boundingBox();
    const image=await page.locator('#hero figure').boundingBox();
    if ((page.viewportSize()?.width ?? 0)<1024) expect(cta!.y+cta!.height).toBeLessThanOrEqual(image!.y);
    for (const href of await page.locator('.pk-service-jumps a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')!))) await expect(page.locator(href)).toHaveCount(1);
    const result=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    for (const width of [320,360,390,430,768,1280,1440]) {
      await page.setViewportSize({width,height:width<=390?568:900});
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    }
  });
}

test("R7 services hub: nine real destinations, premium priority and standard shortcut",async({page})=>{
  await page.goto('/uslugi');
  const cards=page.locator('.pk-service-card');
  await expect(cards).toHaveCount(9);
  expect(await cards.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')))).toEqual(serviceDisplayOrder.map(s=>`/uslugi/${s}`));
  await page.getByRole('link',{name:'Стандартный потолок',exact:true}).click();
  await expect(page.locator('#service-prostye-potolki')).toBeInViewport();
  await expect(page.locator('#service-prostye-potolki figcaption')).toHaveText('Визуализация решения');
  const result=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(result.violations.map(v=>v.id)).toEqual([]);
  for(const width of [320,360,390,768,1440]) {await page.setViewportSize({width,height:900});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
});
