import { describe, expect, it } from "vitest";

import { calcSystemEntryPrice } from "@/lib/lighting/system-entry-price";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

function product(patch: Partial<FeedCatalogProduct> & { productId: string }): FeedCatalogProduct {
  return {
    productId: patch.productId,
    vendorCode: patch.vendorCode ?? patch.productId,
    name: patch.name ?? patch.productId,
    priceRub: patch.priceRub ?? 0,
    system: patch.system ?? "",
    kind: patch.kind ?? "OTHER",
    unit: patch.unit ?? "pcs",
    pieceLengthMeters: patch.pieceLengthMeters ?? null,
    lengthMeters: patch.pieceLengthMeters ?? null,
    params: [],
    keyAttributes: [],
  } as unknown as FeedCatalogProduct;
}

describe("T-044 - cena vhoda v sistemu", () => {
  const catalog = [
    // 2 м за 3000 ₽ = 1500 ₽/м, дороже следующего.
    product({ productId: "p1", system: "COLIBRI_220", kind: "TRACK_PROFILE", priceRub: 3000, pieceLengthMeters: 2 }),
    // 2 м за 2000 ₽ = 1000 ₽/м — самый дешёвый в пересчёте на метр.
    product({ productId: "p2", system: "COLIBRI_220", kind: "TRACK_PROFILE", priceRub: 2000, pieceLengthMeters: 2 }),
    product({ productId: "f1", system: "COLIBRI_220", kind: "TRACK_FIXTURE", priceRub: 2500 }),
    product({ productId: "f2", system: "COLIBRI_220", kind: "TRACK_FIXTURE", priceRub: 1800 }),
    product({ productId: "other", system: "CLARUS_48", kind: "TRACK_PROFILE", priceRub: 100, pieceLengthMeters: 2 }),
  ];

  it("beret samyy deshevyy profil za metr plyus samyy deshevyy svetilnik", () => {
    const entry = calcSystemEntryPrice("COLIBRI_220", catalog);
    expect(entry).toEqual({
      profilePerMeterRub: 1000,
      fixtureRub: 1800,
      perMeterWithFixtureRub: 2800,
    });
  });

  it("sravnenie idet po cene za metr, a ne po cene kuska", () => {
    // Кусок за 2000 ₽ дешевле куска за 3000 ₽ и в пересчёте на метр тоже.
    expect(calcSystemEntryPrice("COLIBRI_220", catalog)?.profilePerMeterRub).toBe(1000);
  });

  it("bez svetilnikov sistema ne pokazyvaet cenu vhoda", () => {
    expect(calcSystemEntryPrice("CLARUS_48", catalog)).toBeNull();
    expect(calcSystemEntryPrice("UNKNOWN", catalog)).toBeNull();
  });

  it("metrazhnyy profil beretsya po cene za metr kak est", () => {
    const entry = calcSystemEntryPrice("TRACK_220", [
      product({ productId: "m1", system: "TRACK_220", kind: "TRACK_PROFILE", priceRub: 900, unit: "m" }),
      product({ productId: "mf", system: "TRACK_220", kind: "TRACK_FIXTURE", priceRub: 1100 }),
    ]);
    expect(entry?.perMeterWithFixtureRub).toBe(2000);
  });
});
