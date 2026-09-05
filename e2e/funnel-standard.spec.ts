import { expect, test } from "@playwright/test";

import { MODAL, addSecondRoom, completeAreaScreen, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * N-003 · Сценарии 1 и 7 из T-091 — основная воронка «потолок → заявка».
 *
 * Это главный денежный путь: если он молча ломается, сайт продолжает
 * выглядеть рабочим, но заявки не доходят. Поэтому проверяем не только факт
 * успеха, но и содержимое payload — снапшот комнат должен доехать до API.
 */

test.describe("Воронка · стандартный сценарий", () => {
  test("сценарий 1: главная → квиз 18 м² / 6 точек → итог → заявка", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });

    await modal.getByRole("button", { name: /К итогу/ }).first().click();
    await expect(modal.getByRole("heading", { name: "Итог расчета" })).toBeVisible();

    await submitLeadForm(page, { name: "Иван", phone: "9055219909", scope: modal });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    expect(leads).toHaveLength(1);
    const lead = leads[0];
    expect(lead.phone).toBe("+79055219909");
    expect(lead.consent).toBe(true);

    // Снапшот расчёта обязан доехать: без него менеджер перезванивает вслепую.
    const snapshot = lead.snapshot as { rooms?: unknown[] } | undefined;
    expect(Array.isArray(snapshot?.rooms)).toBe(true);
    expect(snapshot?.rooms?.length).toBe(1);
  });

  test("сценарий 7: две комнаты попадают в снапшот заявки", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });

    await addSecondRoom(page, { room: "+ Кухня", area: "20 м²" });

    await modal.getByRole("button", { name: /К итогу/ }).first().click();
    await submitLeadForm(page, { name: "Ольга", phone: "9161112233", scope: modal });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    expect(leads).toHaveLength(1);
    const snapshot = leads[0].snapshot as { rooms?: unknown[] } | undefined;
    expect(snapshot?.rooms?.length).toBe(2);
  });
});
