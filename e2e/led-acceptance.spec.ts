import { expect, test } from "@playwright/test";

import snapshot from "../data/eks-feed2-snapshot.json";

type Entry = { productId: string; vendorCode: string; name: string };
const products = (snapshot as { products: Entry[] }).products;

/**
 * CATALOG-LED-TZ §10, сценарий 01: проверяем не название кнопки, а количество
 * товара в настоящей корзине после клика. Каталог собирается из нормализованного
 * снимка, где у этих четырёх позиций исходная единица ошибочно равна «м».
 * Это локальная приёмка единиц, НЕ проверка MOQ/упаковки у поставщика.
 */
const hardware = [
  { sku: "0У-00006564", group: "Управление", label: "WB5" },
  { sku: "0У-00006525", group: "Питание", label: "БП 24 В" },
  { sku: "0У-00006554", group: "Управление", label: "RF-пульт" },
  { sku: "0У-00006565", group: "Управление", label: "набор пульт + контроллер" },
] as const;

for (const item of hardware) {
  test(`LED-01 · ${item.label}: одно нажатие добавляет целую штуку, не 0,5 м`, async ({ page }) => {
    const product = products.find((entry) => entry.vendorCode === item.sku);
    expect(product, `в снимке нет SKU ${item.sku}`).toBeDefined();

    await page.goto("/uslugi/prodazha-trekovogo-osveshcheniya#price", { waitUntil: "domcontentloaded" });
    await page.getByRole("tab", { name: "Подсветка карниза", exact: true }).click();
    await page.getByTestId(item.group === "Питание" ? "led-group-power" : "led-group-control").click();
    await page.getByLabel("Поиск по каталогу").fill(item.sku);

    const card = page.locator(`.pk-product[data-product-id="${product!.productId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card).toHaveAttribute("data-unit", "pcs");
    const amount = card.locator("output");
    await expect(amount).toHaveText("0 шт");
    await card.getByRole("button", { name: "Увеличить" }).click();
    await expect(amount).toHaveText("1 шт");
    await card.getByRole("button", { name: "Увеличить" }).click();
    await expect(amount).toHaveText("2 шт");
    await card.getByRole("button", { name: "Уменьшить" }).click();
    await expect(amount).toHaveText("1 шт");
  });
}
