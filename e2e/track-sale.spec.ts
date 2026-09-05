import { expect, test } from "@playwright/test";

import { interceptLeadApi } from "./helpers";

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
