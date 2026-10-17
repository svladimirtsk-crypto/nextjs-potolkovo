import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { catalogViewProducts, sortCatalogProducts } from "@/lib/lighting/catalog-presentation";
import { filterCatalogProducts, type CatalogFilters } from "@/lib/lighting/catalog-filters";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { ProductCard } from "@/components/lighting/CatalogProductCard";
import { CatalogFreshness } from "@/app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogFreshness";

const item = (over: Partial<FeedCatalogProduct> = {}): FeedCatalogProduct => ({
  productId: "a", vendorCode: "SKU-A", offerId: "", name: "Светильник", url: "", categoryId: "", categoryPath: "", images: [], coverImage: "",
  priceRub: 100, available: true, params: [], keyAttributes: [], system: "COLIBRI_220", kind: "TRACK_FIXTURE", unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
});
const filters: CatalogFilters = { section: "track-systems", trackSystem: "COLIBRI_220", trackGroup: "TRACK_FIXTURE", pointSubtype: "GX53", lampSocket: "GX53", smartOnly: false, query: "" };

describe("R7 catalogue presentation", () => {
  const list = [item({ productId: "b", name: "Бета", priceRub: 300 }), item({ productId: "a", name: "Альфа", priceRub: 100 }), item({ productId: "c", name: "Гамма", priceRub: 200 })];
  it("ascending price, without changing feed order", () => { expect(sortCatalogProducts(Object.freeze(list), "price-asc").map(p => p.priceRub)).toEqual([100, 200, 300]); expect(list[0].productId).toBe("b"); });
  it("descending price", () => expect(sortCatalogProducts(list, "price-desc").map(p => p.priceRub)).toEqual([300, 200, 100]));
  it("Cyrillic names", () => expect(sortCatalogProducts(list, "name").map(p => p.name)).toEqual(["Альфа", "Бета", "Гамма"]));
  it("photo order is preserved in a new array", () => { const result = sortCatalogProducts(list, "photo"); expect(result).toEqual(list); expect(result).not.toBe(list); });
  it.each(["price-asc", "price-desc"] as const)("unknown prices last: %s", (sort) => {
    const result = sortCatalogProducts([item({ priceRub: 0 }), item({ priceRub: NaN }), ...list], sort);
    expect(result.slice(0, 3).every(p => p.priceRub > 0)).toBe(true);
  });
  it("without search the existing filters are unchanged", () => expect(catalogViewProducts(list, filters)).toEqual(filterCatalogProducts(list, filters)));
  it("finds a profile SKU even when fixture/another system is selected", () => {
    const profile = item({ vendorCode: "PROFILE-42", system: "CLARUS_48", kind: "TRACK_PROFILE" });
    expect(catalogViewProducts([profile], { ...filters, query: "profile-42" })).toEqual([profile]);
  });
  it("search is section-scoped, with other sections handled separately", () => expect(catalogViewProducts([item({ kind: "LAMP" })], { ...filters, query: "SKU-A" })).toEqual([]));
  it("SMART remains a filter during search", () => expect(catalogViewProducts([item()], { ...filters, smartOnly: true, query: "SKU-A" })).toEqual([]));
  it("SMART designation is not compatibility verification", () => {
    const html = renderToStaticMarkup(createElement(ProductCard, { product: item({ name: "SMART" }), qty: 0, onInc() {}, onDec() {} }));
    // Маркировка остаётся маркировкой: бейдж SMART не выдаётся за проверку совместимости.
    expect(html).toContain("не подтверждение совместимости");
    // Маршрут к Алисе при этом подтверждён владельцем — это не «обещание всей совместимости».
    expect(html).toContain("Алиса: через панель-конвертер");
    expect(html).toContain("подтверждено владельцем на его комплекте");
    expect(html).toContain("Конвертер Wi-Fi");
  });

  it("SMART without a confirmed route does not promise voice control", () => {
    // Точечный светильник с «СМАРТ» в названии: панель-конвертер к нему не относится.
    const html = renderToStaticMarkup(
      createElement(ProductCard, { product: item({ name: "Светильник GX53 АРТ СМАРТ", kind: "SPOT_FIXTURE" }), qty: 0, onInc() {}, onDec() {} })
    );
    expect(html).not.toContain("Алиса:");
    expect(html).toContain("маршрут к вашему помощнику для этой позиции не подтверждён");
  });
  it("unknown price is not displayed as free and cannot be added", () => {
    const html = renderToStaticMarkup(createElement(ProductCard, { product: item({ priceRub: 0 }), qty: 0, onInc() {}, onDec() {} }));
    expect(html).toContain("Цена уточняется"); expect(html).not.toContain("0 ₽"); expect(html).toMatch(/aria-label="Увеличить"[^>]*disabled/);
  });
  it("meter unit uses shared 10% discount, not a new formula", () => {
    const html = renderToStaticMarkup(createElement(ProductCard, { product: item({ priceRub: 100, unit: "m" }), qty: 0.5, onInc() {}, onDec() {} }));
    expect(html).toContain("90 ₽"); expect(html).toContain("/ м"); expect(html).toContain("0.5 м");
  });
  it("unknown timestamp is clearly unconfirmed", () => {
    const html = renderToStaticMarkup(createElement(CatalogFreshness, { updatedAt: "" }));
    expect(html).toContain("Дата данных не подтверждена"); expect(html).not.toContain("Invalid Date");
  });
  it("stale timestamp stays visible and does not assert live availability", () => {
    const html = renderToStaticMarkup(createElement(CatalogFreshness, { updatedAt: "2020-01-01" }));
    expect(html).toContain("2020"); expect(html).toContain("Цены могли измениться"); expect(html).toContain("подтверждения поставщика");
  });
});
