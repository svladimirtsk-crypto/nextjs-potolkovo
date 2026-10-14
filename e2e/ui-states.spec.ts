import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MODAL, openCalculatorFromHero, completeAreaScreen, interceptLeadApi, submitLeadForm, type LeadApiStub } from "./helpers";

async function summary(page: Page) {
  await openCalculatorFromHero(page); await completeAreaScreen(page);
  const modal = page.locator(MODAL);
  await modal.getByRole("button", { name: /К итогу/ }).first().click();
  await expect(modal.getByTestId("estimate-card")).toBeVisible();
  return modal;
}
async function axe(page: Page, selector: string) {
  const result = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })) ).toEqual([]);
}
async function capture(page: Page, selector: string, name: string) {
  if (!process.env.STATE_CAPTURE_DIR) return;
  await page.locator(selector).screenshot({ path: `${process.env.STATE_CAPTURE_DIR}/${name}-${test.info().project.name}.png` });
}

test("B8 states: server failure, retry and saved request preserve input and request ID", async ({ page }) => {
  const stub: LeadApiStub = { status: 500, body: { ok: false, error: "internal" } };
  const leads = await interceptLeadApi(page, stub);
  await page.goto("/"); await submitLeadForm(page, { name: "Тест состояний", phone: "9161234567" });
  const alert = page.getByTestId("lead-error-alert");
  await expect(alert).toContainText("Не удалось завершить отправку");
  await expect(page.getByTestId("lead-name")).toHaveValue("Тест состояний");
  await axe(page, '[data-testid="lead-error-alert"]');
  await capture(page, '[data-testid="lead-error-alert"]', "lead-error");
  stub.status = 201; stub.body = { ok: true, leadId: "B8-STATE", status: "queued" };
  await page.getByTestId("lead-retry-button").click();
  await expect(page.locator("#action")).toContainText("Заявка №B8-STATE сохранена");
  expect(leads).toHaveLength(2); expect(leads[1].requestId).toBe(leads[0].requestId);
  await axe(page, "#action .pk-state--success");
  await capture(page, "#action .pk-state--success", "lead-success");
});

test("B8 states: empty selection and empty search have an explicit way back without changing the estimate", async ({ page }) => {
  const modal = await summary(page);
  const total = await modal.locator(".pk-estimate-total").innerText();
  await modal.getByRole("button", { name: "Изменить свет", exact: true }).click();
  await modal.getByRole("button", { name: "Выбранное (0)", exact: true }).click();
  await expect(modal.getByTestId("selected-empty")).toContainText("Пока ничего не выбрано");
  await capture(page, '[data-testid="selected-empty"]', "selection-empty");
  await modal.getByRole("button", { name: "Перейти в каталог", exact: true }).click();
  const search = modal.getByRole("textbox", { name: "Поиск в текущем разделе", exact: true });
  await search.fill("B8-NO-SUCH-PRODUCT");
  await expect(modal.getByTestId("modal-catalog-empty")).toBeVisible();
  await axe(page, '.pk-lighting-stage');
  await capture(page, '[data-testid="modal-catalog-empty"]', "search-empty");
  await modal.getByRole("button", { name: "Сбросить поиск", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(modal.getByTestId("modal-catalog-empty")).toHaveCount(0);
  await modal.locator(".calculator-modal-footer").getByRole("button", { name: /К итогу/ }).click();
  await expect(modal.locator(".pk-estimate-total")).toHaveText(total);
});

test("B8 states: pending rescue traps keyboard focus and error actions fit a short screen", async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/lead", async route => {
    await hold;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "internal" }) });
  });
  const modal = await summary(page);
  await modal.getByRole("button", { name: "Закрыть", exact: true }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Телефон", { exact: true }).fill("9161234567");
  await dialog.getByTestId("rescue-consent").check();
  await page.setViewportSize({ width: 320, height: 400 });
  await dialog.getByTestId("confirm-dialog-submit").click();
  await expect(dialog).toHaveAttribute("aria-busy", "true");
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  release();
  await expect(dialog.getByTestId("confirm-dialog-error")).toBeVisible();
  await expect(dialog.getByTestId("confirm-dialog-submit")).toBeFocused();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 400 : 900 });
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    for (const id of ["confirm-dialog-cancel", "confirm-dialog-submit"]) {
      const button = dialog.getByTestId(id); await button.scrollIntoViewIfNeeded();
      const b = await button.boundingBox(); expect(b!.height).toBeGreaterThanOrEqual(44); expect(b!.y).toBeGreaterThanOrEqual(0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(width < 500 ? 400 : 900);
    }
  }
  await axe(page, '[role="alertdialog"]');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, '[role="alertdialog"]', "rescue-error");
});

// Exercise the actual lazy data chunk; no test-only flags are shipped in the app.
function indexChunk(): string {
  const dir = path.join(process.cwd(), ".next/static/chunks");
  const files = readdirSync(dir).filter(f => f.endsWith(".js") && (() => {
    const text = readFileSync(path.join(dir, f), "utf8");
    return text.includes('"imagePrefix"') && text.includes('"dictionaries"') && text.includes('"rows"');
  })());
  expect(files).toHaveLength(1);
  return files[0];
}

test("B8 states: delayed catalog, failure and explicit recovery keep the same page and ceiling estimate", async ({ page }) => {
  const chunk = indexChunk(); let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  let allowSuccess = false;
  await page.route(`**/_next/static/chunks/${chunk}*`, async route => {
    if (!allowSuccess) { await hold; await route.abort("failed"); }
    else await route.continue();
  });
  const modal = await summary(page);
  const total = await modal.locator(".pk-estimate-total").innerText();
  await page.evaluate(() => { (window as Window & { b8NoReload?: boolean }).b8NoReload = true; });
  await modal.getByRole("button", { name: "Изменить свет", exact: true }).click();
  await expect(modal.getByTestId("catalog-load-state")).toHaveAttribute("data-ui-state", "loading");
  await expect(modal.getByTestId("selected-empty")).toHaveCount(0);
  await capture(page, '[data-testid="catalog-load-state"]', "catalog-loading");
  release();
  await expect(modal.getByTestId("catalog-load-state")).toHaveAttribute("data-ui-state", "error");
  await capture(page, '[data-testid="catalog-load-state"]', "catalog-error");
  allowSuccess = true;
  await modal.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await expect(modal.getByTestId("catalog-load-state")).toHaveCount(0);
  expect(await page.evaluate(() => (window as Window & { b8NoReload?: boolean }).b8NoReload)).toBe(true);
  await modal.getByRole("button", { name: "Выбранное (0)", exact: true }).click();
  await modal.locator(".calculator-modal-footer").getByRole("button", { name: /К итогу/ }).click();
  await expect(modal.locator(".pk-estimate-total")).toHaveText(total);
});
