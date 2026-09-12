import { expect, test, type Page } from "@playwright/test";

import {
  MODAL,
  completeAreaScreen,
  interceptLeadApi,
  submitLeadForm,
  type LeadApiStub,
} from "./helpers";

/**
 * N-003 · Сценарии 8 и 9 из T-091 — «спасение» расчёта и черновик.
 *
 * Rescue — последняя точка контакта: человек уже уходит, и единственный шанс
 * не потерять расчёт. Регрессия здесь незаметна глазом (модалка закрывается
 * как обычно), поэтому нужен тест на сам факт отправки с `leadKind=rescue`.
 *
 * PT-004 добавил к этому сценарий S09 из ТЗ v5: `201/422/429/500/offline`
 * и явное согласие. До этого диалог закрывался «успехом» при любом ответе
 * сервера, и проверка `lead.consent === true` ниже была проверкой константы,
 * а не действия человека.
 */

const RESCUE_PHONE_PLACEHOLDER = "+7 900 000-00-00";

/** Перехваченный payload rescue-заявки — только поля, которые проверяем. */
type CapturedRescue = {
  leadKind?: string;
  placement?: string;
  consent?: boolean;
  phone?: string;
  grandTotal?: number;
  totals?: { grand?: number };
  snapshot?: {
    version?: number;
    rooms?: Array<{ area?: number; ceilingTypeLabel?: string }>;
  };
  /** PT-009: ключ идемпотентности, который подставляет общий сервис отправки. */
  requestId?: string;
};

/** Открыть rescue-диалог и вернуть локаторы, которыми он управляется. */
async function openRescueDialog(page: Page) {
  await page.getByRole("button", { name: "Закрыть" }).first().click();
  const phone = page.getByPlaceholder(RESCUE_PHONE_PLACEHOLDER);
  await expect(phone).toBeVisible();
  return {
    phone,
    consent: page.getByTestId("rescue-consent"),
    submit: page.getByTestId("confirm-dialog-submit"),
    cancel: page.getByTestId("confirm-dialog-cancel"),
    error: page.getByTestId("confirm-dialog-error"),
  };
}

/** Дойти до состояния «есть расчёт, модалка открыта». */
async function reachCalculatedState(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать/ }).first().click();
  await page.locator(MODAL).waitFor();
  await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });
}

test.describe("Rescue и черновик", () => {
  test("сценарий 8: закрытие с данными → rescue-диалог → lead_kind=rescue", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await expect(dialog.submit).toBeVisible();
    await dialog.phone.fill("9161234567");

    // PT-004: согласие — действие человека, а не константа в payload.
    await expect(dialog.submit).toBeDisabled();
    await dialog.consent.check();
    await expect(dialog.submit).toBeEnabled();
    await dialog.submit.click();

    await expect.poll(() => leads.length).toBe(1);
    const lead = leads[0] as CapturedRescue;
    expect(lead.leadKind).toBe("rescue");
    expect(lead.placement).toBe("rescue");
    expect(lead.consent).toBe(true);
    expect(String(lead.phone)).toContain("9161234567");
  });

  test("PT-004: rescue несёт полный снапшот, а не только сумму", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();

    await expect.poll(() => leads.length).toBe(1);
    const lead = leads[0] as CapturedRescue;

    expect(lead.snapshot?.version).toBe(2);
    expect(Array.isArray(lead.snapshot?.rooms)).toBe(true);
    expect(lead.snapshot?.rooms?.length ?? 0).toBeGreaterThan(0);

    // Состав комнаты, а не только итог: площадь и тип потолка.
    const room = lead.snapshot?.rooms?.[0];
    expect(Number(room?.area ?? 0)).toBeGreaterThan(0);
    expect(String(room?.ceilingTypeLabel ?? "").length).toBeGreaterThan(0);

    expect(Number(lead.totals?.grand ?? 0)).toBeGreaterThan(0);
    expect(Number(lead.grandTotal)).toBe(Number(lead.totals?.grand));
  });

  test("PT-004: отказ сервера — не успех, диалог остаётся с причиной", async ({ page }) => {
    const stub: LeadApiStub = { status: 500, body: { ok: false, error: "internal" } };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();

    await expect(dialog.error).toBeVisible();
    await expect.poll(() => leads.length).toBe(1);

    // Модалка и диалог не закрыты: человек видит, что заявка НЕ ушла.
    await expect(page.locator(MODAL)).toBeVisible();
    await expect(dialog.submit).toBeVisible();

    // Номер и согласие сохранены — повтор не требует ввода заново.
    await expect(dialog.phone).toHaveValue("9161234567");
    await expect(dialog.consent).toBeChecked();
    await expect(dialog.submit).toHaveText("Повторить");
  });

  // Playwright не знает `test.each` — перебор статусов обычным циклом.
  for (const status of [422, 429, 503]) {
    test(`PT-004: статус ${status} показывает отказ`, async ({ page }) => {
      const stub: LeadApiStub = { status, body: { ok: false, error: "validation" } };
      const leads = await interceptLeadApi(page, stub);

      await reachCalculatedState(page);
      const dialog = await openRescueDialog(page);

      await dialog.phone.fill("9161234567");
      await dialog.consent.check();
      await dialog.submit.click();

      await expect(dialog.error).toBeVisible();
      await expect.poll(() => leads.length).toBe(1);
      await expect(page.locator(MODAL)).toBeVisible();
    });
  }

  test("PT-004: обрыв связи — отказ, а не молчаливый успех", async ({ page }) => {
    const stub: LeadApiStub = { abort: true };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();

    await expect(dialog.error).toBeVisible();
    await expect.poll(() => leads.length).toBe(1);
  });

  test("PT-004: повтор после отказа доводит заявку", async ({ page }) => {
    const stub: LeadApiStub = { status: 500, body: { ok: false, error: "internal" } };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();
    await expect(dialog.error).toBeVisible();

    // Сервер «ожил» — повтор той же заявки без нового ввода.
    stub.status = 201;
    stub.body = { ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" };

    await dialog.submit.click();

    await expect(dialog.error).toHaveCount(0);
    await expect(page.locator(MODAL)).toBeHidden();
    await expect.poll(() => leads.length).toBe(2);

    const second = leads[1] as CapturedRescue;
    expect(second.leadKind).toBe("rescue");
    expect(second.snapshot?.version).toBe(2);
  });

  /**
   * PT-009 · Ключ идемпотентности в реальном браузере.
   *
   * Юнит-тесты проверяют `submitLead` напрямую; здесь проверяется то, что до
   * сервиса нельзя достать из теста: что форма действительно вызывает его на
   * каждом нажатии и что ключ живёт между попытками, а не создаётся заново.
   */
  test("PT-009: повтор после сбоя уходит с тем же requestId", async ({ page }) => {
    const stub: LeadApiStub = { abort: true };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();
    await expect(dialog.error).toBeVisible();

    stub.abort = false;
    stub.status = 201;
    stub.body = { ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" };

    await dialog.submit.click();
    await expect.poll(() => leads.length).toBe(2);

    const [first, second] = leads as CapturedRescue[];
    expect(first.requestId).toBeTruthy();
    /**
     * Именно это свойство позволяет серверу не создавать вторую заявку: человек
     * не знает, дошёл первый запрос или нет, и состав он не менял.
     */
    expect(second.requestId).toBe(first.requestId);
  });

  test("PT-009: правка данных после сбоя меняет requestId", async ({ page }) => {
    const stub: LeadApiStub = { status: 500, body: { ok: false, error: "internal" } };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();
    await expect(dialog.error).toBeVisible();

    /**
     * Человек исправил номер. Это уже другая заявка, и ключ обязан смениться:
     * с прежним сервер ответил бы `409`, и форма встала бы намертво.
     */
    await dialog.phone.fill("9167654321");
    stub.status = 201;
    stub.body = { ok: true, leadId: "M2P4R", callbackWindow: "сегодня до 21:00" };

    await dialog.submit.click();
    await expect.poll(() => leads.length).toBe(2);

    const [first, second] = leads as CapturedRescue[];
    expect(second.requestId).not.toBe(first.requestId);
    // Номер нормализуется ещё на клиенте (PT-004), в запрос уходит +7…
    expect(second.phone).toBe("+79167654321");
  });

  test("PT-004: «Закрыть без отправки» после отказа не плодит запрос", async ({ page }) => {
    const stub: LeadApiStub = { status: 500, body: { ok: false, error: "internal" } };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();
    await expect(dialog.error).toBeVisible();

    await dialog.cancel.click();

    await expect(page.locator(MODAL)).toBeHidden();
    expect(leads).toHaveLength(1);

    // Заявка не сохранена — при следующем закрытии оффер показывается снова.
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await page.locator(MODAL).waitFor();
    await page.getByRole("button", { name: "Закрыть" }).first().click();
    await expect(page.getByPlaceholder(RESCUE_PHONE_PLACEHOLDER)).toBeVisible();
    expect(leads).toHaveLength(1);
  });

  test("PT-004: Escape во время отправки не закрывает диалог", async ({ page }) => {
    const stub: LeadApiStub = { delayMs: 1200 };
    const leads = await interceptLeadApi(page, stub);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();

    await expect(dialog.submit).toBeDisabled();
    await page.keyboard.press("Escape");

    // Исход ещё неизвестен — окно остаётся, иначе человек уйдёт в неведении.
    await expect(dialog.submit).toBeVisible();
    await expect.poll(() => leads.length).toBe(1);
  });

  test("«Просто закрыть» не отправляет заявку", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await reachCalculatedState(page);
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

  test("PT-004: успех фиксируется только ответом сервера, дубля нет", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await reachCalculatedState(page);
    const dialog = await openRescueDialog(page);

    await dialog.phone.fill("9161234567");
    await dialog.consent.check();
    await dialog.submit.click();

    // Модалка закрылась сама — значит `markLeadSubmitted()` сработал, а он
    // теперь вызывается только после `ok: true` от сервера.
    await expect(page.locator(MODAL)).toBeHidden();
    await expect.poll(() => leads.length).toBe(1);

    /**
     * Новое открытие — новая сессия (`openCalculator` сбрасывает
     * `leadSubmittedAt`), поэтому оффер показывается снова: это поведение T-023,
     * а не регрессия. Проверяем главное — отказ не плодит вторую заявку.
     */
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await page.locator(MODAL).waitFor();
    await page.getByRole("button", { name: "Закрыть" }).first().click();
    await page.getByRole("button", { name: "Просто закрыть" }).click();

    await expect(page.locator(MODAL)).toBeHidden();
    expect(leads).toHaveLength(1);
  });
});
