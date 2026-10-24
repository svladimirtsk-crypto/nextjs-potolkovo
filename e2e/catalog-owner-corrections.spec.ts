import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MODAL, openCalculatorFromHero, completeAreaScreen, CALC_DRAFT_KEY } from "./helpers";
const URL = "/uslugi/prodazha-trekovogo-osveshcheniya#price";

test("Owner corrections: true panels exclude controls, accessories have their own category, retired SKU is absent", async ({ page }) => {
  const api = await page.request.get("/api/catalog");
  expect(api.ok()).toBe(true);
  const catalog = await api.json();
  expect(catalog.products.some((p: { vendorCode: string }) => p.vendorCode === "0У-00001341")).toBe(false);
  expect(catalog.products.find((p: { vendorCode: string }) => p.vendorCode === "0У-00002099").kind).toBe("TRACK_CONTROL");
  await page.goto(URL);
  await page.getByRole("tab", { name: "Точечные светильники", exact: true }).click();
  await page.getByRole("button", { name: "Панели", exact: true }).click();
  while (await page.getByRole("button", { name: /^Показать ещё/ }).count()) await page.getByRole("button", { name: /^Показать ещё/ }).click();
  const names = await page.locator(".pk-product").allTextContents();
  expect(names.length).toBeGreaterThan(20);
  expect(names.join(" ")).not.toMatch(/Панель управления|Конвертер|Отражатель|Крепление АРТ|Подвес накладной/i);
  await page.getByRole("tab", { name: "Крепёж и отражатели", exact: true }).click();
  await expect(page.locator(".pk-product")).toHaveCount(7);
  await expect(page.locator(".pk-product").first()).toContainText("Дополнение к светильнику");
  const result = await new AxeBuilder({ page }).include(".pk-catalog").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, why: n.failureSummary })) }))).toEqual([]);
  if (process.env.CALC_AUDIT_CAPTURE) await page.locator(".pk-catalog-grid").screenshot({ path: `${process.env.CALC_AUDIT_CAPTURE}/accessories-${test.info().project.name}.jpg`, type: "jpeg", quality: 85, scale: "css" });
  await page.getByLabel("Поиск по каталогу").fill("0У-00001341");
  await expect(page.locator(".pk-product")).toHaveCount(0);
  await expect(page.locator(".pk-search-matches button")).toHaveCount(0);
});

test("Owner corrections: track controls remain equipment, do not create fixture installation or lamp demand", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: "networkidle" });
  const controls = page.getByRole("button", { name: "Управление", exact: true });
  await controls.click();
  await expect(controls).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pk-product")).toHaveCount(5);
  await page.getByLabel("Поиск по каталогу").fill("0У-00002099");
  const control = page.locator(".pk-product"); await expect(control).toHaveCount(1);
  await expect(control).toContainText("Управление треком");
  await control.getByRole("button", { name: "Увеличить", exact: true }).click();
  await expect(page.locator(".pk-kit-review")).toHaveCount(0);
  await page.locator("[data-cart-bar]").last().getByRole("button", { name: "Оформить", exact: true }).click();
  await page.getByLabel("Как оформляем комплект?").getByRole("button", { name: /Только оборудование/ }).click();
  const m = page.locator(MODAL);await expect(m.getByTestId("estimate-card")).toBeVisible();
  await expect(m).not.toContainText(/Монтаж ещё.*светильник/);
  await expect(m.getByTestId("estimate-card")).not.toContainText("Потолок и работы");
  await m.getByRole("button", { name: "Изменить свет", exact: true }).click();
  await expect(m.getByRole("button", { name: "Выбранное (1)", exact: true })).toBeVisible();
  await m.getByRole("button", { name: "Каталог", exact: true }).click();
  await m.getByRole("button", { name: "Управление", exact: true }).click();
  await expect(m.locator(".pk-lighting-stage").getByText("КОЛИБРИ СМАРТ Панель управления для трековой системы, белая", { exact: true })).toBeVisible();
  if (process.env.CALC_AUDIT_CAPTURE) await m.screenshot({ path: `${process.env.CALC_AUDIT_CAPTURE}/track-controls-${test.info().project.name}.jpg`, type: "jpeg", quality: 85, scale: "css" });
});


test("Owner withdrawal: removed 0У-00001341 blocks stale-quote restore without erasing the draft", async ({ page }) => {
  await openCalculatorFromHero(page); await completeAreaScreen(page);
  await page.evaluate(key => {
    const draft = JSON.parse(sessionStorage.getItem(key)!);
    draft.cart = { mode: "catalog", items: [{ sku: "eks-0-00001341", vendorCode: "0У-00001341", name: "Снятый шинопровод КОЛИБРИ 2000 мм", qty: 1, priceRub: 5082 }], totalRub: 5082, userCustomizedLighting: true };
    sessionStorage.setItem(key, JSON.stringify(draft));
  }, CALC_DRAFT_KEY);
  await page.reload();
  await page.getByRole("button", { name: /Рассчитать стоимость/ }).first().click();
  const m = page.locator(MODAL);
  await m.getByRole("button", { name: "Продолжить расчёт", exact: true }).click();
  const review = m.getByTestId("catalog-draft-review");
  await expect(review.getByTestId("catalog-draft-diff")).toContainText("Снятый шинопровод");
  await expect(review).toContainText("Автоматически перенести расчёт нельзя");
  await expect(review.getByTestId("catalog-draft-accept")).toHaveCount(0);
  await expect(m.getByRole("button", { name: /К итогу/ })).toHaveCount(0);
  expect(await page.evaluate(key => sessionStorage.getItem(key), CALC_DRAFT_KEY)).toContain("0У-00001341");
  await review.getByTestId("catalog-draft-back").click();
  await expect(m.locator('[data-draft-choice="offer"]')).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), CALC_DRAFT_KEY)).toContain("0У-00001341");
});
