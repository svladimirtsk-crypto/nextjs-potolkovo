import { expect, test } from "@playwright/test";

import { interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * T-091 · Сценарии 4, 9, 10 — формы и навигация без калькулятора.
 *
 * Это самая ценная часть smoke-набора: форма на странице услуги должна
 * работать даже если калькулятор не открывали ни разу (регрессия SV-01).
 */

test.describe("Формы заявок", () => {
  test("сценарий 4: форма на странице услуги работает без калькулятора", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/uslugi/skrytye-karnizy#action");
    await submitLeadForm(page, { name: "Пётр", phone: "9161234567" });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    expect(leads).toHaveLength(1);
    const lead = leads[0];
    expect(lead.phone).toBe("+79161234567");
    expect(String(lead.source)).toContain("skrytye-karnizy");
    expect(lead.consent).toBe(true);
  });

  test("без согласия заявка не уходит", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/uslugi/skrytye-karnizy#action");
    await page.getByTestId("lead-name").fill("Пётр");
    await page.getByTestId("lead-phone").fill("9161234567");

    // Чекбокс намеренно не отмечаем — кнопка должна быть заблокирована.
    await expect(page.getByTestId("lead-submit")).toBeDisabled();
    expect(leads).toHaveLength(0);
  });

  test("сценарий 10: /#price сохраняет hash, хаб /uslugi отдаёт 9 карточек", async ({ page }) => {
    const response = await page.goto("/#price");
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("#price");
    await expect(page.locator("#price")).toBeVisible();

    const hub = await page.goto("/uslugi");
    expect(hub?.status()).toBe(200);

    const cards = page.locator('main a[href^="/uslugi/"]');
    await expect(cards).toHaveCount(9);
  });
});
