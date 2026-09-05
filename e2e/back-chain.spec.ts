import { expect, test } from "@playwright/test";

/**
 * T-091 · Цепочка «Назад» в Step 0.
 *
 * Регрессия, ради которой тест существует: «Назад» уводило лида не на
 * предыдущий экран, а «телепортировало» вперёд/в начало, теряя введённую
 * площадь. Поэтому проверяем и экран, и сохранность значения.
 */

const MODAL = '[data-testid="calculator-modal"][data-open="true"]';

test.describe("Step 0 · цепочка «Назад»", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();
    await page.locator(MODAL).waitFor();
  });

  test("«Назад» с типа потолка возвращает на площадь и сохраняет её", async ({ page }) => {
    const modal = page.locator(MODAL);

    await modal.getByRole("button", { name: /^Комнату/ }).click();

    // Выбираем нестандартную площадь, чтобы отличить её от дефолта 18 м².
    await modal.getByRole("button", { name: "25 м²", exact: true }).click();
    await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();

    // Мы на экране типа потолка.
    await expect(modal.getByRole("button", { name: /Подтвердить тип/ })).toBeVisible();

    await modal.getByRole("button", { name: /Назад/ }).click();

    // Вернулись именно на площадь, и выбор не потерян.
    const confirmArea = modal.getByRole("button", { name: /Подтвердить площадь/ });
    await expect(confirmArea).toBeVisible();
    await expect(modal.getByRole("button", { name: "25 м²", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("«Назад» на первом шаге возвращает к выбору сценария, а не закрывает модалку", async ({
    page,
  }) => {
    const modal = page.locator(MODAL);

    await modal.getByRole("button", { name: /^Комнату/ }).click();
    await modal.getByRole("button", { name: /Назад/ }).click();

    // Модалка осталась открытой и предлагает снова выбрать режим расчёта.
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("button", { name: /^Комнату/ })).toBeVisible();
    await expect(modal.getByRole("button", { name: /^Весь объект/ })).toBeVisible();
  });
});
