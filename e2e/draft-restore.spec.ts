import { expect, test, type Page } from "@playwright/test";

import {
  CALC_DRAFT_KEY as DRAFT_KEY,
  MODAL,
  completeAreaScreen,
  openCalculatorFromHero,
} from "./helpers";

/**
 * PT-007 · Восстановление черновика только с согласия пользователя.
 *
 * Приёмка из ТЗ: «посчитать 2 комнаты + собрать корзину света → закрыть
 * модалку без отправки заявки → перезагрузить страницу → открыть калькулятор с
 * главной. Должен появиться явный выбор продолжения; при выборе „Продолжить“ —
 * все данные (комнаты, скидка, позиции света) идентичны сохранённым».
 *
 * Регрессия, ради которой написан спек: квиз читал черновик только при
 * `!preset`, но обёртка Step0 формирует `resolvedPreset` всегда, а контекст
 * подставляет заглушку даже при обычном входе с главной. Черновик не читался
 * никогда, экран выбора был мёртвым кодом, а `restoreFromDraft` возвращал
 * только комнаты — корзина света терялась.
 */

/** Текст без пробелов и неразрывных пробелов — сверка не зависит от вёрстки. */
function squash(text: string): string {
  return text.replace(/[\s\u00a0]/g, "");
}

/**
 * Сумма света из сводки («+ свет 21 471 ₽») — по ней видно, применён ли режим
 * скидки. Принимает уже «сжатый» текст.
 */
function stripLightOf(squashed: string): string | undefined {
  return squashed.match(/свет(\d+₽)/)?.[1];
}

/** Закрыть модалку, не отправляя заявку: «Закрыть» → rescue → «Просто закрыть». */
async function closeWithoutSending(page: Page) {
  await page.getByRole("button", { name: "Закрыть" }).first().click();
  await page.getByRole("button", { name: "Просто закрыть" }).click();
  await expect(page.locator(MODAL)).toBeHidden();
}

/** Сырая запись черновика из sessionStorage вкладки. */
function readDraft(page: Page) {
  return page.evaluate((key) => window.sessionStorage.getItem(key), DRAFT_KEY);
}

/**
 * Собрать расчёт с готовым комплектом света: страница каталога → «Взять этот
 * комплект» → комната 18 м² → «Проверка». После этого в черновике и комнаты, и
 * корзина света со скидкой −25 %.
 */
async function buildKitCalculation(page: Page) {
  await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya");

  const kit = page.locator("article").filter({ hasText: /Для кухни/ }).first();
  await kit.scrollIntoViewIfNeeded();
  await kit.getByRole("button", { name: "Взять этот комплект" }).click();

  const modal = page.locator(MODAL);
  await modal.waitFor();

  await modal.getByRole("button", { name: /Одну комнату/ }).click();
  await modal.getByRole("button", { name: "18 м²", exact: true }).click();
  await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();

  for (let i = 0; i < 12; i += 1) {
    if (await modal.getByRole("heading", { name: "Проверка" }).count()) break;
    const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
    if (!(await confirm.count())) break;
    await confirm.click();
  }

  await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
  return modal;
}

test.describe("PT-007 · явный выбор вместо автоматического восстановления", () => {
  test("при обычном входе с главной черновик не применяется сам — показывается выбор", async ({ page }) => {
    await openCalculatorFromHero(page);
    await completeAreaScreen(page, { area: "22 м²", points: "6 шт." });

    expect(await readDraft(page), "черновик сохранён до закрытия").not.toBeNull();

    await closeWithoutSending(page);
    await page.reload();
    await openCalculatorFromHero(page);

    const modal = page.locator(MODAL);
    const choice = modal.locator('[data-draft-choice="offer"]');
    await expect(choice).toBeVisible();
    await expect(choice).toContainText("Продолжить прошлый расчёт");
    await expect(choice.locator('[data-draft-action="continue"]')).toHaveText("Продолжить расчёт");
    await expect(choice.locator('[data-draft-action="start-new"]')).toHaveText("Начать новый расчёт");

    // Обычный вход: расчёт до выбора не начинается, экранов параметров нет.
    await expect(modal.getByRole("heading", { name: "Проверка" })).toBeHidden();
  });

  test("«Начать новый расчёт» отменяет прежний черновик", async ({ page }) => {
    await openCalculatorFromHero(page);
    // Площадь 22 м² — отличимая метка: новый расчёт стартует с 18 м² из
    // заглушки контекста, поэтому по ней и проверяем, что прежнее не осталось.
    await completeAreaScreen(page, { area: "22 м²" });
    await closeWithoutSending(page);
    await page.reload();

    await openCalculatorFromHero(page);
    const modal = page.locator(MODAL);
    const choice = modal.locator('[data-draft-choice="offer"]');
    await expect(choice).toBeVisible();
    expect(await readDraft(page)).toContain('"area":22');

    await choice.locator('[data-draft-action="start-new"]').click();

    // Расчёт начинается с чистого листа — с выбора помещения.
    await expect(modal.locator('[data-draft-choice]')).toBeHidden();
    await expect(modal.getByRole("button", { name: /Одну комнату/ })).toBeVisible();

    /**
     * Прежнего черновика больше нет. Запись в хранилище при этом может
     * появиться снова: заглушка контекста сразу создаёт комнату, а расчёт
     * сохраняется по мере изменений — это уже новый черновик, а не старый.
     */
    expect(await readDraft(page)).not.toContain('"area":22');
  });

  test("явный пресет кейса не подменяет черновик автоматически", async ({ page }) => {
    // Сначала создаём черновик обычным расчётом.
    await openCalculatorFromHero(page);
    await completeAreaScreen(page, { area: "22 м²" });
    await closeWithoutSending(page);
    await page.reload();

    // Теперь вход с ценового примера — это presetOrigin: "explicit".
    await page.goto("/");
    const example = page.locator('[data-testid^="price-example-"]').first();
    await example.scrollIntoViewIfNeeded();
    await example.click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    const choice = modal.locator('[data-draft-choice="offer"]');
    await expect(choice).toBeVisible();
    await expect(choice).toHaveAttribute("data-draft-origin", "explicit");
    await expect(choice.locator('[data-draft-action="start-new"]')).toHaveText(
      "Начать расчёт по этому кейсу"
    );

    // Сохранённый черновик не затёрт: решение ещё не принято.
    expect(await readDraft(page)).toContain('"area":22');

    // Выбор «продолжить» сохраняет прежние 22 м², а не параметры кейса.
    await choice.locator('[data-draft-action="continue"]').click();
    await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
    await expect(modal).toContainText("22");
  });

  test("нечитаемый черновик — явный отказ, а не молчаливая перезапись", async ({ page }) => {
    await page.goto("/");
    // Запись чужой версии: так выглядит черновик, оставленный более новым кодом.
    await page.evaluate(
      ([key, value]) => window.sessionStorage.setItem(key, value),
      [DRAFT_KEY, JSON.stringify({ version: 99, savedAt: Date.now(), rooms: [{ id: "r1" }] })]
    );

    await openCalculatorFromHero(page);

    const modal = page.locator(MODAL);
    const choice = modal.locator('[data-draft-choice="unreadable"]');
    await expect(choice).toBeVisible();
    await expect(choice).toContainText("Прошлый расчёт не удалось открыть");
    // Продолжить нечего — доступна только одна кнопка.
    await expect(choice.locator('[data-draft-action="continue"]')).toHaveCount(0);
    await expect(choice.locator('[data-draft-action="start-new"]')).toHaveCount(1);

    // До выбора чужая запись не затёрта.
    expect(await readDraft(page)).toContain('"version":99');

    await choice.locator('[data-draft-action="start-new"]').click();
    await expect(modal.getByRole("button", { name: /Одну комнату/ })).toBeVisible();

    // Чужая версия ушла только после явного выбора, а не сама собой.
    expect(await readDraft(page)).not.toContain('"version":99');
  });

  test("пресет кейса применяется только после «Начать расчёт по этому кейсу»", async ({ page }) => {
    // Черновик с площадью 22 м² — именно его пресет не должен подменить сам.
    await openCalculatorFromHero(page);
    await completeAreaScreen(page, { area: "22 м²" });
    await closeWithoutSending(page);
    await page.reload();

    await page.goto("/");
    const example = page.locator('[data-testid^="price-example-"]').first();
    await example.scrollIntoViewIfNeeded();
    await example.click();

    const modal = page.locator(MODAL);
    const choice = modal.locator('[data-draft-choice="offer"]');
    await expect(choice).toBeVisible();

    // До решения пресет кейса не применён — плашки предзаполнения нет (F-10).
    await expect(modal.getByText(/Подставил \d+ м² со страницы/)).toHaveCount(0);

    await choice.locator('[data-draft-action="start-new"]').click();

    // После явного выбора кейс применён: первый пример — «Спальня 12 м²».
    await expect(modal.getByText(/Подставил 12 м² со страницы/)).toBeVisible();
    expect(await readDraft(page)).not.toContain('"area":22');
  });
});

/**
 * Комплект света собирается в каталоге, а его карточки существуют только в
 * desktop-раскладке — поэтому отдельный describe с пропуском на уровне блока
 * (`test.skip()` с функцией внутри тела теста Playwright не поддерживает).
 */
test.describe("PT-007 · восстановление корзины света", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 640, "нужна desktop-раскладка каталога");

  test("«Продолжить» возвращает комнаты, позиции света и скидку", async ({ page }) => {
    await buildKitCalculation(page);
    const modal = page.locator(MODAL);

    // Потолок до закрытия: помещение и сумма — их и сверяем после восстановления.
    const ceilingBefore = squash((await modal.textContent()) ?? "");
    expect(ceilingBefore).toContain("Помещение·18м²");
    const ceilingTotalBefore = ceilingBefore.match(/Готовыйрасчёт(\d+₽)/)?.[1];
    expect(ceilingTotalBefore, "видна сумма потолка").toBeTruthy();

    /**
     * Комплект доехал: на Шаге 1 видны состав корзины, суммы и режим скидки.
     * Сверяем именно эти числа — до закрытия вход был со страницы каталога
     * (`entryMode: "lighting-first"`), а после восстановления — с главной, и
     * промежуточный режим «только свет» на «Проверке» зависит от точки входа.
     */
    await modal.getByRole("button", { name: /Проверить свет/ }).click();
    const lightingBefore = squash((await modal.textContent()) ?? "");
    const positionsBefore = lightingBefore.match(/Выбранное\((\d+)\)/)?.[1];
    const totalBefore = lightingBefore.match(/Итого:(\d+₽)/)?.[1];
    const nowBefore = lightingBefore.match(/Сейчас:(\d+₽)/)?.[1];
    expect(positionsBefore, `не видно состава корзины: ${lightingBefore}`).toBeTruthy();
    expect(totalBefore, `не видна сумма до скидки: ${lightingBefore}`).toBeTruthy();
    expect(nowBefore, `не видна сумма со скидкой: ${lightingBefore}`).toBeTruthy();
    expect(lightingBefore, lightingBefore).toContain("−25%");

    await closeWithoutSending(page);
    await page.reload();

    // Приёмка ТЗ: открываем калькулятор с главной, а не со страницы каталога.
    await openCalculatorFromHero(page);

    const choice = modal.locator('[data-draft-choice="offer"]');
    await expect(choice).toBeVisible();
    await choice.locator('[data-draft-action="continue"]').click();

    // Комнаты и потолок идентичны сохранённым.
    await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
    const ceilingAfter = squash((await modal.textContent()) ?? "");
    expect(ceilingAfter, ceilingAfter).toContain("Помещение·18м²");
    expect(ceilingAfter, ceilingAfter).toContain(`Готовыйрасчёт${ceilingTotalBefore}`);

    /**
     * Корзина света восстанавливается целиком: состав, количества, суммы и
     * режим скидки. Сверяем на Шаге 1 — там скидка видна всегда.
     *
     * На «Проверке» восстановленная сессия показывает свет без скидки ровно
     * как новая сессия на том же экране: флаг `lightingDiscountEligible`
     * ставится на переходе 0→1, а не хранится в черновике. Системно это
     * решается в PT-008 вместе с `EntryContext` — здесь намеренно не трогаем
     * отображение цен.
     *
     * Сравниваем данные, а не разметку: до закрытия Шаг 1 показывает
     * развёрнутый список («Выбранное (7)», «Итого/Сейчас»), после
     * восстановления — свёрнутую плашку «Комплект собран» («7 поз.»), потому
     * что вход идёт через другую дверь, без `initialLightingView`.
     */
    await modal.getByRole("button", { name: /Проверить свет/ }).click();
    const lightingAfter = squash((await modal.textContent()) ?? "");
    const positionsVisible =
      lightingAfter.includes(`Выбранное(${positionsBefore})`) ||
      lightingAfter.includes(`${positionsBefore}поз.`);
    expect(positionsVisible, `не видно состава корзины: ${lightingAfter}`).toBe(true);
    expect(lightingAfter, lightingAfter).toContain(totalBefore as string);
    expect(lightingAfter, lightingAfter).toContain(nowBefore as string);
    // Скидка «с потолком» после перехода на Шаг 1 действует — и в сводке тоже.
    expect(stripLightOf(lightingAfter), lightingAfter).toBe(nowBefore);
  });
});
