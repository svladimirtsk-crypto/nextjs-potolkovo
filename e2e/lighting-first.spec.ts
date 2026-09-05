import { expect, test } from "@playwright/test";

import { MODAL, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * T-091 · Сценарий 6 — вход «сначала свет»: готовый комплект со страницы
 * каталога, затем добавление потолка.
 *
 * Смысл сценария: набор, собранный до калькулятора, не должен потеряться и не
 * должен спрашиваться заново. Клиент уже выбрал профиль и светильники — если
 * Шаг 1 переспросит про трек, вся затея с готовыми комплектами теряет смысл.
 */
test.describe("Сценарий 6 · комплект «Для кухни» → с потолком", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 640, "desktop-раскладка");

  test("комплект доезжает до расчёта, трек не спрашивается заново", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya");

    const kit = page.locator("article").filter({ hasText: /Для кухни/ }).first();
    await kit.scrollIntoViewIfNeeded();
    await kit.getByRole("button", { name: /С потолком/ }).click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    // Шаг 0: комната 18 м². Экрана «трек» здесь быть не должно — он уже задан
    // комплектом, поэтому цепочка короче обычной.
    await modal.getByRole("button", { name: /^Комнату/ }).click();
    await modal.getByRole("button", { name: "18 м²", exact: true }).click();
    await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();

    const confirmed: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      if (await modal.getByRole("heading", { name: "Проверка" }).count()) break;
      const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
      if (!(await confirm.count())) break;
      confirmed.push(((await confirm.textContent()) ?? "").replace(/\s+/g, " ").trim());
      await confirm.click();
    }

    await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();

    // Трек комплектом уже определён — отдельного подтверждения трека не было.
    expect(confirmed.join(" | ")).not.toMatch(/трек/i);

    /**
     * Кнопка перехода к свету называется «Проверить свет», а не «Подобрать»:
     * подбирать нечего, набор уже есть. Это и есть видимый признак того, что
     * комплект доехал.
     */
    await expect(modal.getByRole("button", { name: /Проверить свет/ })).toBeVisible();
    await modal.getByRole("button", { name: /Проверить свет/ }).click();

    // Позиции комплекта на месте.
    const modalText = ((await modal.textContent()) ?? "").replace(/\s+/g, " ");
    expect(modalText).toMatch(/КОЛИБРИ|COLIBRI/i);
    expect(modalText).toMatch(/профил/i);

    const finish = modal.locator("button:visible").filter({ hasText: /К итогу/ }).first();
    await expect(finish).toBeEnabled();
    await finish.click();

    await submitLeadForm(page, { scope: modal });

    const lead = leads.at(-1);
    const snapshot = lead?.snapshot as
      | { lighting?: { items?: unknown[] }; totals?: Record<string, number> }
      | undefined;

    // Главное: набор уехал в заявку вместе с потолком.
    expect(snapshot?.lighting?.items?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot?.totals?.lightingEffective ?? 0).toBeGreaterThan(0);
    expect(snapshot?.totals?.grand ?? 0).toBeGreaterThan(0);

    // Вход «сначала свет» с добавлением потолка даёт скидку −25 %, а не −10 %.
    expect(snapshot?.totals?.discountPct).toBe(25);
  });
});
