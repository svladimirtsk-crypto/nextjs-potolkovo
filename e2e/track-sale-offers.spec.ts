import { expect, test } from "@playwright/test";

/**
 * N-040 · Страница света: комплекты как офферы, порядок секций, чистый hero
 * (F-41–F-43, F-46).
 */
const PAGE = "/uslugi/prodazha-trekovogo-osveshcheniya";

test.describe("Страница света · офферы", () => {
  test("F-41: на карточке комплекта не больше двух чисел до раскрытия", async ({ page }) => {
    await page.goto(PAGE);

    const card = page.locator("article").filter({ hasText: "Для кухни" }).first();
    await card.scrollIntoViewIfNeeded();

    // Состав — человеческой строкой, а не списком артикулов с ваттами.
    await expect(card).toContainText(/м профиля/);
    await expect(card).toContainText(/светильник/);

    /**
     * innerText у <details> отдаёт и свёрнутое содержимое, поэтому берём
     * только то, что человек реально видит до раскрытия.
     */
    const visible = await card.evaluate((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("details").forEach((d) => d.remove());
      return clone.innerText;
    });

    // Ватты и цветовая температура — это спецификация, а не оффер.
    expect(visible).not.toMatch(/15W|4000K|lm/i);
    const prices = visible.match(/\d[\d\s\u00a0\u202f]*\s?₽/g) ?? [];
    expect(prices.length, `цены: ${prices.join(", ")}`).toBeLessThanOrEqual(2);
  });

  test("F-41: артикулы доступны по клику и не пропадают", async ({ page }) => {
    await page.goto(PAGE);

    const card = page.locator("article").filter({ hasText: "Для кухни" }).first();
    await card.scrollIntoViewIfNeeded();

    const summary = card.getByText(/Состав по артикулам/);
    await expect(summary).toBeVisible();
    await summary.click();

    // Точный список нужен при сборке заказа — он никуда не делся.
    await expect(card.getByText(/КОЛИБРИ|Профиль/).first()).toBeVisible();
    await expect(card).toContainText(/Только оборудование, без потолка/);
  });

  test("F-41: одно главное действие — «Взять этот комплект»", async ({ page }) => {
    await page.goto(PAGE);

    const card = page.locator("article").filter({ hasText: "Для кухни" }).first();
    await card.scrollIntoViewIfNeeded();

    await expect(card.getByRole("button", { name: "Взять этот комплект" })).toBeVisible();
  });

  test("F-42: в hero округлённая цена и факт про наличие вместо третьей скидки", async ({
    page,
  }) => {
    await page.goto(PAGE);

    const hero = page.locator("section").first();

    // «от 2 418 ₽» → «от 2 400 ₽».
    const from = (await hero.innerText()).match(/от\s([\d\s\u00a0\u202f]+)\s?₽/);
    expect(from).not.toBeNull();
    expect(Number(from![1].replace(/[\s\u00a0\u202f]/g, "")) % 100).toBe(0);

    await expect(hero).toContainText(/Со склада поставщика/);
  });

  test("F-43: объяснение систем идёт до каталога", async ({ page }) => {
    await page.goto(PAGE);

    const guide = page.getByText(/Какая система|COLIBRI, CLARUS/).first();
    const catalog = page.getByRole("tab").first();

    const guideBox = await guide.boundingBox();
    const catalogBox = await catalog.boundingBox();
    expect(guideBox).not.toBeNull();
    expect(catalogBox).not.toBeNull();

    // Выбирать систему в каталоге можно только после того, как объяснили разницу.
    expect(guideBox!.y).toBeLessThan(catalogBox!.y);
  });
});
