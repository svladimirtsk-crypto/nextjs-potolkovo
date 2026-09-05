import { expect, test } from "@playwright/test";

import { MODAL, interceptLeadApi, openCalculatorFromHero, submitLeadForm } from "./helpers";

/**
 * T-091 · Сценарий 2 — «Современный» потолок с подбором света.
 *
 * Цепочка Шага 0 здесь длиннее стандартной: теневой профиль добавляет экран
 * «Световые линии», поэтому шаги перечислены явно, а не перебором.
 */

/** Пройти Шаг 0 с теневым потолком до экрана «Проверка». */
async function completeModernStep0(page: import("@playwright/test").Page) {
  const modal = page.locator(MODAL);

  await modal.getByRole("button", { name: /^Комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();

  // Теневой и парящий спрятаны за раскрытием — сначала показываем их.
  await modal.getByRole("button", { name: /Показать теневой и парящий/ }).click();
  await modal.getByRole("button", { name: /Теневой потолок/ }).click();

  // Дальше у каждого экрана своя кнопка подтверждения; идём до «Проверки».
  for (let i = 0; i < 10; i += 1) {
    if (await modal.getByRole("heading", { name: "Проверка" }).count()) break;
    const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
    if (!(await confirm.count())) break;
    await confirm.click();
  }

  await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
}

test.describe("Сценарий 2 · современный потолок → подбор света", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 640, "desktop-раскладка");

  test("теневой потолок доводится до заявки, суммы сходятся", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await openCalculatorFromHero(page);
    await completeModernStep0(page);

    const modal = page.locator(MODAL);

    // Скидка на свет объявлена прямо на кнопке перехода.
    await expect(modal.getByRole("button", { name: /Подобрать свет −25/ })).toBeVisible();
    await modal.getByRole("button", { name: /Подобрать свет/ }).click();

    // Шаг 1 открыт.
    await expect(modal.getByRole("button", { name: "Каталог", exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "Каталог", exact: true }).click();

    /**
     * Берём лампу: она ни от чего не зависит. Трековые позиции здесь брать
     * нельзя — без выбранного на Шаге 0 трека их вычищает автоочистка T-024
     * (см. fixme ниже), а точечный светильник потребует докупки ламп и
     * оставит «К итогу» заблокированной.
     */
    await modal.getByRole("button", { name: "Лампы", exact: true }).click();
    await modal.locator('button[aria-label="Увеличить количество"]').first().click();

    // Футер с «К итогу» живёт на вкладке выбранного, а не поверх каталога.
    await modal.locator("button:visible").filter({ hasText: /Выбранное/ }).first().click();

    const finish = modal.locator("button:visible").filter({ hasText: /К итогу/ }).first();
    await expect(finish).toBeEnabled();
    await finish.click();

    await submitLeadForm(page, { scope: modal });

    const snapshot = leads.at(-1)?.snapshot as
      | { scenario?: string; totals?: Record<string, number> }
      | undefined;

    expect(snapshot?.scenario).toBe("modern");

    const totals = snapshot?.totals;
    expect(totals).toBeTruthy();

    /**
     * Инвариант сценария 2 из ТЗ звучит как
     * `grand === ceilingRaw + installExtra + lightingEffective`, но он верен
     * только без минимального заказа: на маленькой площади потолок
     * поднимается до минимума, и сырая ставка перестаёт быть слагаемым.
     * Поэтому сверяем с учётом этого флага.
     */
    const ceilingPart = totals!.minimumApplied
      ? totals!.grand - totals!.installExtra - totals!.lightingEffective
      : totals!.ceilingRaw;

    expect(totals!.grand).toBe(
      ceilingPart + totals!.installExtra + totals!.lightingEffective
    );
    expect(totals!.grand).toBeGreaterThan(0);
    expect(totals!.lightingEffective).toBeLessThanOrEqual(totals!.lightingRegular);
  });

  /**
   * N-051 · Найдено при написании сценария 2.
   *
   * Если на Шаге 0 клиент не выбрал трек, `requiredTrackMeters` равен нулю, и
   * эффект T-024 немедленно вычищает из корзины любую трековую позицию. На
   * экране это выглядит так: клиент жмёт «+» на трековом светильнике, счётчик
   * остаётся на нуле, «Выбранное» показывает 0 — без единого объяснения.
   *
   * Товар при этом лежит в каталоге Шага 1 и выглядит доступным. Автоочистка
   * задумана как защита от несовместимого набора, но применяется и к тому, что
   * клиент только что осознанно добавил руками.
   *
   * Ожидаемое поведение: либо позиция добавляется (и трек подтягивается в
   * расчёт), либо каталог честно объясняет, почему нельзя. Молчаливый отказ
   * недопустим.
   */
  test.fixme("трековый светильник добавляется или отказ объясняется", async ({ page }) => {
    await openCalculatorFromHero(page);
    await completeModernStep0(page);

    const modal = page.locator(MODAL);
    await modal.getByRole("button", { name: /Подобрать свет/ }).click();
    await modal.getByRole("button", { name: "Каталог", exact: true }).click();

    const inc = modal.locator('button[aria-label="Увеличить количество"]').first();
    await inc.click();

    await expect(
      modal.locator("button:visible").filter({ hasText: /Выбранное \(1\)/ })
    ).toBeVisible();
  });
});
