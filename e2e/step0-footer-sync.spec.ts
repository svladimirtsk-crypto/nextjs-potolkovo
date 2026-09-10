import { expect, test } from "@playwright/test";
import { MODAL } from "./helpers";

/**
 * N-050 · Футер Шага 0 идёт в ногу с экраном.
 *
 * Регрессия, ради которой написан тест: состояние публиковалось в useEffect,
 * то есть после отрисовки. Один кадр заголовок и кнопка не совпадали —
 * «Карнизы» с кнопкой «Подтвердить тип». Человек этого почти не замечает, а
 * быстрый клик попадает ровно в это окно и подтверждает предыдущий шаг
 * повторно: шаг «люстры» проскакивался молча.
 */
test.describe("Шаг 0 · футер и экран в одном кадре", () => {
  test("подпись кнопки соответствует заголовку на каждом шаге", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Рассчитать/ }).first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    await modal.getByRole("button", { name: /Одну комнату/ }).click();
    await modal.getByRole("button", { name: "18 м²", exact: true }).click();

    /** Заголовок экрана → фрагмент, который обязан быть в подписи кнопки. */
    const expected: Record<string, RegExp> = {
      "Площадь потолка": /площадь/i,
      "Тип потолка": /тип/i,
      "Карнизы": /карниз/i,
      "Монтаж: установка люстр": /люстр/i,
      "Монтаж: точечные светильники": /свет/i,
    };

    const seen: string[] = [];

    for (let i = 0; i < 10; i += 1) {
      if (await modal.getByRole("heading", { name: "Проверка" }).count()) break;

      const heading = ((await modal.locator("h3").first().textContent()) ?? "").trim();
      const confirm = modal.locator("button:visible").filter({ hasText: /^Подтвердить/ }).first();
      if (!(await confirm.count())) break;

      const label = ((await confirm.textContent()) ?? "").trim();
      seen.push(heading);

      const rule = expected[heading];
      if (rule) {
        // Ключевая проверка: подпись не отстала от экрана на кадр.
        expect(label, `экран «${heading}» → кнопка «${label}»`).toMatch(rule);
      }

      await confirm.click();
    }

    // Ни один шаг не проскочил: подтверждали каждый экран ровно один раз.
    expect(new Set(seen).size, `последовательность: ${seen.join(" > ")}`).toBe(seen.length);
    await expect(modal.getByRole("heading", { name: "Проверка" })).toBeVisible();
  });
});
