import { expect, test } from "@playwright/test";

import { MODAL, completeAreaScreen, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * N-003 · Сценарии 8 и 9 из T-091 — «спасение» расчёта и черновик.
 *
 * Rescue — последняя точка контакта: человек уже уходит, и единственный шанс
 * не потерять расчёт. Регрессия здесь незаметна глазом (модалка закрывается
 * как обычно), поэтому нужен тест на сам факт отправки с `leadKind=rescue`.
 */

const RESCUE_PHONE_PLACEHOLDER = "+7 900 000-00-00";

test.describe("Rescue и черновик", () => {
  test("сценарий 8: закрытие с данными → rescue-диалог → lead_kind=rescue", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await page.locator(MODAL).waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });

    await page.getByRole("button", { name: "Закрыть" }).first().click();

    // Диалог-«спасалка» с полем телефона, а не обычный confirm.
    const phone = page.getByPlaceholder(RESCUE_PHONE_PLACEHOLDER);
    await expect(phone).toBeVisible();
    await expect(page.getByRole("button", { name: "Отправить" })).toBeVisible();

    await phone.fill("9161234567");
    await page.getByRole("button", { name: "Отправить" }).click();

    await expect.poll(() => leads.length).toBe(1);
    const lead = leads[0];
    expect(lead.leadKind).toBe("rescue");
    expect(lead.consent).toBe(true);
    expect(String(lead.phone)).toContain("9161234567");
  });

  test("«Просто закрыть» не отправляет заявку", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await page.locator(MODAL).waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });

    await page.getByRole("button", { name: "Закрыть" }).first().click();
    await page.getByRole("button", { name: "Просто закрыть" }).click();

    // Модалка закрылась, и наружу ничего не ушло — обещание в тексте диалога.
    await expect(page.locator(MODAL)).toBeHidden();
    expect(leads).toHaveLength(0);
  });

  test("сценарий 9: после отправки повторное закрытие не переспрашивает", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    const modal = page.locator(MODAL);
    await modal.waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });
    await modal.getByRole("button", { name: /К итогу/ }).first().click();

    await submitLeadForm(page, { name: "Иван", phone: "9055219909", scope: modal });
    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();
    expect(leads).toHaveLength(1);

    // T-023: расчёт уже у мастера — второй раз клянчить телефон нельзя.
    await page.getByRole("button", { name: "Закрыть" }).first().click();
    await expect(page.getByRole("button", { name: "Просто закрыть" })).toHaveCount(0);
    await expect(page.locator(MODAL)).toBeHidden();

    // Повторное открытие доступно и не залипает на «уже отправлено».
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await modal.waitFor();
    await expect(modal.getByRole("button", { name: /Подтвердить площадь/ })).toBeVisible();

    // Лид ровно один: закрытие после успеха не должно слать дубль.
    expect(leads).toHaveLength(1);
  });

});
