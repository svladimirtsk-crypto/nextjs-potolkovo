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

  test("товар без фото у поставщика получает заглушку с названием, а не пустоту", async ({
    page,
  }) => {
    await page.goto(PAGE);

    // КОЛИБРИ РИО — один из 34 товаров, чью обложку поставщик удалил.
    // Берём именно светильник из сетки: карточки комплектов выше по странице
    // имеют похожий alt, но у них своя обложка.
    const img = page.locator('#price img[alt*="трековый светильник РИО"]').first();
    await img.scrollIntoViewIfNeeded();
    await expect(img).toBeVisible();

    // Картинки ленивые: до попадания в вьюпорт src может быть ещё пустым.
    await expect
      .poll(async () => (await img.getAttribute("src")) ?? "")
      .toMatch(/^data:image\/svg/);

    const src = (await img.getAttribute("src")) ?? "";

    // Заглушка обязана нести название товара, иначе карточка выглядит битой.
    const decoded = decodeURIComponent(src);
    expect(decoded).toContain("РИО");
  });
});
