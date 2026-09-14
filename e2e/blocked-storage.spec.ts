import { expect, test, type Page } from "@playwright/test";

import { MODAL, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * PT-012 · Сценарий S10: заблокированное хранилище.
 *
 * Приватный режим Safari, корпоративная политика, iframe с запрещёнными
 * сторонними cookie — в этих условиях обращение к `sessionStorage` бросает
 * `SecurityError`, а запись в приватном режиме Safari — `QuotaExceededError`
 * (квота равна нулю). До PT-012 `app/providers.tsx` и контекст калькулятора
 * обращались к хранилищу напрямую из `useEffect`, поэтому исключение роняло
 * React-дерево: человек получал белый экран или неоткрывающийся калькулятор.
 *
 * Здесь проверяем не «мы обернули в try/catch», а наблюдаемое поведение:
 * страница жива, калькулятор открывается и реагирует, форма отправляет заявку —
 * просто без атрибуции.
 */

/** Имитация запрета доступа: геттер хранилища бросает SecurityError. */
async function blockWebStorage(page: Page) {
  await page.addInitScript(() => {
    const hostile = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };
    Object.defineProperty(window, "sessionStorage", { get: hostile, configurable: true });
    Object.defineProperty(window, "localStorage", { get: hostile, configurable: true });
  });
}

/** Имитация приватного режима: читать можно, писать — квота ноль. */
async function blockWebStorageWrites(page: Page) {
  await page.addInitScript(() => {
    const quota = () => {
      throw new DOMException("Quota exceeded.", "QuotaExceededError");
    };
    const fake = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: quota,
    };
    Object.defineProperty(window, "sessionStorage", { get: () => fake, configurable: true });
    Object.defineProperty(window, "localStorage", { get: () => fake, configurable: true });
  });
}

test.describe("Заблокированное хранилище (PT-012)", () => {
  test("доступ к хранилищу запрещён: форма на странице услуги отправляет заявку", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await blockWebStorage(page);
    const leads = await interceptLeadApi(page);

    await page.goto("/uslugi/skrytye-karnizy#action");
    await submitLeadForm(page, { name: "Пётр", phone: "9161234567" });

    await expect(page.getByText(/Заявка .* принята|Заявка отправлена/)).toBeVisible();

    expect(leads).toHaveLength(1);
    expect(leads[0].phone).toBe("+79161234567");
    expect(leads[0].consent).toBe(true);
    // Атрибуции нет — хранилище недоступно. На полноценность заявки это не влияет.
    expect((leads[0].attribution as Record<string, unknown> | undefined) ?? {}).toEqual({});
    expect(pageErrors).toEqual([]);
  });

  test("доступ к хранилищу запрещён: калькулятор открывается и реагирует на выбор", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await blockWebStorage(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать|Рассчитать стоимость/i }).first().click();

    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();

    // Дерево живо: Шаг 0 отвечает на клик и показывает следующий экран.
    await modal.getByRole("button", { name: /Одну комнату/ }).click();
    await expect(modal.getByRole("button", { name: "18 м²", exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("приватный режим (запись запрещена): калькулятор открывается, черновик не мешает", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(String(error)));

    await blockWebStorageWrites(page);

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать|Рассчитать стоимость/i }).first().click();

    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: /Одну комнату/ }).click();
    await expect(modal.getByRole("button", { name: "18 м²", exact: true })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
