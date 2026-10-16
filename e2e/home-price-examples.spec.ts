import { expect, test } from "@playwright/test";
import { MODAL } from "./helpers";

/**
 * N-031 · Секция «Быстрый ориентир по цене» отвечает суммой, а не пересказом
 * шагов, и каждый пример продолжается в калькуляторе (F-25, F-29).
 */
test.describe("Главная · ценовые примеры", () => {
  test("три примера с суммами вместо схемы «Потолок / Освещение / Итог»", async ({ page }) => {
    await page.goto("/");

    const list = page.getByTestId("price-examples");
    await expect(list).toBeVisible();
    await expect(list.locator("li")).toHaveCount(3);

    // Прежние карточки-шаги не должны остаться ни в каком виде.
    await expect(page.getByText("1. Потолок")).toHaveCount(0);
    await expect(page.getByText("3. Итог")).toHaveCount(0);

    // Ориентир округлён: в сумме примера не бывает непустых сотен и десятков.
    const priceTexts = await list.locator("li").allInnerTexts();
    for (const text of priceTexts) {
      const match = text.match(/≈\s([\d\s\u00a0\u202f]+)\s?₽/);
      expect(match, `нет округлённой суммы в карточке: ${text}`).not.toBeNull();
      const value = Number(match![1].replace(/[\s\u00a0\u202f]/g, ""));
      expect(value % 500).toBe(0);
    }
  });

  test("клик по примеру «Кухня-гостиная» открывает квиз с площадью 24 м²", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("price-example-kitchen-shadow").click();

    const modal = page.locator(MODAL);
    await modal.waitFor();

    // Пресет должен доехать до экрана площади — иначе клик по примеру
    // ничем не отличается от обычной кнопки «Рассчитать».
    await expect(modal.getByLabel("Площадь потолка, м²", { exact: true })).toHaveValue("24");

    /**
     * UX-R2: доехал не только метраж, но и решение — теневой профиль добавил
     * свой вопрос, поэтому в комнате 6 вопросов. Линии и трек в этот список не
     * попадают: их спрашивают, только когда человек сам их выбрал.
     */
    await expect(modal.getByText(/вопрос 1 из 6/)).toBeVisible();
    // N-013: плашка называет подставленное значение, а не абстрактный «старт».
    await expect(modal.getByText(/Подставлено 24 м² со страницы/)).toBeVisible();
    /* Пресет принёс не только метраж: на следующем экране теневой профиль уже выбран. */
    await modal.getByRole("button", { name: /Подтвердить площадь/ }).click();
    await expect(modal.locator('[data-ceiling-option="shadow"]')).toHaveAttribute("aria-pressed", "true");
  });
});
