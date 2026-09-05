import { expect } from "@playwright/test";
import type { Locator, Page, Route } from "@playwright/test";

/**
 * T-091 · Общие помощники для e2e.
 *
 * Ключевой принцип: заявки НИКОГДА не уходят наружу. Все спеки перехватывают
 * `/api/lead` и проверяют payload — иначе прогон CI слал бы реальные лиды
 * в Telegram владельцу.
 */

export type CapturedLead = Record<string, unknown>;

/**
 * Перехватывает POST /api/lead, возвращает успешный ответ и копит payload'ы.
 * Возвращает массив, который наполняется по ходу теста.
 */
export async function interceptLeadApi(page: Page): Promise<CapturedLead[]> {
  const captured: CapturedLead[] = [];

  await page.route("**/api/lead", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    try {
      captured.push(route.request().postDataJSON() as CapturedLead);
    } catch {
      captured.push({ __unparsable: route.request().postData() });
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        leadId: "E2E01",
        callbackWindow: "сегодня до 21:00",
        delivered: true,
      }),
    });
  });

  return captured;
}

/**
 * Заполнить форму заявки и отправить. Возвращает после ответа API.
 *
 * `scope` обязателен, когда открыт калькулятор: форма присутствует и на
 * странице, и внутри модалки с теми же `data-testid`, поэтому неограниченный
 * поиск даёт strict mode violation. Передавайте `page.locator(MODAL)`.
 */
export async function submitLeadForm(
  page: Page,
  {
    name = "Тест",
    phone = "9055219909",
    scope,
  }: { name?: string; phone?: string; scope?: Locator } = {}
) {
  const root = scope ?? page;

  await root.getByTestId("lead-name").fill(name);
  await root.getByTestId("lead-phone").fill(phone);

  // Согласие — обязательный чекбокс (T-047), без него submit заблокирован.
  const consent = root.getByTestId("lead-consent");
  if (!(await consent.isChecked())) await consent.check();

  await root.getByTestId("lead-submit").click();
}

/**
 * N-003 · Добавить второе помещение с экрана «Проверка».
 *
 * Цепочка отличается от первой комнаты: сначала выбирается тип помещения
 * («+ Кухня»), и только потом идут площадь и остальные экраны.
 */
export async function addSecondRoom(
  page: Page,
  { room = "+ Кухня", area = "20 м²" }: { room?: string; area?: string } = {}
) {
  const modal = page.locator(MODAL);

  await modal.getByRole("button", { name: /добавить помещение/ }).click();
  await modal.getByRole("button", { name: room, exact: true }).click();
  await modal.getByRole("button", { name: area, exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
  await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
  await modal.getByRole("button", { name: /Подтвердить карниз/ }).click();
  await modal.getByRole("button", { name: /Подтвердить люстры/ }).click();
  await modal.getByRole("button", { name: /Подтвердить свет/ }).click();
  await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
}

/** Открыть калькулятор с главной через hero-CTA. */
export async function openCalculatorFromHero(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать|Рассчитать стоимость/i }).first().click();
  await page.locator('[data-testid="calculator-modal"][data-open="true"]').waitFor();
}

/** Модалка калькулятора в открытом состоянии. */
export const MODAL = '[data-testid="calculator-modal"][data-open="true"]';

/**
 * N-003 · Пройти Шаг 0 «Комната» до экрана «Проверка».
 *
 * Экраны Шага 0 идут фиксированной цепочкой, и у каждого своя кнопка
 * подтверждения — общий `Далее` отсутствует. Перебирать их циклом нельзя:
 * кнопки следующих экранов уже есть в DOM, но скрыты, и Playwright залипает
 * на невидимой. Поэтому шаги перечислены явно.
 */
export async function completeAreaScreen(
  page: Page,
  { area = "18 м²", points }: { area?: string; points?: string } = {}
) {
  const modal = page.locator(MODAL);

  await modal.getByRole("button", { name: /^Комнату/ }).click();
  await modal.getByRole("button", { name: area, exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
  await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
  await modal.getByRole("button", { name: /Подтвердить карниз/ }).click();
  await modal.getByRole("button", { name: /Подтвердить люстры/ }).click();

  if (points) {
    await modal.getByRole("button", { name: /Добавить светильники/ }).click();
    await modal.getByRole("button", { name: points, exact: true }).click();
  }

  await modal.getByRole("button", { name: /Подтвердить свет/ }).click();
  await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
}
