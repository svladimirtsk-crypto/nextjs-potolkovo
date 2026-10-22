import { describe, expect, it } from "vitest";
import { normalizeFeedCatalogProduct } from "@/lib/feed2-snapshot-normalize";
import {
  moscowCandidateAllowed, moscowQuantityOf, moscowStockMessage, moscowStockStateOf,
  parseMoscowQuantity, supplierAvailableOf,
} from "@/lib/lighting/moscow-stock";
import { getCatalogIndex } from "@/lib/lighting/catalog-index";
import { catalogIndexToFeedProduct } from "@/lib/lighting/catalog-products";

const stock = (moscow: unknown, other: unknown = 99) => ({
  available: true,
  params: [
    { label: "Остатки Брн", value: other },
    { label: "Остатки Мск", value: moscow },
  ],
});

function fixture(extra: Record<string, unknown> = {}) {
  return {
    productId: "eks-led-1", offerId: "123", vendorCode: "SKU-1", name: "Лента 24V",
    priceRub: 970, available: true, kind: "LED_STRIP", unit: "m",
    ...extra,
  };
}

describe("LED-19 · only the Moscow warehouse can inform preliminary selection", () => {
  it("available=true, Moscow 0 and another warehouse >0 still means zero in Moscow", () => {
    const input = stock("0", 123);
    expect(moscowQuantityOf(input)).toBe(0);
    expect(moscowStockStateOf(input)).toBe("reported_zero");
    expect(moscowCandidateAllowed(input)).toBe(false);
    expect(moscowStockMessage(input)).toContain("0");
    expect(moscowStockMessage(input)).not.toMatch(/в наличии|Барнаул/);
  });

  it("without a Moscow observation, available=true and stock elsewhere stay unknown", () => {
    const input = { available: true, params: [{ label: "Остатки Брн", value: "110" }] };
    expect(moscowQuantityOf(input)).toBeNull();
    expect(moscowStockStateOf(input)).toBe("unknown");
    expect(moscowCandidateAllowed(input)).toBe(true); // candidate for inquiry, never verified stock
    expect(moscowStockMessage(input)).toContain("не подтверждено");
  });

  it("positive supplier observation is NOT a reservation; supplier false overrides it", () => {
    expect(moscowStockStateOf(stock("7"))).toBe("reported_positive");
    expect(moscowStockMessage(stock("7"))).toContain("уточним");
    expect(moscowStockStateOf({ available: false, stockByWarehouse: { moscow: 7 } })).toBe("supplier_unavailable");
    expect(moscowCandidateAllowed({ available: false, stockByWarehouse: { moscow: 7 } })).toBe(false);
    expect(supplierAvailableOf("false")).toBe(false);
  });

  it("does not coerce null/empty, invalid, duplicate or negative stock into a quantity", () => {
    for (const raw of [null, "", "-5", "in stock", Infinity, NaN, {}, "1000000001"]) {
      expect(parseMoscowQuantity(raw)).toBeNull();
    }
    expect(parseMoscowQuantity("0")).toBe(0);
    expect(parseMoscowQuantity("2,5")).toBe(2.5);
    const duplicate = { available: true, params: [...stock("3").params, { label: "Остатки Мск", value: "5" }] };
    expect(moscowQuantityOf(duplicate)).toBeNull();
    expect(moscowStockStateOf(duplicate)).toBe("unknown");
  });

  it("normalizer keeps only Moscow, an explicit source date and no raw warehouse attributes", () => {
    const normalized = normalizeFeedCatalogProduct(fixture({
      ...stock("0", 120),
      keyAttributes: stock("0").params,
      stockByWarehouse: { moscow: 0, barnaul: 120 },
    }), "2026-10-14T21:00:00Z")!;
    expect(normalized.available).toBe(true);
    expect(normalized.stockByWarehouse).toEqual({ moscow: 0 });
    expect(normalized.availabilityState).toBe("reported_zero");
    expect(normalized.stockObservedAt).toBe("2026-10-14T21:00:00Z");
    expect(normalized.params).toEqual([]);
    expect(normalized.keyAttributes).toEqual([]);
    expect(JSON.stringify(normalized)).not.toContain("brn");
  });

  it("current historical snapshot and lightweight index have UNKNOWN Moscow stock", async () => {
    const index = await getCatalogIndex();
    const sample = index.products.find(p => p.vendorCode === "0У-00006564");
    expect(sample).toBeDefined();
    expect(index.catalogVersion).toMatch(/^cat-sha256-[a-f0-9]{64}$/);
    expect(sample?.stockByWarehouse).toBeUndefined();
    expect(sample?.availabilityState).toBe("unknown");
    const product = catalogIndexToFeedProduct(sample!);
    expect(moscowStockStateOf(product)).toBe("unknown");
    expect(product.available).toBe(true);
  });
});
