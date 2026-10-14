import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MODAL, completeAreaScreen, interceptLeadApi, openCalculatorFromHero, submitLeadForm } from "./helpers";

async function startCeiling(page: Page) {
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
  return modal;
}

async function finishParameters(modal: Locator) {
  for (let i = 0; i < 12; i++) {
    if (await modal.getByRole("heading", { name: "Проверка", exact: true }).count()) break;
    await modal.locator(".calculator-modal-footer button").filter({ hasText: /^Подтвердить/ }).click();
  }
  await expect(modal.getByRole("heading", { name: "Проверка", exact: true })).toBeVisible();
}

async function accessible(page: Page, state: string) {
  const result = await new AxeBuilder({ page }).include(MODAL).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) })), state).toEqual([]);
}

test("R7 calculator: layout and visible steps survive 320–1440px", async ({ page }) => {
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await modal.locator("#area-v2").waitFor();
  for (const width of [320, 360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: width <= 390 ? 568 : 900 });
    await expect.poll(async () => Math.round((await modal.boundingBox())!.width)).toBe(Math.min(width, 1200));
    await expect(modal.getByRole("navigation", { name: "Шаги калькулятора" }).getByRole("button")).toHaveCount(3);
    const bad = await modal.evaluate(root => {
      const r = root.getBoundingClientRect();
      return [...root.querySelectorAll(".pk-calc-header button,.calculator-modal-footer button,#area-v2")]
        .filter(el => el.getClientRects().length)
        .filter(el => { const b = el.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1; })
        .map(el => el.textContent);
    });
    expect(bad, `${width}px controls`).toEqual([]);
    const scroll = await modal.locator(".calculator-modal-content").evaluate(el => el.scrollWidth - el.clientWidth);
    expect(scroll, `${width}px content overflow`).toBeLessThanOrEqual(1);
    if (width <= 390) {
      const input = modal.locator("#area-v2");
      await input.scrollIntoViewIfNeeded();
      const field = await input.boundingBox();
      const footer = await modal.locator(".calculator-modal-footer").boundingBox();
      expect(field!.y + field!.height, `${width}×568 field above actions`).toBeLessThanOrEqual(footer!.y);
    }
  }
});

test("R7 calculator: browsing premium solutions never silently changes the estimate", async ({ page }) => {
  const modal = await startCeiling(page);
  const strip = modal.locator("[data-strip-state]:visible");
  await expect(strip).toHaveCount(1);
  const amount = await strip.innerText();
  await modal.getByRole("button", { name: /Показать теневой и парящий/ }).click();
  await expect(strip).toHaveText(amount);
  await expect(modal.locator('[data-ceiling-option="shadow"]')).toHaveAttribute("aria-pressed", "false");
  await expect(modal.locator('[data-ceiling-option="floating"]')).toHaveAttribute("aria-pressed", "false");
  await expect(modal.locator('[data-ceiling-option="standard"]')).toHaveAttribute("aria-pressed", "true");
  await modal.locator('[data-ceiling-option="floating"]').click();
  await expect(modal.locator('[data-ceiling-option="floating"]')).toHaveAttribute("aria-pressed", "true");
  await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
  await expect(modal.getByRole("heading", { name: "Парящий профиль", exact: true })).toBeVisible();
});

test("R7 calculator: premium choices and edited metres survive into the lead", async ({ page }) => {
  const leads = await interceptLeadApi(page);
  const modal = await startCeiling(page);
  await modal.getByRole("button", { name: /Показать теневой/ }).click();
  await modal.locator('[data-ceiling-option="shadow"]').click();
  await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
  await modal.getByRole("button", { name: /Частично/ }).click();
  await modal.getByLabel("Длина теневого профиля, м.п.", { exact: true }).fill("6");
  for (let i = 0; i < 12; i++) {
    if (await modal.getByRole("heading", { name: "Проверка", exact: true }).count()) break;
    if (await modal.getByRole("heading", { name: "Карнизы", exact: true }).count()) {
      await modal.getByRole("button", { name: /Скрытая ниша/ }).click();
      await modal.getByLabel("Длина карниза, м.п.", { exact: true }).fill("3");
    }
    if (await modal.getByRole("heading", { name: "Световые линии", exact: true }).count()) {
      await modal.getByRole("button", { name: /Добавить световые линии/ }).click();
      await modal.getByLabel("Длина световых линий, м.п.", { exact: true }).fill("4");
    }
    await modal.locator(".calculator-modal-footer button").filter({ hasText: /^Подтвердить/ }).click();
  }
  await modal.getByRole("button", { name: /Редактировать:/ }).click();
  const lines = modal.locator(".pk-question .flex.items-center.justify-between").filter({ hasText: "Световые линии:" });
  await lines.getByRole("button", { name: "Изменить", exact: true }).click();
  await modal.getByLabel("Длина световых линий, м.п.", { exact: true }).fill("5");
  await modal.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
  await modal.locator(".calculator-modal-footer").getByRole("button", { name: /Готово/ }).click();
  await modal.getByRole("button", { name: /К итогу/ }).first().click();
  const estimate = modal.getByTestId("estimate-card");
  await expect(estimate).toContainText("Предварительно");
  const visibleTotal = Number((await estimate.locator(".pk-estimate-total").innerText()).replace(/\D/g, ""));
  await submitLeadForm(page, { scope: modal });
  await expect(modal.getByText(/Заявка №.* сохранена/)).toBeVisible();
  const snapshot = leads[0].snapshot as { rooms: Array<Record<string, unknown>>; totals: { grand: number } };
  expect(snapshot.rooms[0]).toMatchObject({ area: 18, shadowEnabled: true, shadowLength: 6, lightLinesEnabled: true, lightLinesLength: 5, corniceType: "hidden-niche", corniceLength: 3 });
  expect(snapshot.totals.grand).toBe(visibleTotal);
  await expect(modal.locator(".calculator-modal-footer").getByRole("button", { name: "Готово", exact: true })).toBeVisible();
});

test("R7 calculator: axe on area, ceiling, room review, estimate and lighting", async ({ page }) => {
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await modal.locator("#area-v2").waitFor();
  await accessible(page, "area");
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
  await modal.getByRole("button", { name: /Показать теневой/ }).click();
  await modal.locator('[data-ceiling-option="shadow"]').click();
  await accessible(page, "ceiling");
  await finishParameters(modal);
  await accessible(page, "room review");
  await modal.getByRole("button", { name: /К итогу/ }).first().click();
  await modal.getByTestId("estimate-card").waitFor();
  await accessible(page, "estimate");
  await modal.getByRole("button", { name: "Изменить свет", exact: true }).click();
  await modal.getByRole("button", { name: "Каталог", exact: true }).waitFor();
  await accessible(page, "lighting");
});

test("R7 calculator: lighting-only has no ceiling charge and uses invoice CTA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const leads = await interceptLeadApi(page);
  await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");
  await page.getByRole("button", { name: "Увеличить", exact: true }).first().click();
  await page.locator("[data-cart-bar]").last().getByRole("button", { name: "Оформить" }).click();
  await page.getByLabel("Как оформляем комплект?").getByRole("button", { name: /Только оборудование/ }).click();
  const modal = page.locator(MODAL);
  await expect(modal.getByTestId("estimate-card")).not.toContainText("Потолок и работы");
  await expect(modal.locator(".calculator-modal-footer")).not.toContainText("Записаться на замер");
  await accessible(page, "lighting-only estimate");
  await submitLeadForm(page, { scope: modal });
  await expect(modal.getByText(/Заявка №.* сохранена/)).toBeVisible();
  const snapshot = leads[0].snapshot as { totals: { grand: number; lightingEffective: number; discountPct: number } };
  expect(snapshot.totals.grand).toBe(snapshot.totals.lightingEffective);
  expect(snapshot.totals.discountPct).toBe(10);
});

test("R7 calculator: keyboard focus stays in dialog, including collapsed details", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await completeAreaScreen(page);
  await modal.getByRole("button", { name: /К итогу/ }).first().click();
  await modal.getByRole("button", { name: "Закрыть", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await modal.evaluate(root => root.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await modal.evaluate(root => root.contains(document.activeElement)), `Tab ${i}`).toBe(true);
  }
});
