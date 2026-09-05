import type { Page, Route } from "@playwright/test";

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

/** Заполнить форму заявки и отправить. Возвращает после ответа API. */
export async function submitLeadForm(
  page: Page,
  { name = "Тест", phone = "9055219909" }: { name?: string; phone?: string } = {}
) {
  await page.getByTestId("lead-name").fill(name);
  await page.getByTestId("lead-phone").fill(phone);

  // Согласие — обязательный чекбокс (T-047), без него submit заблокирован.
  const consent = page.getByTestId("lead-consent");
  if (!(await consent.isChecked())) await consent.check();

  await page.getByTestId("lead-submit").click();
}

/** Открыть калькулятор с главной через hero-CTA. */
export async function openCalculatorFromHero(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Рассчитать|Рассчитать стоимость/i }).first().click();
  await page.locator('[data-testid="calculator-modal"][data-open="true"]').waitFor();
}
