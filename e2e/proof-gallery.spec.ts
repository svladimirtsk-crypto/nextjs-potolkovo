import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { homepage } from "../content/homepage";
import { proofFilters, filterProofItems } from "../content/proof-gallery";
import { MODAL, clearCalcDraftStorage } from "./helpers";

test("R7 gallery: filters select existing solutions, do not create orders and remain accessible", async ({ page }) => {
  let leadRequests = 0;
  await page.route("**/api/lead", async route => { leadRequests++; await route.abort(); });
  await page.goto("/#proof");
  const group = page.getByRole("group", { name: "Фильтр решений" });
  for (const filter of proofFilters) {
    const button = group.getByRole("button", { name: filter.label, exact: true });
    await button.focus(); await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
    expect(await page.locator("#proof-grid article").evaluateAll(nodes => nodes.map(el => el.getAttribute("data-proof-slug")))).toEqual(filterProofItems(filter.id).map(item => item.slug));
    await expect(page.locator(".pk-gallery-count")).toHaveText(`Показано: ${filterProofItems(filter.id).length} из 6`);
  }
  expect(leadRequests).toBe(0);
  await expect(page.locator(MODAL)).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include("#proof").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
});

test("R7 gallery: photos, budget disclosure, filtered work navigation and focus return", async ({ page }) => {
  await page.goto("/#proof");
  await page.getByRole("group", { name: "Фильтр решений" }).getByRole("button", { name: "Освещение", exact: true }).click();
  const trigger = page.locator('#proof button[aria-label^="Открыть кейс:"]').first();
  await trigger.click();
  const dialog = page.locator('.pk-proof-editorial [role="dialog"]');
  const photos = dialog.getByRole("region", { name: "Фотографии решения" });
  await expect(dialog).toHaveAccessibleName(homepage.proof.items[0].title);
  await expect(photos.getByRole("status")).toHaveText("Фото 1 / 3");
  await photos.getByRole("button", { name: "Показать фото 2" }).click();
  await expect(photos.getByRole("status")).toHaveText("Фото 2 / 3");
  await expect(photos.getByRole("button", { name: "Показать фото 2" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowRight");
  await expect(photos.getByRole("status")).toHaveText("Фото 3 / 3");
  await expect(dialog).toHaveAccessibleName(homepage.proof.items[0].title);
  await expect(photos.getByRole("link", { name: /Оригинал фото/ })).toHaveAttribute("href", "/proj-shadow-3.jpeg");
  await dialog.locator(".pk-proof-budget-details summary").click();
  await expect(dialog.locator(".pk-proof-budget-details")).toHaveAttribute("open", "");
  await expect(dialog.locator(".pk-proof-budget-sum")).toContainText(new Intl.NumberFormat("ru-RU").format(homepage.proof.items[0].budgetBreakdown.totalRub));
  const axe = await new AxeBuilder({ page }).include('.pk-proof-editorial [role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await dialog.getByRole("button", { name: "Следующая работа" }).click();
  await expect(dialog).toHaveAccessibleName(homepage.proof.items[1].title);
  await expect(photos.getByRole("status")).toHaveText("Фото 1 / 3");
  await dialog.getByRole("button", { name: "Следующая работа" }).click();
  await expect(dialog).toHaveAccessibleName(homepage.proof.items[2].title);
  await dialog.getByRole("button", { name: "Следующая работа" }).click();
  await expect(dialog).toHaveAccessibleName(homepage.proof.items[0].title);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const entry of ["card", "dialog"]) test(`R7 gallery: ${entry} preserves explicit calculator presets`, async ({ page }) => {
    await page.goto("/#proof"); await clearCalcDraftStorage(page);
    const card = page.locator('[data-proof-slug="shadow-track-apartment"]');
    if (entry === "card") await card.getByRole("button", { name: /Хочу похожее/ }).click();
    else {
      await card.locator('button[aria-label^="Открыть кейс:"]').click();
      await page.getByRole("dialog").getByRole("button", { name: /Хочу похожее решение/ }).click();
    }
    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();
    await expect(modal.getByLabel("Площадь потолка, м²", { exact: true })).toHaveValue("18");
    await expect(page.locator(".pk-proof-editorial")).toHaveCount(0);
});

test("R7 gallery: bespoke project is a consultation, not a fictitious standard quote", async ({ page }) => {
  await page.goto("/#proof");
  const card = page.locator('[data-proof-slug="custom-dome"]');
  await card.locator('button[aria-label^="Открыть кейс:"]').click();
  const dialog = page.locator('.pk-proof-editorial [role="dialog"]');
  await expect(dialog.getByRole("button", { name: /Хочу похожее/ })).toHaveCount(0);
  await dialog.getByRole("link", { name: /Обсудить проект/ }).click();
  await expect(page).toHaveURL(/\/uslugi\/individualnye-proekty#action$/);
  await expect(page.locator(MODAL)).toHaveCount(0);
});

test("R7 gallery: responsive layout and dialog fit short and narrow viewports", async ({ page }) => {
  await page.goto("/#proof");
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 430 ? 568 : 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator('#proof button[aria-label^="Открыть кейс:"]').first().click();
    const dialog = page.locator('.pk-proof-editorial [role="dialog"]');
    await expect(dialog.getByRole("button", { name: "Закрыть", exact: true })).toBeInViewport();
    await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const action = dialog.getByRole("button", { name: /Хочу похожее решение/ });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await page.keyboard.press("Escape");
  }
});
