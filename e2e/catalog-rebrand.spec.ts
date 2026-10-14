import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import snapshot from "../data/eks-feed2-snapshot.json";
import { interceptLeadApi, MODAL, submitLeadForm } from "./helpers";

const URL = "/uslugi/prodazha-trekovogo-osveshcheniya#price";
const products = snapshot.products;
async function open(page: Page) { await page.goto(URL); await page.locator(".pk-product").first().waitFor(); }
async function add(page: Page) { const card = page.locator(".pk-product").first(); await card.getByRole("button", { name: "Увеличить", exact: true }).click(); return card; }
async function drawer(page: Page) { await page.locator("[data-cart-bar]").getByRole("button", { name: "Посмотреть" }).click(); return page.getByRole("dialog", { name: "Корзина света", exact: true }); }
async function axe(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}

test("R7 catalog: responsive catalogue and drawer 320–1440 including short screens", async ({ page }) => {
  await open(page); await add(page);
  for (const width of [320, 360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 568 : 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const bar = page.locator("[data-cart-bar]");
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox(); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
    const panel = await drawer(page);
    const checkout = await panel.getByRole("button", { name: "Оформить", exact: true }).boundingBox();
    expect(checkout!.y).toBeGreaterThan(0); expect(checkout!.y + checkout!.height).toBeLessThanOrEqual(width <= 390 ? 568 : 900);
    await panel.getByRole("button", { name: "Закрыть корзину", exact: true }).click();
  }
});

test("R7 catalog: price sorting and arrow/Home/End category navigation", async ({ page }) => {
  await open(page);
  for (const direction of ["price-asc", "price-desc"]) {
    await page.getByLabel("Сортировка каталога").selectOption(direction);
    const values = await page.locator(".pk-product").evaluateAll(nodes => nodes.map(n => Number(n.getAttribute("data-price"))));
    expect(values).toEqual([...values].sort((a,b) => direction === "price-asc" ? a-b : b-a));
  }
  const first = page.getByRole("tab", { name: "Трековые системы", exact: true }); await first.focus();
  await page.keyboard.press("End"); await expect(page.getByRole("tab", { name: "Лампы", exact: true })).toBeFocused();
  await page.keyboard.press("Home"); await expect(first).toBeFocused();
  await page.keyboard.press("ArrowRight"); await expect(page.getByRole("tab", { name: "Точечные светильники", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("R7 catalog: SKU finds profiles outside active subtype; reset preserves cart", async ({ page }) => {
  await open(page); const selected = await add(page); const id = await selected.getAttribute("data-product-id");
  const profile = products.find(p => p.kind === "TRACK_PROFILE" && p.vendorCode === "0У-00006089")!;
  expect(profile).toBeTruthy();
  await page.getByLabel("Поиск по каталогу").fill(profile.vendorCode);
  await expect(page.locator(`.pk-product[data-product-id="${profile.productId}"]`)).toBeVisible();
  await expect(page.getByRole("group", { name: "Система трека", exact: true })).toHaveCount(0);
  await page.getByLabel("Поиск по каталогу").fill("R7-несуществующий-артикул");
  await expect(page.locator(".pk-catalog-empty")).toContainText("Ничего не найдено");
  await expect(page.getByText("Найдено ещё:", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Вернуть полный каталог" }).click();
  await expect(page.locator(`.pk-product[data-product-id="${id}"]`)).toHaveAttribute("data-selected", "true");
  await expect(page.getByLabel("Поиск по каталогу")).toHaveValue("");
});

test("R7 catalog: pagination, sorting reset and SMART do not change selection", async ({ page }) => {
  await open(page); await add(page);
  await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
  await expect(page.locator(".pk-product")).toHaveCount(24);
  await page.getByRole("button", { name: /Показать ещё/ }).click(); await expect(page.locator(".pk-product")).toHaveCount(48);
  await page.getByLabel("Сортировка каталога").selectOption("name"); await expect(page.locator(".pk-product")).toHaveCount(24);
  await page.getByRole("button", { name: "SMART", exact: true }).click();
  await expect(page.getByRole("button", { name: "SMART", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pk-smart-active")).toContainText("не подтверждает совместимость");
  await expect(page.locator("[data-cart-bar]")).toHaveAttribute("data-count", "1");
  await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Трековые системы", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("R7 catalog: drawer quantity persists across navigation and equipment-only lead retains it", async ({ page }) => {
  const leads = await interceptLeadApi(page); await open(page); const card = await add(page); const id = await card.getAttribute("data-product-id");
  const panel = await drawer(page);
  await panel.getByRole("button", { name: /^Увеличить:/ }).click();
  await expect(panel).toContainText("2 шт");
  await page.keyboard.press("Escape");
  // Shared provider survives client navigation. Calculator draft/reload is tested
  // separately in draft-restore.spec; catalogue-only reload is not persisted yet.
  await page.getByRole("link", { name: "Главная", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page.locator(`.pk-product[data-product-id="${id}"] output`)).toHaveText("2 шт");
  const restored = await drawer(page); await restored.getByRole("button", { name: "Оформить", exact: true }).click();
  const choice = page.getByRole("alertdialog", { name: "Как оформляем комплект?" });
  await choice.getByRole("button", { name: /Только оборудование/ }).click();
  await submitLeadForm(page, { scope: page.locator(MODAL) });
  const result = leads.at(-1)?.snapshot as { lighting: { items: { sku: string; qty: number }[] }; totals: { grand: number; lightingEffective: number; discountPct: number } };
  expect(result.totals.grand).toBe(result.totals.lightingEffective); expect(result.totals.discountPct).toBe(10);
  expect(result.lighting.items.find(i => i.sku === id)?.qty).toBe(2);
});

test("R7 catalog: drawer focus containment, dismissed checkout and explicit ceiling path", async ({ page }) => {
  await open(page); await add(page); const panel = await drawer(page);
  for (const key of ["Shift+Tab", "Tab", "Tab", "Tab", "Tab", "Tab", "Tab"]) {
    await page.keyboard.press(key); expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await panel.getByRole("button", { name: "Оформить", exact: true }).click();
  await expect(page.getByRole("alertdialog", { name: "Как оформляем комплект?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(MODAL)).toHaveCount(0);
  await expect(page.locator("[data-cart-bar]").getByRole("button", { name: "Оформить" })).toBeFocused();
  const reopened = await drawer(page); await reopened.getByRole("button", { name: "Оформить", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Как оформляем комплект?" }).getByRole("button", { name: /С потолком/ }).click();
  await expect(page.locator(MODAL).locator("#area-v2")).toBeVisible();
});

test("R7 catalog: axe catalogue, expanded card, empty state, drawer and photo", async ({ page }) => {
  await open(page); await axe(page, ".pk-catalog");
  const first = page.locator(".pk-product").first(); await first.locator("summary").click(); await axe(page, ".pk-catalog");
  const photo = first.getByRole("button", { name: "Открыть фото", exact: true }); await photo.click();
  const lightbox = page.getByRole("dialog", { name: "Просмотр изображения" });
  await expect(lightbox.getByRole("button", { name: "Закрыть", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(lightbox.getByRole("button", { name: "Закрыть", exact: true })).toBeFocused();
  await axe(page, ".pk-product-lightbox"); await page.keyboard.press("Escape"); await expect(photo).toBeFocused();
  await add(page); await drawer(page); await axe(page, ".pk-lighting-drawer"); await page.keyboard.press("Escape");
  await page.getByLabel("Поиск по каталогу").fill("R7-empty-404"); await axe(page, ".pk-catalog");
});

test("R7 catalog: failed local image uses visible fallback, not broken srcset", async ({ page }) => {
  await page.route("**/catalog/*.webp", route => route.abort());
  await open(page); const image = page.locator(".pk-product").first().locator("img"); await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute("src", /^data:image\/svg\+xml/); await expect(image).not.toHaveAttribute("srcset");
  await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await add(page); await expect(page.locator("[data-cart-bar]")).toBeVisible();
});
