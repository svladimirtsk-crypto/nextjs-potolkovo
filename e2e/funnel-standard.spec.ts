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

    /**
     * N-012 · Ценовая полоса до и после первого ответа. До него сумма — это
     * дефолтная комната, а не выбор человека, поэтому вместо цифры стоит
     * приглашение ответить.
     */
    const strip = modal.locator("[data-strip-state]").locator("visible=true").first();
    await expect(strip).toHaveAttribute("data-strip-state", "idle");
    await expect(strip).toContainText(/Ответьте на \d+ вопрос/);
    await expect(strip).not.toContainText("₽");

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });

    await expect(strip).not.toHaveAttribute("data-strip-state", "idle");
    await expect(strip).toContainText("₽");

    await modal.getByRole("button", { name: /К итогу/ }).first().click();
    await expect(modal.getByRole("heading", { name: "Итог расчета" })).toBeVisible();

    await submitLeadForm(page, { name: "Иван", phone: "9055219909", scope: modal });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    /**
     * N-061 (F-20): экран успеха предлагает следующий шаг, а не только
     * «ждите звонка». Ссылка несёт номер заявки, чтобы присланные фото не
     * пришлось связывать с ней вручную.
     */
    const telegram = modal.getByTestId("success-telegram");
    await expect(telegram).toBeVisible();

    const href = decodeURIComponent((await telegram.getAttribute("href")) ?? "");
    expect(href).toContain("t.me/");
    expect(href).toMatch(/text=.*фото/i);
    expect(href).toContain("E2E01");

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

    await addSecondRoom(page, { room: "+ Кухня", area: "22 м²" });

    await modal.getByRole("button", { name: /К итогу/ }).first().click();
    await submitLeadForm(page, { name: "Ольга", phone: "9161112233", scope: modal });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    expect(leads).toHaveLength(1);
    const snapshot = leads[0].snapshot as { rooms?: unknown[] } | undefined;
    expect(snapshot?.rooms?.length).toBe(2);
  });
});
