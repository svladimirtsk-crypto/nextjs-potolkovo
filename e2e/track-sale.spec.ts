import { expect, test, type Locator, type Page } from "@playwright/test";

import { MODAL, interceptLeadApi, submitLeadForm } from "./helpers";

/**
 * T-091 · Сценарий 5 — мобильный checkout со страницы света.
 *
 * Мобильная раскладка принципиальна: бар корзины на странице света
 * существует только под sm-брейкпоинтом, и именно там ломался checkout.
 */
test.describe("Страница света (мобильная)", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 640, "только мобильный проект");

  test("сценарий 5: добавить товар → бар корзины → оформить", async ({ page }) => {
    await interceptLeadApi(page);

    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");

    // Первый «+» в сетке товаров (кнопка подписана самим символом).
    await page.getByRole("button", { name: "+", exact: true }).first().click();

    const cartBar = page.locator("[data-cart-bar]").last();
    await expect(cartBar).toBeVisible();
    await expect(cartBar).toContainText("Корзина");

    await cartBar.getByRole("button", { name: "Оформить" }).click();

    // Диалог выбора: только оборудование (−10 %) или вместе с потолком (−25 %).
    const dialog = page.getByLabel("Как оформляем комплект?");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Только оборудование −10 %/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /С потолком −25 %/ })).toBeVisible();
  });

  test("один бар корзины, а не несколько конкурирующих", async ({ page }) => {
    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");
    await page.getByRole("button", { name: "+", exact: true }).first().click();

    const visibleBars = page.locator("[data-cart-bar]:visible");
    await expect(visibleBars).toHaveCount(1);
  });
});

/**
 * N-050 · Заявка со страницы света несёт состав корзины.
 *
 * Был баг: бар корзины показывал «1 поз. · 2 772 ₽», диалог выбора работал,
 * форма отправлялась — но в теле POST /api/lead не было ни `snapshot`, ни
 * `totals`. Мастер получал имя и телефон без товаров и суммы.
 *
 * Причина: флаг `hasInteracted` ставился только при переходе Шага 0 → 1/2, а
 * этот путь Шаг 0 минует. Без флага ActionForm не прикладывала снапшот.
 * Теперь открытие с готовым набором света тоже считается взаимодействием.
 */
test.describe("Страница света · состав заявки", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 640, "только мобильный проект");

  test("сценарий 5b: заявка несёт позиции корзины и сумму", async ({ page }) => {
    const leads = await interceptLeadApi(page);

    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");
    await page.getByRole("button", { name: "+", exact: true }).first().click();

    const cartBar = page.locator("[data-cart-bar]").last();
    await cartBar.getByRole("button", { name: "Оформить" }).click();

    const dialog = page.getByLabel("Как оформляем комплект?");
    await dialog.getByRole("button", { name: /Только оборудование/ }).click();

    const modal = page.locator('[data-testid="calculator-modal"][data-open="true"]');
    await submitLeadForm(page, { scope: modal });

    const snapshot = leads.at(-1)?.snapshot as
      | { lighting?: { items?: unknown[]; effectiveTotalRub?: number }; totals?: Record<string, number> }
      | undefined;

    expect(snapshot?.lighting?.items?.length ?? 0).toBeGreaterThan(0);
    expect(snapshot?.totals?.lightingEffective ?? 0).toBeGreaterThan(0);

    /**
     * Заказ «только оборудование» — потолка в нём нет. Дефолтная комната из
     * стора не должна попадать в сумму: набор на 2 772 ₽ превращался в счёт
     * на 20 772 ₽, и клиент увидел бы в письме чужие деньги.
     */
    expect(snapshot?.totals?.grand).toBe(snapshot?.totals?.lightingEffective);
    expect(snapshot?.totals?.discountPct).toBe(10);
  });
});

/**
 * T-065 · Глобальный поиск: совпадения из других разделов должны находиться,
 * иначе поиск выглядит сломанным.
 */
test.describe("Поиск по каталогу", () => {
  test("подсказывает разделы с совпадениями и сохраняет запрос", async ({ page }) => {
    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");

    const search = page.getByLabel("Поиск по каталогу");
    await search.fill("заклад");

    await expect(page.getByText("Найдено ещё:")).toBeVisible();

    // Переход в подсказанный раздел не должен стирать запрос.
    await page.getByRole("button", { name: /Закладные|решетки/i }).first().click();
    await expect(search).toHaveValue("заклад");
  });
});

/**
 * PT-011 · S08: закрытие экрана интента не должно запускать оформление.
 *
 * Диалог «Как оформляем комплект?» возвращал `boolean`, поэтому Escape и клик
 * по подложке давали тот же результат, что и кнопка «Только оборудование −10 %»:
 * человек закрывал вопрос, а попадал в форму заявки с режимом скидки, который
 * он не выбирал. Ниже — три способа закрыть (Escape, подложка, крестик) и
 * проверка, что корзина и страница остались нетронутыми, плюс явный путь
 * «с потолком», который раньше не был покрыт.
 */
test.describe("Экран интента каталога: закрытие ≠ выбор", () => {
  /** Открыть диалог выбора так, как это делает человек: товар → «Оформить». */
  async function openIntentDialog(page: Page) {
    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price");
    await page.getByRole("button", { name: "+", exact: true }).first().click();

    const cartBar = page.locator("[data-cart-bar]:visible").last();
    await expect(cartBar).toBeVisible();

    const checkout = cartBar.getByRole("button", { name: "Оформить" });
    await checkout.click();

    const dialog = page.getByLabel("Как оформляем комплект?");
    await expect(dialog).toBeVisible();

    return { cartBar, checkout, dialog };
  }

  /**
   * Общее для всех трёх способов закрыть: ничего не открылось и не изменилось.
   *
   * Пауза перед проверкой модалки обязательна, а не «на всякий случай»:
   * калькулятор открывается асинхронно, и мгновенный `toHaveCount(0)` на старом
   * коде успевал пройти до того, как модалка появлялась, — тест зеленел на баге.
   * Полсекунды с запасом покрывают открытие, после чего отсутствие модалки уже
   * осмысленный факт.
   */
  async function expectStayedInCatalog(
    page: Page,
    cartBar: Locator,
    checkout: Locator,
    dialog: Locator,
  ) {
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(500);
    await expect(page.locator(MODAL)).toHaveCount(0);
    await expect(cartBar).toBeVisible();
    await expect(cartBar).toHaveAttribute("data-count", "1");
    await expect(cartBar).toContainText("Корзина · 1 поз.");
    // PT-011: фокус возвращается к элементу, открывшему диалог.
    await expect(checkout).toBeFocused();
  }

  test("Escape закрывает диалог и оставляет в каталоге", async ({ page }) => {
    const { cartBar, checkout, dialog } = await openIntentDialog(page);

    await page.keyboard.press("Escape");

    await expectStayedInCatalog(page, cartBar, checkout, dialog);
  });

  test("клик по подложке закрывает диалог и оставляет в каталоге", async ({ page }) => {
    const { cartBar, checkout, dialog } = await openIntentDialog(page);

    // Панель центрирована, угол экрана — точно подложка.
    await page.mouse.click(4, 4);

    await expectStayedInCatalog(page, cartBar, checkout, dialog);
  });

  test("крестик закрывает диалог и оставляет в каталоге", async ({ page }) => {
    const { cartBar, checkout, dialog } = await openIntentDialog(page);

    await dialog.getByTestId("confirm-dialog-close").click();

    await expectStayedInCatalog(page, cartBar, checkout, dialog);
  });

  test("явная кнопка «С потолком −25 %» ведёт в расчёт потолка", async ({ page }) => {
    const { dialog } = await openIntentDialog(page);

    await dialog.getByRole("button", { name: /С потолком −25 %/ }).click();

    const modal = page.locator(MODAL);
    await expect(modal).toBeVisible();
    // Шаг 0 начинается с выбора количества комнат — значит, идём считать потолок.
    await expect(modal.getByRole("button", { name: /Одну комнату/ })).toBeVisible();
  });
});
