import { describe, expect, it } from "vitest";
import { catalogVersionOf, diffCatalog, formatCatalogReview } from "../scripts/feed-review.mjs";

const product = (id: string, extra: Record<string, unknown> = {}) => ({
  productId: id, offerId: id, vendorCode: `SKU-${id}`, name: `Товар ${id}`,
  priceRub: 970, unit: "pcs", available: true, ...extra,
});
const feed = (products: Array<ReturnType<typeof product>>) => ({
  updatedAt: "2026-10-14T21:00:00Z", source: "fixture", categories: [], products,
});

describe("LED-20 · versioned catalog diff and manual review report", () => {
  it("tracks price/SKU/packaging/Moscow changes by stable productId", () => {
    const before = feed([product("1", { stockByWarehouse: { moscow: 7 } })]);
    const after = feed([product("1", {
      priceRub: 1200, vendorCode: "SKU-new", packQty: 5,
      stockByWarehouse: { moscow: 0 },
    })]);
    const diff = diffCatalog(before, after);
    expect(diff.schemaVersion).toBe(1);
    expect(diff.fromVersion).not.toBe(diff.toVersion);
    expect(diff.toVersion).toBe(catalogVersionOf(after));
    expect(diff.changes.map(c => c.field)).toEqual(["priceRub", "vendorCode", "packQty", "moscowStock"]);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.requiresReview).toBe(true);
    const report = formatCatalogReview(diff);
    expect(report).toContain("Москва: 1");
    expect(report).toContain("970 → 1200");
    expect(report).toContain("SKU-1 → SKU-new");
  });

  it("does not auto-migrate changed productId even when offerId matches", () => {
    const diff = diffCatalog(feed([product("1")]), feed([product("new", { offerId: "1" })]));
    expect(diff.added).toMatchObject([{ productId: "new", possiblePreviousProductId: "1" }]);
    expect(diff.removed).toMatchObject([{ productId: "1" }]);
    expect(diff.requiresReview).toBe(true);
  });

  it("hash changes for non-price fields too, and ignores self-reported catalogVersion", () => {
    const original = feed([product("1")]);
    const renamed = feed([product("1", { name: "Другой товар" })]);
    const diff = diffCatalog(original, renamed);
    expect(diff.changes).toEqual([]); // selected fields unchanged; full content still requires review
    expect(diff.requiresReview).toBe(true);
    expect(catalogVersionOf({ ...renamed, catalogVersion: "supplier-claimed-version" }))
      .toBe(catalogVersionOf(renamed));
  });
});
