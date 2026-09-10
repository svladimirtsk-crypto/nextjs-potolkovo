import { expect, test } from "@playwright/test";

/**
 * N-003 · Сценарий 14 — карточки каталога показывают локальные фото (N-020).
 *
 * Проверяем не наличие манифеста, а то, что браузер реально отрисовал файл из
 * `/catalog/`: раньше данные лежали в бандле, а UI всё равно ходил хотлинком.
 * Единственный надёжный признак — `currentSrc` + `naturalWidth` в живом DOM.
 */

const PAGE = "/uslugi/prodazha-trekovogo-osveshcheniya#price";

/**
 * COLIBRI открыт по умолчанию, но у всех 16 его светильников поставщик удалил
 * обложки (404), поэтому там ожидаемы заглушки. Смотрим CLARUS_48 — систему с
 * полным покрытием фото.
 */
async function openClarus(page: import("@playwright/test").Page) {
  await page.goto(PAGE);
  const clarus = page.getByRole("button", { name: /CLARUS|48/i }).first();
  if (await clarus.count()) await clarus.click();

  // Картинки ленивые: ждём фактической загрузки, а не фиксированной паузы —
  // иначе тест флачит на медленном прогоне всего набора.
  await expect
    .poll(
      async () =>
        page.locator("#price img").evaluateAll(
          (imgs) =>
            imgs.filter(
              (img) =>
                img.getBoundingClientRect().width > 0 &&
                (img.currentSrc || "").includes("/catalog/") &&
                img.naturalWidth > 0
            ).length
        ),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(0);
}

test.describe("Каталог · локальные фото", () => {
  test("сценарий 14: карточки CLARUS отдаются из /catalog/ и не битые", async ({ page }) => {
    await openClarus(page);

    const stats = await page.locator("#price img").evaluateAll((imgs) => {
      const visible = imgs.filter((img) => img.getBoundingClientRect().width > 0);
      return {
        total: visible.length,
        local: visible.filter((img) => (img.currentSrc || "").includes("/catalog/")).length,
        hotlink: visible.filter((img) => (img.currentSrc || "").includes("eksmarket")).length,
        broken: visible.filter((img) => img.complete && img.naturalWidth === 0).length,
      };
    });

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.local).toBeGreaterThan(0);

    // Сборка не должна ходить в сеть за картинками, а битых быть не может.
    expect(stats.hotlink).toBe(0);
    expect(stats.broken).toBe(0);
  });

  test("нигде на странице нет хотлинков на поставщика", async ({ page }) => {
    await page.goto(PAGE);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(250);
    }

    const broken = await page.locator("img").evaluateAll((imgs) =>
      imgs
        .filter((img) => img.getBoundingClientRect().width > 0)
        .filter((img) => (img.currentSrc || "").includes("eksmarket") || (img.complete && img.naturalWidth === 0))
        .map((img) => img.getAttribute("alt") ?? "")
    );

    expect(broken).toEqual([]);
  });

  test("КОЛИБРИ РИО показывает настоящее фото, а не заглушку", async ({ page }) => {
    await page.goto(PAGE);

    /**
     * Раньше этот светильник был одним из 34 товаров, чью обложку поставщик
     * удалил, и тест проверял заглушку с названием. После обновления ссылок
     * из актуального фида (`fill-missing-covers.mjs`) локальное фото есть у
     * 100 % товаров с ценой, и заглушка здесь означала бы регресс.
     *
     * Сама заглушка в коде осталась как страховка на случай новой битой
     * ссылки, но отдельного теста на неё теперь нет: подходящего товара в
     * каталоге не осталось, а заводить фиктивный ради проверки — значит
     * тестировать выдуманные данные.
     */
    const img = page.locator('#price img[alt*="трековый светильник РИО"]').first();
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();

    await expect
      .poll(async () => (await img.getAttribute("src")) ?? "")
      .toMatch(/^\/catalog\/.*\.webp$/);

    await expect.poll(async () => img.evaluate((n: HTMLImageElement) => n.naturalWidth)).toBeGreaterThan(0);
  });
});
