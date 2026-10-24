import { describe, expect, it } from "vitest";
import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import type { CatalogIndex, CatalogIndexProduct } from "@/lib/lighting/catalog-index";
import { acceptCatalogDraftReview, compareCatalogDraft } from "@/lib/lighting/catalog-draft-review";

const current: CatalogIndexProduct = {
  productId: "eks-offer-1", vendorCode: "NEW-SKU", name: "Лента 24 В",
  priceRub: 1200, available: true, stockByWarehouse: { moscow: 0 },
  packQty: null, unit: "pcs", system: "UNKNOWN", kind: "LED_STRIP",
  pieceLengthMeters: null, socket: null, coverImage: "",
};
const index = (product: CatalogIndexProduct = current, catalogVersion = "cat-new"): CatalogIndex => ({
  updatedAt: "2026-10-14T21:00:00Z", catalogVersion,
  discountPercentForCeilingOrder: 25, products: [product],
});
const cart = (extra: Partial<NonNullable<LightingSnapshot["items"]>[number]> = {}): LightingSnapshot => ({
  mode: "catalog", catalogVersion: "cat-old", userCustomizedLighting: true,
  items: [{
    sku: "eks-offer-1", name: "Лента", qty: 2, priceRub: 1000, vendorCode: "OLD-SKU",
    unit: "pcs", packQty: null, moscowStock: 5, ...extra,
  }],
  totalRub: 2000, discountMode: "lighting-only", discountedTotalRub: 1800,
});

describe("LED-20 · immutable versioned draft review", () => {
  it("price, vendorCode and Moscow stock are shown as a diff; no silent repricing", () => {
    const old = cart();
    const before = JSON.stringify(old);
    const review = compareCatalogDraft(old, index());
    expect(review.fromVersion).toBe("cat-old");
    expect(review.toVersion).toBe("cat-new");
    expect(review.changes.map(c => c.field)).toEqual(["priceRub", "vendorCode", "moscowStock"]);
    expect(review.requiresReview).toBe(true);
    expect(review.canApply).toBe(true);
    expect(acceptCatalogDraftReview(old, index(), review)).toBeNull();
    expect(JSON.stringify(old)).toBe(before);
    const accepted = acceptCatalogDraftReview(old, index(), review, "2026-10-22T09:00:00Z");
    expect(accepted?.items?.[0]).toMatchObject({
      sku: "eks-offer-1", priceRub: 1200, vendorCode: "NEW-SKU", moscowStock: 0, qty: 2,
    });
    expect(accepted?.totalRub).toBe(2400);
    expect(accepted?.discountedTotalRub).toBe(2160);
    expect(accepted?.catalogReview).toMatchObject({
      fromVersion: "cat-old", toVersion: "cat-new", fields: ["priceRub", "vendorCode", "moscowStock"],
    });
    expect(JSON.stringify(old)).toBe(before);
  });

  it("package, unit and missing SKU cannot auto-apply even with acknowledgement", () => {
    for (const changed of [
      index({ ...current, packQty: 5 }),
      index({ ...current, unit: "m" }),
      index({ ...current, productId: "different-id", vendorCode: "different-code" }),
      index({ ...current, available: false }),
    ]) {
      const old = cart();
      const review = compareCatalogDraft(old, changed);
      expect(review.requiresReview).toBe(true);
      expect(review.canApply).toBe(false);
      expect(acceptCatalogDraftReview(old, changed, review, "2026-10-22T09:00:00Z")).toBeNull();
      expect(old.items).toHaveLength(1);
    }
  });

  it("unknown/legacy unit and duplicate line are not silently coerced, even with the same feed version", () => {
    expect(compareCatalogDraft(cart({ unit: undefined }), index()).canApply).toBe(false);
    const oldHardwareUnit = { ...cart({ unit: "m", moscowStock: 0, priceRub: 1200, vendorCode: "NEW-SKU" }), catalogVersion: "cat-new" };
    const unitReview = compareCatalogDraft(oldHardwareUnit, index());
    expect(unitReview.changes.map((change) => change.field)).toEqual(["unit"]);
    expect(unitReview.requiresReview).toBe(true);
    expect(unitReview.canApply).toBe(false);
    const duplicated = { ...cart(), items: [...cart().items!, ...cart().items!] };
    expect(compareCatalogDraft(duplicated, index()).canApply).toBe(false);
  });

  it("even a version-only change requires acknowledgement, while exact match does not", () => {
    const same = { ...cart({ priceRub: 1200, vendorCode: "NEW-SKU", moscowStock: 0 }), catalogVersion: "cat-new" };
    const unchanged = compareCatalogDraft(same, index());
    expect(unchanged.changes).toEqual([]);
    expect(unchanged.requiresReview).toBe(false);
    expect(acceptCatalogDraftReview(same, index(), unchanged)?.catalogVersion).toBe("cat-new");
    const versionOnly = compareCatalogDraft(same, index(current, "cat-revised"));
    expect(versionOnly.changes).toEqual([]);
    expect(versionOnly.requiresReview).toBe(true);
    expect(acceptCatalogDraftReview(same, index(current, "cat-revised"), versionOnly)).toBeNull();
  });

  it("rejects changed current data since comparison, even if the version string was not updated", () => {
    const old = cart();
    const checked = compareCatalogDraft(old, index());
    const changedIndex = index({ ...current, priceRub: 1500 });
    expect(acceptCatalogDraftReview(old, changedIndex, checked, "2026-10-22T09:00:00Z")).toBeNull();
    expect(compareCatalogDraft(old, index(current, "")).canApply).toBe(false);
  });
});
