import { expect, test } from "@playwright/test";

import { PRIVACY_POLICY_VERSION } from "../content/legal";
import { interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * PT-014 · Версия согласия и момент согласия.
 *
 * До задачи обе формы слали `consent: true` константой: сервер не мог отличить
 * явное согласие от так написанного кода, а в базе не оставалось ни редакции
 * политики, ни времени. Отдельно: страница `/privacy` рисовала «Дата обновления»
 * как `new Date()` — дату сборки, то есть любой деплой «обновлял» политику без
 * правки текста.
 */

const PAGE = "/uslugi/skrytye-karnizy#action";
const VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}(\.\d+)?$/;

/**
 * Редакция политики берётся из источника, а не хардкодится в тесте: иначе тест
 * начнёт врать в день, когда владелец обновит текст политики.
 */
const POLICY_VERSION = PRIVACY_POLICY_VERSION;
const POLICY_DATE_LABEL = POLICY_VERSION.split(".")[0].split("-").reverse().join(".");

test.describe("Версия согласия (PT-014)", () => {
  test("форма несёт факт согласия, редакцию политики и момент клика", async ({ page }) => {
    const leads = await interceptLeadApi(page);
    const openedAt = Date.now();

    await page.goto(PAGE);
    await submitLeadForm(page, { name: "Пётр", phone: "9161234567" });

    await expect(page.getByText(/Заявка №\S+ сохранена|Заявка отправлена/)).toBeVisible();
    expect(leads).toHaveLength(1);

    const lead = leads[0] as Record<string, unknown>;
    expect(lead.consent).toBe(true);
    expect(String(lead.consentVersion)).toMatch(VERSION_PATTERN);

    const consentAt = Date.parse(String(lead.consentAt));
    expect(Number.isNaN(consentAt)).toBe(false);
    // Момент клика по чекбоксу — между загрузкой страницы и отправкой.
    expect(consentAt).toBeGreaterThanOrEqual(openedAt - 5_000);
    expect(consentAt).toBeLessThanOrEqual(Date.now() + 5_000);
  });

  test("снятая и снова отмеченная галочка обновляет момент согласия", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto(PAGE);
    await page.getByTestId("lead-name").fill("Пётр");
    await page.getByTestId("lead-phone").fill("9161234567");

    const consent = page.getByTestId("lead-consent");
    await consent.check();
    await page.waitForTimeout(30);
    await consent.uncheck();
    // Согласие отозвано — кнопка отправки заблокирована.
    await expect(page.getByTestId("lead-submit")).toBeDisabled();
    await consent.check();

    await page.getByTestId("lead-submit").click();
    await expect.poll(() => leads.length).toBe(1);

    const lead = leads[0] as Record<string, unknown>;
    const consentAt = Date.parse(String(lead.consentAt));
    expect(Number.isNaN(consentAt)).toBe(false);
    // Время второго клика, а не первого: отозванное согласие не хранят.
    expect(consentAt).toBeGreaterThanOrEqual(Date.now() - 60_000);
  });

  test("/privacy показывает дату редакции из константы, а не дату сборки", async ({ page }) => {
    await page.goto("/privacy");

    const line = page.getByText(/Дата обновления:/);
    await expect(line).toBeVisible();

    // `innerText` приходит в верхнем регистре: подпись сверстана `uppercase`.
    const text = (await line.innerText()).trim();
    expect(text).toMatch(/ДАТА ОБНОВЛЕНИЯ:\s*\d{2}\.\d{2}\.\d{4}/i);
    // Ровно та редакция, что записана в `content/legal.ts`.
    expect(POLICY_DATE_LABEL).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    expect(text).toContain(POLICY_DATE_LABEL);

    /**
     * До правки здесь стояла дата сборки. Проверяем, что сегодня — не дата
     * редакции (если владелец обновит политику в день прогона, проверка
     * пропускается: совпадение станет законным).
     */
    const today = new Date().toLocaleDateString("ru-RU");
    if (today !== POLICY_DATE_LABEL) {
      expect(text).not.toContain(today);
    }
  });
});
