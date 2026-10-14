import { expect, test } from "@playwright/test";
import { company } from "@/content/company";
import { serviceLinks } from "@/content/service-links";
import { clearCalcDraftStorage, MODAL } from "./helpers";

test("R7: company hero, visible image provenance and premium solutions", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("#hero");
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText(/Потолок и свет,\s*продуманные\s*вместе/);
  await expect(hero.locator("figcaption")).toHaveText("Визуализация решения");
  await expect(hero).not.toContainText(/делаю сам|без бригад|1 объект = 1 мастер|Владимир/);
  await expect(hero.locator("img")).toHaveJSProperty("complete", true);
  expect(await hero.locator("img").evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  for (const item of company.solutions) {
    await expect(page.locator("#solutions").getByRole("heading", { name: item.title })).toBeVisible();
    await expect(page.locator("#solutions article").getByRole("link", { name: item.title, exact: true })).toHaveAttribute("href", `/uslugi/${item.slug}`);
  }
  for (const service of serviceLinks) {
    await expect(page.getByRole("navigation", { name: "Все направления ПОТОЛКОВО" }).locator(`a[href="${service.href}"]`)).toHaveCount(1);
  }
});

for (const entry of ["hero-entry", "header-entry"]) {
  test(`R7: ${entry} still opens the real calculator`, async ({ page }) => {
    await page.goto("/");
    await clearCalcDraftStorage(page);
    await page.getByTestId(entry).click();
    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Площадь потолка, м²", { exact: true })).toBeVisible();
  });
}

test("R7: compact header does not hide overflow; mobile disclosure has all services", async ({ page }) => {
  await page.goto("/");
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    const outside = await page.locator(".pk-header").evaluate(header => [...header.querySelectorAll("a,button")]
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + 0.5; })
      .map(el => el.textContent));
    expect(outside, `${width}px header`).toEqual([]);
    await expect(page.getByTestId("header-entry")).toBeVisible();
  }
  const toggle = page.getByRole("button", { name: "Открыть меню", exact: true });
  await toggle.click();
  const menu = page.getByRole("navigation", { name: "Мобильная навигация" });
  for (const service of serviceLinks) await expect(menu.locator(`a[href="${service.href}"]`)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(toggle).toBeFocused();
});

test("R7: desktop disclosure is keyboard-operable and catalogue remains reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Решения" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator('#desktop-services-menu a').first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("navigation", { name: "Основная навигация" }).getByRole("link", { name: "Каталог света" }).click();
  await expect(page).toHaveURL(/\/uslugi\/prodazha-trekovogo-osveshcheniya/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
