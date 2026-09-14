import { expect, test } from "@playwright/test";

import { interceptLeadApi, submitLeadForm, type LeadApiStub } from "./helpers";

/**
 * PT-013 · Дифференцированные состояния ошибки формы.
 *
 * Замер на сборке до правки (страница `/uslugi/skrytye-karnizy#action`):
 *
 *     422 { issues: ["phone","name"] } → «Не получилось отправить — позвоните …»
 *     429 + Retry-After: 600           → тот же текст, «10 мин» в нём нет
 *     обрыв связи                      → тот же текст, 1 запрос, повтора нет
 *
 * Три принципиально разных исхода показывались одинаково, и человек не мог
 * понять, что делать: исправить номер, подождать или повторить отправку.
 */

const PAGE = "/uslugi/skrytye-karnizy#action";

test.describe("Состояния ошибки формы (PT-013)", () => {
  test("422: сервер назвал поле — оно подсвечено, данные на месте, запрос один", async ({ page }) => {
    const stub: LeadApiStub = {
      status: 422,
      body: { ok: false, error: "validation", issues: ["phone"] },
    };
    const leads = await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page, { name: "Пётр", phone: "9161234567" });

    const alert = page.getByTestId("lead-error-alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("Исправьте отмеченные поля");
    await expect(alert).toContainText("Телефон:");

    // Поле помечено и для глаза, и для скринридера.
    const phone = page.getByTestId("lead-phone");
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await expect(phone).toHaveAttribute("aria-describedby", "lead-phone-error");
    await expect(page.locator("#lead-phone-error")).toContainText("10 цифр");

    // Фокус переведён на проблемное поле: форма длинная, подсветки мало.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-testid")))
      .toBe("lead-phone");

    // Введённое не потеряно, повтор не отправлялся.
    await expect(phone).toHaveValue("+7 (916) 123-45-67");
    await expect(page.getByTestId("lead-name")).toHaveValue("Пётр");
    expect(leads).toHaveLength(1);
    await expect(page.getByTestId("lead-retry-button")).toHaveCount(0);
  });

  test("429: срок ждёт из Retry-After и тикает", async ({ page }) => {
    const stub: LeadApiStub = {
      status: 429,
      headers: { "Retry-After": "5" },
      body: { ok: false, error: "rate_limited" },
    };
    await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page);

    const alert = page.getByTestId("lead-error-alert");
    await expect(alert).toContainText("Слишком много попыток");

    const countdown = page.getByTestId("lead-retry-countdown");
    await expect(countdown).toContainText(/Повторить можно через 0:0[45]/);

    const before = (await countdown.innerText()).trim();
    await page.waitForTimeout(1800);
    const after = (await countdown.innerText()).trim();

    expect(after).not.toBe(before);
    expect(after).toMatch(/Повторить можно через 0:0\d/);

    // Лимит не лечится повтором — кнопки повтора нет.
    await expect(page.getByTestId("lead-retry-button")).toHaveCount(0);
  });

  test("обрыв связи: автоматический повтор с тем же requestId приводит к успеху", async ({ page }) => {
    const stub: LeadApiStub = { abortFirstN: 1 };
    const leads = await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page, { phone: "9161234567" });

    await expect(page.getByText(/Заявка №E2E01 сохранена/)).toBeVisible();

    expect(leads).toHaveLength(2);
    const [first, second] = leads as Array<Record<string, unknown>>;
    expect(first.requestId).toBeTruthy();
    expect(second.requestId).toBe(first.requestId);
    expect(second.phone).toBe(first.phone);
  });

  test("обрыв связи дважды: честный текст, кнопка повтора, данные не потеряны", async ({ page }) => {
    const stub: LeadApiStub = { abort: true };
    const leads = await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page, { name: "Пётр", phone: "9161234567" });

    const alert = page.getByTestId("lead-error-alert");
    await expect(alert).toBeVisible();
    // Исход неизвестен: заявка могла уйти. Врать «не отправлено» нельзя.
    await expect(alert).toContainText("Ответ сервера не получен");
    await expect(alert).not.toContainText("не отправлено");
    await expect(alert).toContainText("Повтор не создаст вторую заявку");

    // Ровно две попытки: исходная и один автоматический повтор.
    await expect.poll(() => leads.length).toBe(2);
    expect(leads[1].requestId).toBe(leads[0].requestId);

    await expect(page.getByTestId("lead-retry-button")).toBeVisible();
    await expect(page.getByTestId("lead-name")).toHaveValue("Пётр");
    await expect(page.getByTestId("lead-phone")).toHaveValue("+7 (916) 123-45-67");
  });

  test("500: повтор вручную уходит с тем же requestId и показывает номер заявки", async ({ page }) => {
    const stub: LeadApiStub = {
      status: 500,
      body: { ok: false, error: "internal" },
    };
    const leads = await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page, { phone: "9161234567" });

    const alert = page.getByTestId("lead-error-alert");
    await expect(alert).toContainText("Сервер не смог принять заявку");
    await expect(page.getByTestId("lead-retry-button")).toBeEnabled();

    // Сервер «починился» — повтор той же отправки.
    stub.status = 201;
    stub.body = { ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" };

    await page.getByTestId("lead-retry-button").click();

    await expect(page.getByText(/Заявка №K7F3Q сохранена/)).toBeVisible();
    expect(leads).toHaveLength(2);
    expect(leads[1].requestId).toBe(leads[0].requestId);
  });

  test("успех: статус честный — «сохранена», без обещания, что мастер уже увидел", async ({ page }) => {
    const stub: LeadApiStub = {
      body: {
        ok: true,
        leadId: "K7F3Q",
        callbackWindow: "сегодня до 21:00",
        status: "queued",
      },
    };
    await interceptLeadApi(page, stub);

    await page.goto(PAGE);
    await submitLeadForm(page);

    await expect(page.getByText(/Заявка №K7F3Q сохранена/)).toBeVisible();
    await expect(page.getByTestId("lead-error-alert")).toHaveCount(0);
    // Никаких технических деталей доставки в ответе пользователю.
    await expect(page.locator("body")).not.toContainText(/Web3Forms|Telegram Bot|outbox|доставлено мастеру/i);
  });
});
