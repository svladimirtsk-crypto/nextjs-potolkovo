import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { contacts } from "../content/contacts";
import { lightingScenes } from "../content/brand-pages";
import { company } from "../content/company";

for (const route of ["/o-kompanii", "/umnoe-osveshchenie"]) {
  test(`R7 editorial: ${route} canonical, image, contacts, mobile and full-page axe`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://potolkovo-msk.ru${route}`);
    await expect(page.locator("#hero figcaption")).toHaveText("Визуализация решения");
    await expect.poll(() => page.locator("#hero img").evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(page.getByTestId("header-entry")).toHaveAttribute("href", "#action");
    for (const href of [contacts.phoneHref, contacts.telegramUrl, contacts.whatsappUrl, contacts.emailHref]) {
      await expect(page.locator(`#action a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('#action a[href="/#action"]')).toHaveCount(1);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    for (const width of [320, 360, 390, 430, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: width < 430 ? 568 : 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      if (width < 768) {
        const cta = await page.locator("#hero .pk-editorial-actions").boundingBox();
        const image = await page.locator("#hero figure").boundingBox();
        expect(cta!.y + cta!.height).toBeLessThanOrEqual(image!.y);
      }
    }
    await page.getByTestId("header-entry").click();
    await expect(page.locator("#editorial-contact-title")).toBeInViewport();
  });
}

test("R7 lighting: keyboard-operable scenes remain illustrative and never create an order", async ({ page }) => {
  let leads = 0;
  await page.route("**/api/lead", async route => { leads++; await route.abort(); });
  await page.goto("/umnoe-osveshchenie");
  const group = page.getByRole("group", { name: "Примеры сценариев освещения" });
  for (const scene of lightingScenes) {
    const button = group.getByRole("button", { name: scene.label, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator(".pk-scenes")).toHaveAttribute("data-scene", scene.id);
    await expect(page.locator("#scene-description h2")).toHaveText(scene.title);
    await expect(page.locator("#hero figcaption")).toBeVisible();
    const result = await new AxeBuilder({ page }).include("#hero").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map(v => v.id)).toEqual([]);
  }
  expect(leads).toBe(0);
  await expect(page.locator("main form")).toHaveCount(0);
  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schemas.join(" ")).not.toMatch(/"@type":"(?:Offer|Product)"/);
  await expect(page.locator('#compatibility a[href="/uslugi/prodazha-trekovogo-osveshcheniya"]')).toBeVisible();
});

test("R7 company: honest founder attribution, legal identity and premium routes", async ({ page }) => {
  await page.goto("/o-kompanii");
  await expect(page.locator("#people")).toContainText(company.about.founder);
  await expect(page.locator("#people")).toContainText("не обязательно выполняет каждый заказ лично");
  await expect(page.locator(".pk-editorial-legal")).toContainText(contacts.legalName);
  for (const item of company.solutions) await expect(page.locator(`.pk-editorial-directions a[href="/uslugi/${item.slug}"]`)).toHaveCount(1);
  for (const href of await page.locator(".pk-editorial-jumps a").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")!))) await expect(page.locator(href)).toHaveCount(1);
  await page.locator('.pk-editorial-directions a[href="/uslugi/tenevoy-profil"]').click();
  await expect(page).toHaveURL(/\/uslugi\/tenevoy-profil$/);
  await expect(page.getByTestId("hero-entry")).toBeVisible();
});

test("R7 navigation: new destinations work on desktop/mobile; price never points to a missing anchor", async ({ page }) => {
  await page.goto("/");
  const mobile = (page.viewportSize()?.width ?? 1280) < 1101;
  if (mobile) await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  let nav = page.getByRole("navigation", { name: mobile ? "Мобильная навигация" : "Основная навигация", exact: true });
  await nav.getByRole("link", { name: "Компания", exact: true }).click();
  await expect(page).toHaveURL(/\/o-kompanii$/);
  if (mobile) await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  nav = page.getByRole("navigation", { name: mobile ? "Мобильная навигация" : "Основная навигация", exact: true });
  await nav.getByRole("link", { name: "Умный свет", exact: true }).click();
  await expect(page).toHaveURL(/\/umnoe-osveshchenie$/);
  await expect(page.locator('#mobile-services-menu')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("navigation", { name: "Основная навигация", exact: true }).getByRole("link", { name: "Цена", exact: true }).click();
  await expect(page).toHaveURL(/\/#price$/);
  await expect(page.locator("#price")).toBeInViewport();
});
