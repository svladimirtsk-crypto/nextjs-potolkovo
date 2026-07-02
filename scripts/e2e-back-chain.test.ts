/**
 * E2E-тест на цепочку «Назад» в квиз-флоу Step 0.
 *
 * Проверяет, что после прохождения квиза до сводки последовательные
 * нажатия «Назад» возвращают лида на SetupScreen без потери значений
 * и без «телепортов» вперёд.
 *
 * Запуск: npx playwright test scripts/e2e-back-chain.test.ts
 *
 * Принцип: используем Playwright для эмуляции последовательности
 * кликов в браузере. Проверяем DOM-состояние после каждого «Назад».
 */

import { test, expect } from "@playwright/test";

test.describe("Step 0 Back chain — регрессия", () => {
  test("8× Назад со сводки → SetupScreen без потери значений", async ({ page }) => {
    // 1. Открываем страницу с калькулятором (модалка)
    await page.goto("/?openCalculator=1");
    await page.waitForSelector('[aria-label="Закрыть"]', { timeout: 5000 });

    // 2. Выбираем сценарий «Стандартный» (уже по умолчанию)
    await page.click('button[aria-pressed="true"]:has-text("Стандартный")');

    // 3. Выбираем «Одна комната»
    await page.click('button:has-text("Одна комната")');

    // 4. Добавляем первую комнату (например «Кухня»)
    await page.click('button:has-text("+ Кухня")');

    // 5. Подтверждаем площадь
    await page.click('button:has-text("Подтвердить")');

    // 6. Выбираем тип потолка (простой)
    await page.click('button:has-text("Простой потолок")');
    await page.click('button:has-text("Подтвердить")');

    // 7. Карниз — не нужен
    await page.click('button[aria-pressed="true"]:has-text("не нужен")');
    await page.click('button:has-text("Подтвердить")');

    // 8. Люстры — не нужны
    await page.click('button[aria-pressed="true"]:has-text("Не нужно")');
    await page.click('button:has-text("Подтвердить")');

    // 9. Точечный свет — не нужен
    await page.click('button[aria-pressed="true"]:has-text("Без светильников")');
    await page.click('button:has-text("Подтвердить")');

    // 10. Теперь мы на сводке (summary). Проверяем, что она отображается
    await expect(page.locator('[data-step0-summary]')).toBeVisible({ timeout: 3000 });

    // 11. Нажимаем «Назад» 8 раз и проверяем, что не вылетаем за пределы
    // После каждого «Назад» проверяем, что квиз всё ещё открыт и не произошло
    // «телепорта» вперёд или на Step 1/2.
    for (let i = 0; i < 8; i++) {
      const backBtn = page.locator('button:has-text("← Назад")');
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(200);
      }
    }

    // 12. После 8× «Назад» мы должны оказаться на экране выбора сценария
    // (SetupScreen). Проверяем, что квиз всё ещё открыт и отображает
    // заголовок выбора сценария.
    await expect(
      page.locator('text=Какой вариант решения рассматриваете?')
    ).toBeVisible({ timeout: 3000 });

    // 13. Также проверяем, что значения не сбросились окончательно:
    // при повторном выборе «Стандартный» сценарий виден
    const standardBtn = page.locator('button[aria-pressed="true"]:has-text("Стандартный")');
    await expect(standardBtn).toBeVisible({ timeout: 2000 });

    // 14. Проверяем, что мы НЕ перешли на Step 1 или Step 2
    await expect(
      page.locator('[data-step0-summary]')
    ).not.toBeVisible({ timeout: 1000 });
  });

  test("«Назад» со Step 2 при отсутствии света → Step 0, а не Step 1", async ({ page }) => {
    // Сценарий: standard без света, лид идёт 0 → 2
    await page.goto("/?openCalculator=1");
    await page.waitForSelector('[aria-label="Закрыть"]', { timeout: 5000 });

    // Быстро проходим квиз (минимальный набор)
    await page.click('button:has-text("Одна комната")');
    await page.click('button:has-text("+ Кухня")');
    await page.click('button:has-text("Подтвердить")');
    await page.click('button:has-text("Простой потолок")');
    await page.click('button:has-text("Подтвердить")');
    
    // Карниз не нужен
    const noCornice = page.locator('button[aria-pressed="true"]:has-text("не нужен")');
    if (await noCornice.isVisible()) {
      await noCornice.click();
    }
    await page.click('button:has-text("Подтвердить")');

    // Люстры не нужны
    await page.click('button[aria-pressed="true"]:has-text("Не нужно")');
    await page.click('button:has-text("Подтвердить")');

    // Свет не нужен
    await page.click('button[aria-pressed="true"]:has-text("Без светильников")');
    await page.click('button:has-text("Подтвердить")');

    // На сводке кликаем «К итогу →» (standard primary action)
    await page.click('button:has-text("К итогу →")');

    // Мы на Step 2
    await expect(page.locator('text=Итог расчета')).toBeVisible({ timeout: 3000 });

    // Нажимаем «Назад» на Step 2
    await page.click('button:has-text("← Назад")');

    // Проверяем, что мы на Step 0, а НЕ на Step 1 (освещение)
    await expect(page.locator('text=Параметры потолка')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Освещение')).not.toBeVisible({ timeout: 1000 });
  });
});
