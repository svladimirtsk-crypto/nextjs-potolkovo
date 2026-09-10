import { expect, test } from "@playwright/test";
import { MODAL } from "./helpers";

/**
 * N-032 · Входы в расчёт и аргументы на странице услуги (F-33, F-36, F-37).
 */
test.describe("Страница услуги · входы в расчёт", () => {
  test("приёмка: не меньше двух входов в калькулятор до формы", async ({ page }) => {
    await page.goto("/uslugi/tenevoy-profil");

    const form = page.locator("#action");
    const formBox = await form.boundingBox();
    expect(formBox).not.toBeNull();

    // Считаем только то, что человек встретит, ещё не дойдя до формы.
    const entries = page.getByRole("button", { name: /Рассчитать|Хочу так же/ });
    let beforeForm = 0;
    for (let i = 0; i < (await entries.count()); i += 1) {
      const box = await entries.nth(i).boundingBox();
      if (box && box.y < formBox!.y) beforeForm += 1;
    }

    expect(beforeForm).toBeGreaterThanOrEqual(2);
  });

  test("F-33: CTA в середине страницы открывает расчёт", async ({ page }) => {
    await page.goto("/uslugi/tenevoy-profil");

    const mid = page.getByTestId("mid-cta");
    await expect(mid).toBeVisible();
    await mid.click();

    const modal = page.locator(MODAL);
    await modal.waitFor();
    // Пресет страницы доехал — теневой даёт сценарий из 10 вопросов.
    await expect(modal.getByText(/вопрос 1 из 10/)).toBeVisible();
  });

  test("F-36: «Хочу так же» открывает расчёт с площадью примера", async ({ page }) => {
    await page.goto("/uslugi/tenevoy-profil");

    const wantSame = page.getByTestId("want-same");
    await expect(wantSame.first()).toBeVisible();

    // Площадь берём из той же карточки, чтобы проверка не зависела от контента.
    const card = page.locator("article").filter({ has: wantSame.first() }).first();
    const areaText = (await card.innerText()).match(/(\d+)\s*м²/);
    expect(areaText).not.toBeNull();

    await wantSame.first().click();

    const modal = page.locator(MODAL);
    await modal.waitFor();
    await expect(modal.getByLabel("Площадь потолка, м²", { exact: true })).toHaveValue(
      areaText![1]
    );
  });

  test("F-37: кросс-селл объясняет выгоду связки", async ({ page }) => {
    await page.goto("/uslugi/tenevoy-profil");

    const related = page.locator("section").filter({
      hasText: "Что ещё часто выбирают вместе",
    });

    // Довод, а не пересказ названия услуги.
    await expect(related.getByText(/закладная/i).first()).toBeVisible();
  });
});
