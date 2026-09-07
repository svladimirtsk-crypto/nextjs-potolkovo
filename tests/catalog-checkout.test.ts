import { describe, expect, it } from "vitest";

import {
  buildCatalogLightingSnapshot,
  cartToLightingItems,
  productToLightingItem,
} from "@/lib/lighting/catalog-checkout";
import { lightingDiscountPercent } from "@/content/pricing";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
    categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
    available: true, params: [], keyAttributes: [], system: "NONE", kind: "OTHER",
    unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
  }) as FeedCatalogProduct;

describe("Снапшот корзины каталога", () => {
  const items = cartToLightingItems([
    { product: product({ productId: "a", name: "Профиль", priceRub: 1000 }), qty: 2 },
    { product: product({ productId: "b", name: "Светильник", priceRub: 500 }), qty: 1 },
  ]);

  it("сумма — произведение цены на количество", () => {
    expect(buildCatalogLightingSnapshot(items).totalRub).toBe(2500);
  });

  it("скидка «только оборудование» берётся из content/pricing", () => {
    const snap = buildCatalogLightingSnapshot(items);
    const expected = Math.round(2500 * (1 - lightingDiscountPercent("lighting-only") / 100));

    expect(snap.discountedTotalRub).toBe(expected);
    expect(snap.discountAmountRub).toBe(2500 - expected);
  });

  it("скидка «с потолком» больше, чем «только оборудование»", () => {
    const snap = buildCatalogLightingSnapshot(items);
    expect(snap.withCeilingDiscountedTotalRub).toBeLessThan(snap.discountedTotalRub);
  });

  /**
   * На странице каталога потолка ещё нет. Если бы режим сразу был
   * `with-ceiling`, в заявку ушли бы 25 % за неоплаченный потолок —
   * ровно та ошибка, что уже ловилась в заявке «только оборудование».
   */
  it("режим скидки — lighting-only: потолок ещё не посчитан", () => {
    expect(buildCatalogLightingSnapshot(items).discountMode).toBe("lighting-only");
  });

  it("пустая корзина даёт нулевые суммы, а не NaN", () => {
    const snap = buildCatalogLightingSnapshot([]);
    expect(snap.totalRub).toBe(0);
    expect(snap.discountedTotalRub).toBe(0);
    expect(Number.isNaN(snap.discountAmountRub)).toBe(false);
  });

  it("позиция несёт артикул, имя, количество и цену", () => {
    const item = productToLightingItem(product({ productId: "x1", name: "Трек", priceRub: 990 }), 3);
    expect(item).toEqual({ sku: "x1", name: "Трек", qty: 3, priceRub: 990 });
  });
});
