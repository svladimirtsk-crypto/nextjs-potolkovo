import { expect, test } from "@playwright/test";

import { MODAL, completeAreaScreen } from "./helpers";

/**
 * N-003 сц. 11–12 + N-010 · Раскладка модалки калькулятора.
 *
 * Смысл: контенту мастера должно доставаться место, а не 150 px между шапкой
 * и футером. Проверяем реальные `boundingBox`, потому что классы Tailwind в
 * разметке ничего не гарантируют — важен итог в браузере.
 */

const MIN_CONTENT_HEIGHT = 480;

test.describe("Раскладка модалки", () => {
  test("сценарий 11: контенту достаётся ≥ 480 px", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    const content = modal.locator(".calculator-modal-content");
    const box = await content.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(MIN_CONTENT_HEIGHT);
  });

  test("сценарий 12: на мобильном первый экран показывает выбор и площадь без скролла", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) > 640, "только мобильный проект");

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    // Оба ключевых элемента должны попадать в вьюпорт без прокрутки.
    await expect(modal.getByRole("button", { name: /^Комнату/ })).toBeInViewport();
    await expect(modal.getByRole("button", { name: /^Весь объект/ })).toBeInViewport();
  });

  test("desktop: модалка — окно со сводкой справа, а не полноэкранная полоса", async ({
    page,
    viewport,
  }) => {
    test.skip((viewport?.width ?? 0) < 1024, "только desktop-проект");

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    const box = await modal.boundingBox();
    expect(box).not.toBeNull();

    // Панель не должна растягиваться на всю ширину экрана (F-01).
    expect(box!.width).toBeLessThanOrEqual(1200);
    expect(box!.width).toBeLessThan(viewport!.width);

    // Правая колонка со сводкой присутствует и держит сумму на виду.
    const summary = modal.locator("aside");
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Сводка");
    await expect(summary).toContainText("₽");
  });

  test("мобильный остаётся полноэкранным, сводка-колонка скрыта", async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) > 640, "только мобильный проект");

    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    const box = await modal.boundingBox();
    expect(box!.width).toBe(viewport!.width);

    // На мобильном сумму показывает строка цены сверху, а не боковая колонка.
    await expect(modal.locator("aside")).toBeHidden();
  });

  test("сумма остаётся видимой на Шаге 1", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await completeAreaScreen(page, { area: "18 м²", points: "6 шт." });
    await modal.getByRole("button", { name: /Подобрать свет/ }).first().click();

    // Независимо от ширины сумма расчёта должна быть на экране. Строка цены
    // существует в двух экземплярах (мобильная сверху и desktop-сводка
    // справа), но видимой в любой момент должна быть ровно одна.
    await expect(modal.getByText(/Итого/).locator("visible=true").first()).toBeVisible();
  });
});
