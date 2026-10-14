import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import covers from "../design/brand/v7/social-covers.json";
import { avitoReviews } from "../content/avito-reviews";
import { homepage } from "../content/homepage";
import { MODAL, interceptLeadApi, submitLeadForm } from "./helpers";

async function capture(page: import("@playwright/test").Page, name: string, selector?: string) {
  const directory = process.env.R7_CAPTURE_DIR;
  if (!directory) return;
  const original = page.viewportSize()!;
  const width = original.width < 700 ? 390 : 1440;
  await page.setViewportSize({ width, height: width === 390 ? 1250 : 1000 });
  await page.evaluate(() => document.fonts.ready);
  const options = { path: `${directory}/${name}-${width}.jpg`, quality: 86, scale: "css" as const, animations: "disabled" as const };
  if (selector) {
    await page.locator(selector).screenshot({ ...options, style: ".pk-header, .mobile-sticky-cta { visibility:hidden !important; }" });
  } else {
    await page.screenshot(options);
  }
  await page.setViewportSize(original);
}

async function noOverflow(page: import("@playwright/test").Page) {
  for (const width of [320, 360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width < 430 ? 568 : 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
}

test("R7 polish: real 404 has branded recovery, noindex and usable links", async ({ page }) => {
  const response = await page.goto("/r7-definitely-missing-page");
  expect(response?.status()).toBe(404);
  await capture(page, "404");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
  await noOverflow(page);
  await page.getByRole("main").getByRole("link", { name: "Все решения" }).click();
  await expect(page).toHaveURL(/\/uslugi$/);
});

test("R7 polish: privacy keeps eleven sections, real anchors and accessible layout", async ({ page }) => {
  await page.goto("/privacy");
  await capture(page, "privacy");
  await expect(page.locator(".pk-policy-content section")).toHaveCount(11);
  await expect(page.locator(".pk-policy-toc nav a")).toHaveCount(11);
  await page.locator('.pk-policy-toc a[href="#policy-section-10"]').click();
  await expect(page.locator("#policy-section-10 h2")).toBeInViewport();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
  await noOverflow(page);
});

test("R7 polish: original review quotations and direct form remain functional", async ({ page }) => {
  const leads = await interceptLeadApi(page);
  await page.goto("/");
  await expect(page.locator("#reviews .pk-review-card")).toHaveCount(4);
  await capture(page, "reviews", "#reviews");
  await page.locator("#reviews").getByRole("button", { name: /Показать все/ }).click();
  expect(await page.locator("#reviews blockquote p").allTextContents()).toEqual(avitoReviews.map(review => review.text));
  for (const selector of ["#proof", "#reviews", "#action"]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    if (selector !== "#reviews") await capture(page, selector.slice(1), selector);
    const result = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  }
  await noOverflow(page);
  await page.locator("#action").scrollIntoViewIfNeeded();
  await submitLeadForm(page, { name: "Тест интерфейса", phone: "9161234567" });
  await expect(page.locator("#action")).toContainText(/Заявка №\S+ сохранена|Заявка отправлена/);
  expect(leads).toHaveLength(1);
  expect(leads[0].source).toBe("home");
  expect(leads[0].consent).toBe(true);
});

test("R7 polish: work dialog contains keyboard focus and preserves calculator entry", async ({ page }) => {
  await page.goto("/#proof");
  const trigger = page.locator('#proof button[aria-label^="Открыть кейс:"]:visible').first();
  await trigger.click();
  const dialog = page.locator('.pk-proof-modal [role="dialog"]');
  await expect(dialog).toBeVisible();
  await capture(page, "work-dialog", '.pk-proof-modal [role="dialog"]');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i === 0 ? "Shift+Tab" : "Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  const result = await new AxeBuilder({ page }).include('.pk-proof-modal [role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await dialog.getByRole("button", { name: homepage.proof.items[0].ctaLabel, exact: true }).click();
  await expect(page.locator(MODAL)).toBeVisible();
});

test("R7 polish: all social cards, favicon, Apple icon and font are local assets", async ({ page }) => {
  test.setTimeout(90_000);
  for (const cover of covers) {
    await page.goto(cover.route);
    const expected = `https://potolkovo-msk.ru/brand/v7/social/${cover.id}.jpg`;
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", expected);
    await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute("content", expected);
    const response = await page.request.get(`/brand/v7/social/${cover.id}.jpg`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/jpeg");
  }
  await expect(page.locator('link[rel="apple-touch-icon"]').first()).toHaveAttribute("href", "/brand/v7/apple-touch-icon.png");
  for (const path of ["/favicon.ico", "/icon.svg", "/brand/v7/apple-touch-icon.png", "/brand/v7/inter-cyrillic-latin.woff2", "/manifest.webmanifest"]) expect((await page.request.get(path)).status()).toBe(200);
});
