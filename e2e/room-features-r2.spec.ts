import { expect, test } from "@playwright/test";

import { MODAL, interceptLeadApi, openCalculatorFromHero, submitLeadForm } from "./helpers";

/**
 * UX-R2 · потолок и световые решения выбираются независимо от уровней.
 *
 * Что проверяем на живой сборке:
 * 1. Первый экран — помещения: уровней «стандартный/современный/продвинутый» нет.
 * 2. Теневой, парящий, световые линии и трек доступны в карточке комнаты.
 * 3. Решения одной комнаты не включают вопросы другой.
 * 4. Метраж не обнуляется при выключении и включении решения.
 * 5. Задачи по свету видны на Шаге 1 с метражом и честной пометкой «нужна проверка»,
 *    а фальшивого «нет трека/точек» вместо них больше нет.
 */

const MODAL_FOOTER = ".calculator-modal-footer";

/** Имя комнаты: нужно, чтобы дальше работать с карточкой «Редактировать: Кухня». */
async function nameRoom(modal: import("@playwright/test").Locator, label = "Кухня") {
  await modal.getByRole("button", { name: /Назвать помещение/ }).click();
  await modal.getByLabel("Название помещения", { exact: true }).fill(label);
}

/** Только площадь: до сводки дело не доводим — дальше тесты работают с потолком. */
async function answerArea(modal: import("@playwright/test").Locator, area = "18 м²") {
  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: area, exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
}

/** Обычный вход с главной: сразу вопрос о площади — уровней перед ним нет. */
async function startRoom(page: import("@playwright/test").Page, label = "Кухня") {
  await openCalculatorFromHero(page);
  const modal = page.locator(MODAL);
  await nameRoom(modal, label);
  await answerArea(modal);
  return modal;
}

async function confirmToSummary(modal: import("@playwright/test").Locator) {
  for (let i = 0; i < 14; i += 1) {
    if (await modal.getByRole("heading", { name: "Проверка", exact: true }).count()) break;
    await modal.locator(`${MODAL_FOOTER} button`).filter({ hasText: /^Подтвердить/ }).click();
  }
  await expect(modal.getByRole("heading", { name: "Проверка", exact: true })).toBeVisible();
}

test.describe("UX-R2 · решения комнаты вместо уровней", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 640, "desktop-раскладка");

  test("без уровня выбора сразу вопрос о площади, все три потолка доступны", async ({ page }) => {
    await openCalculatorFromHero(page);
    const modal = page.locator(MODAL);

    /* Шага «стандартный/современный/продвинутый» нет: сразу площадь комнаты. */
    await expect(modal.getByRole("heading", { name: "Площадь потолка", exact: true })).toBeVisible();
    await expect(modal.locator(".pk-wizard-caption")).toHaveText("Потолок · вопрос 1 из 5");
    await expect(modal.getByText("Современный", { exact: true })).toHaveCount(0);
    await expect(modal.getByText("Продвинутый", { exact: true })).toHaveCount(0);

    await nameRoom(modal);
    await answerArea(modal);
    const roomModal = modal;
    await expect(roomModal.getByRole("heading", { name: "Тип потолка", exact: true })).toBeVisible();
    for (const kind of ["standard", "shadow", "floating"]) {
      await expect(roomModal.locator(`[data-ceiling-option="${kind}"]`)).toBeVisible();
    }
    await expect(roomModal.getByRole("checkbox", { name: /Световые линии/ })).toBeVisible();
    await expect(roomModal.getByRole("checkbox", { name: /Трековое освещение/ })).toBeVisible();
    /* Выбор решения не добавляет товар в расчёт молча. */
    const strip = roomModal.locator("[data-strip-state]:visible");
    const before = await strip.innerText();
    await roomModal.locator('[data-ceiling-option="shadow"]').click();
    await roomModal.getByRole("checkbox", { name: /Трековое освещение/ }).check();
    await roomModal.locator('[data-ceiling-option="shadow"]').click();
    await roomModal.getByRole("checkbox", { name: /Трековое освещение/ }).uncheck();
    await expect(strip).toHaveText(before);
  });

  test("парящий контур ведёт к задаче на Шаге 1 и в заявку, без фальшивого «нет света»", async ({ page }) => {
    const leads = await interceptLeadApi(page);
    const modal = await startRoom(page);

    await modal.locator('[data-ceiling-option="floating"]').click();
    await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
    await expect(modal.getByRole("heading", { name: "Парящий профиль", exact: true })).toBeVisible();
    await confirmToSummary(modal);

    /* Шаг 1: задача из комнаты видна сразу, с метражом конструкции. */
    await modal.locator(MODAL_FOOTER).getByRole("button", { name: /Подобрать свет|Проверить свет/ }).first().click();
    const tasks = modal.getByTestId("project-lighting-tasks");
    await expect(tasks).toBeVisible();
    await expect(tasks).toContainText("Парящий контур");
    await expect(tasks).toContainText("м конструкции");
    await expect(tasks).toContainText("Нужна проверка");
    await expect(tasks).toContainText("Ленту, число рядов, блоки питания");
    await expect(modal.getByText(/не задан трек или количество точечных светильников/)).toHaveCount(0);

    /* Заявка уносит решение комнаты, а не только сумму. */
    await modal.getByRole("button", { name: /К итогу/ }).first().click();
    await submitLeadForm(page, { scope: modal });
    await expect.poll(() => leads.length).toBe(1);
    const snapshot = leads[0].snapshot as { rooms: Array<Record<string, unknown>>; scenario: string };
    expect(snapshot.rooms[0]).toMatchObject({ floatingEnabled: true, ceilingType: "floating" });
    expect(Number(snapshot.rooms[0].floatingLength)).toBeGreaterThan(0);
    /* Поле scenario осталось в схеме — оно описывает фактические решения комнат. */
    expect(snapshot.scenario).toBe("modern");
  });

  test("решения первой комнаты не включают вопросы второй", async ({ page }) => {
    const modal = await startRoom(page);
    await modal.locator('[data-ceiling-option="floating"]').click();
    await modal.getByRole("checkbox", { name: /Световые линии/ }).check();
    await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
    await confirmToSummary(modal);

    /* Вторая комната добавляется со сводки — своим, чистым набором решений. */
    await modal.getByRole("button", { name: /добавить помещение/i }).click();
    await modal.getByRole("button", { name: "+ Спальня", exact: true }).click();
    await modal.getByRole("button", { name: "12 м²", exact: true }).click();
    await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
    await expect(modal.getByRole("heading", { name: "Тип потолка", exact: true })).toBeVisible();

    /* Чужие решения её не касаются: чистый лист. */
    await expect(modal.locator('[data-ceiling-option="floating"]')).toHaveAttribute("aria-pressed", "false");
    await expect(modal.getByRole("checkbox", { name: /Световые линии/ })).not.toBeChecked();
    await expect(modal.getByRole("checkbox", { name: /Трековое освещение/ })).not.toBeChecked();

    await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
    await expect(modal.getByRole("heading", { name: "Световые линии", exact: true })).toHaveCount(0);
    await expect(modal.getByRole("heading", { name: "Парящий профиль", exact: true })).toHaveCount(0);
  });

  test("метраж профиля сохраняется при выключении и включении решения", async ({ page }) => {
    const modal = await startRoom(page);
    await modal.locator('[data-ceiling-option="floating"]').click();
    await modal.getByRole("button", { name: /Подтвердить тип/ }).click();
    await modal.getByRole("button", { name: /Частично/ }).click();
    await modal.getByLabel("Длина парящего профиля, м.п.", { exact: true }).fill("9");
    /* Остальные вопросы комнаты (карниз, люстры, светильники) — до сводки. */
    await confirmToSummary(modal);

    /* Возвращаемся в комнату и выключаем парящий контур. */
    await modal.getByRole("button", { name: /Редактировать: Кухня/ }).click();
    await modal.locator('[data-edit-param="ceiling"]').click();
    await modal.locator('[data-ceiling-option="floating"]').click();
    await modal.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
    await modal.locator(MODAL_FOOTER).getByRole("button", { name: "К помещениям", exact: true }).click();
    await expect(modal.getByRole("heading", { name: "Проверка", exact: true })).toBeVisible();

    /* Включаем обратно: введённый метраж не потерялся. */
    await modal.getByRole("button", { name: /Редактировать: Кухня/ }).click();
    await modal.locator('[data-edit-param="ceiling"]').click();
    await modal.locator('[data-ceiling-option="floating"]').click();
    await modal.getByRole("button", { name: "Сохранить изменения", exact: true }).click();
    await modal.locator(MODAL_FOOTER).getByRole("button", { name: "К помещениям", exact: true }).click();
    await modal.getByRole("button", { name: /Продолжить заполнение/ }).click();
    await expect(modal.getByRole("heading", { name: "Парящий профиль", exact: true })).toBeVisible();
    await expect(modal.getByLabel("Длина парящего профиля, м.п.", { exact: true })).toHaveValue("9");
  });
});

test.describe("UX-R2 · мобильная раскладка", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("переключатель решения доступен тапом, задачи помещений читаются на узком экране", async ({ page }) => {
    const modal = await startRoom(page);

    const lines = modal.getByRole("checkbox", { name: /Световые линии/ });
    await lines.check();
    await expect(lines).toBeChecked();
    const overflow = await modal.locator(".calculator-modal-content").evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await modal.locator('[data-ceiling-option="floating"]').click();
    await confirmToSummary(modal);
    await modal.locator(MODAL_FOOTER).getByRole("button", { name: /Подобрать свет|Проверить свет/ }).first().click();
    const tasks = modal.getByTestId("project-lighting-tasks");
    await expect(tasks).toBeVisible();
    /* Карточка задач не должна вылезать за область контента: полоса вкладок
       Шага 1 прокручивается сама и в замер карточки не входит. */
    const fits = await tasks.evaluate(el => {
      const card = el.getBoundingClientRect();
      const content = el.closest(".calculator-modal-content")!.getBoundingClientRect();
      return { own: el.scrollWidth - el.clientWidth, right: Math.round(card.right - content.right) };
    });
    expect(fits.own).toBeLessThanOrEqual(1);
    expect(fits.right).toBeLessThanOrEqual(1);
  });
});
