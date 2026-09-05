import { describe, expect, it } from "vitest";

import {
  autoAssembleProfiles,
  clearIncompatibleSystem,
  conflicts,
  fixturesHintForMeters,
  isTrackSystemId,
  profilesForMeters,
  type Cart,
} from "@/lib/lighting/kit-rules";
import { COLIBRI_PROFILES } from "@/lib/lighting-kits";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

/** Минимальный товар фида — только поля, которые читают правила. */
function product(patch: Partial<FeedCatalogProduct> & { productId: string }): FeedCatalogProduct {
  return {
    productId: patch.productId,
    vendorCode: patch.vendorCode ?? patch.productId,
    name: patch.name ?? patch.productId,
    priceRub: patch.priceRub ?? 1000,
    system: patch.system ?? "",
    kind: patch.kind ?? "OTHER",
    unit: patch.unit ?? "pcs",
    pieceLengthMeters: patch.pieceLengthMeters ?? null,
    lengthMeters: patch.pieceLengthMeters ?? null,
    params: [],
    keyAttributes: [],
  } as unknown as FeedCatalogProduct;
}

const catalog = new Map<string, FeedCatalogProduct>(
  [
    product({ productId: "colibri-profile", system: "COLIBRI_220", kind: "TRACK_PROFILE", priceRub: 2000 }),
    product({ productId: "colibri-fixture", system: "COLIBRI_220", kind: "TRACK_FIXTURE", priceRub: 3000 }),
    product({ productId: "clarus-profile", system: "CLARUS_48", kind: "TRACK_PROFILE", priceRub: 2500 }),
    product({ productId: "spot", kind: "SPOT_FIXTURE", priceRub: 700 }),
  ].map((p) => [p.productId, p])
);

const resolve = (id: string) => catalog.get(id);

describe("T-031 · isTrackSystemId", () => {
  it("узнаёт три поддерживаемые системы", () => {
    expect(isTrackSystemId("COLIBRI_220")).toBe(true);
    expect(isTrackSystemId("CLARUS_48")).toBe(true);
    expect(isTrackSystemId("TRACK_220")).toBe(true);
  });

  it("отсекает всё остальное", () => {
    expect(isTrackSystemId("")).toBe(false);
    expect(isTrackSystemId("COLIBRI")).toBe(false);
  });
});

describe("T-031 · conflicts", () => {
  it("нет конфликта в пустой корзине", () => {
    expect(conflicts({}, catalog.get("clarus-profile")!, resolve)).toBeNull();
  });

  it("нет конфликта внутри одной системы", () => {
    const cart: Cart = { "colibri-profile": 2 };
    expect(conflicts(cart, catalog.get("colibri-fixture")!, resolve)).toBeNull();
  });

  it("точки не привязаны к системе и конфликта не создают", () => {
    const cart: Cart = { "colibri-profile": 2 };
    expect(conflicts(cart, catalog.get("spot")!, resolve)).toBeNull();
  });

  it("считает убираемые позиции и сумму при смене системы", () => {
    const cart: Cart = { "colibri-profile": 2, "colibri-fixture": 1, spot: 4 };
    const conflict = conflicts(cart, catalog.get("clarus-profile")!, resolve);

    expect(conflict).not.toBeNull();
    expect(conflict!.currentSystem).toBe("COLIBRI_220");
    expect(conflict!.targetSystem).toBe("CLARUS_48");
    // Точки остаются — считаются только две трековые позиции.
    expect(conflict!.count).toBe(2);
    expect(conflict!.totalRub).toBe(2000 * 2 + 3000);
    expect(conflict!.message).toContain("Заменить систему COLIBRI на CLARUS?");
  });
});

describe("T-031 · clearIncompatibleSystem", () => {
  it("убирает чужую систему и не трогает точки", () => {
    const cart: Cart = { "colibri-profile": 2, "colibri-fixture": 1, spot: 4 };
    const next = clearIncompatibleSystem(cart, "CLARUS_48", resolve);

    expect(next).toEqual({ spot: 4 });
  });

  it("не мутирует исходную корзину", () => {
    const cart: Cart = { "colibri-profile": 2 };
    clearIncompatibleSystem(cart, "CLARUS_48", resolve);
    expect(cart).toEqual({ "colibri-profile": 2 });
  });

  it("для неизвестной системы возвращает корзину как есть", () => {
    const cart: Cart = { "colibri-profile": 2 };
    expect(clearIncompatibleSystem(cart, "NOPE", resolve)).toBe(cart);
  });
});

describe("T-032 · profilesForMeters", () => {
  it("на нулевой длине ничего не подбирает", () => {
    expect(profilesForMeters(0, COLIBRI_PROFILES)).toEqual([]);
  });

  it("покрывает требуемый метраж не меньше запрошенного", () => {
    const pieces = profilesForMeters(5, COLIBRI_PROFILES);
    const total = pieces.reduce((sum, piece) => sum + (piece.lengthMm / 1000) * piece.qty, 0);

    expect(pieces.length).toBeGreaterThan(0);
    expect(total).toBeGreaterThanOrEqual(5);
  });
});

describe("T-032 · fixturesHintForMeters", () => {
  it("без метража подсказки нет", () => {
    expect(fixturesHintForMeters(0, 1)).toBeNull();
  });

  it("даёт вилку ±20 % вокруг рекомендации", () => {
    const hint = fixturesHintForMeters(10, 1);

    expect(hint).toEqual({ min: 8, max: 12, suggested: 10 });
  });

  it("минимум никогда не опускается ниже одного светильника", () => {
    expect(fixturesHintForMeters(1, 1)?.min).toBe(1);
  });
});

describe("T-032 · autoAssembleProfiles", () => {
  // Профили каталога: 3 м, 2 м и 1 м с реальными длинами куска.
  const profiles = [
    product({ productId: "p3", kind: "TRACK_PROFILE", priceRub: 10500, pieceLengthMeters: 3 }),
    product({ productId: "p2", kind: "TRACK_PROFILE", priceRub: 7400, pieceLengthMeters: 2 }),
    product({ productId: "p1", kind: "TRACK_PROFILE", priceRub: 3900, pieceLengthMeters: 1 }),
  ];

  it("без метража плана нет", () => {
    expect(autoAssembleProfiles(0, profiles)).toBeNull();
  });

  it("без подходящих товаров плана нет", () => {
    expect(autoAssembleProfiles(10, [])).toBeNull();
  });

  it("10 м собирает как 3 м × 3 + 1 м × 1", () => {
    const plan = autoAssembleProfiles(10, profiles)!;

    expect(plan.pieces.map((piece) => [piece.product.productId, piece.qty])).toEqual([
      ["p3", 3],
      ["p1", 1],
    ]);
    expect(plan.totalMeters).toBe(10);
    expect(plan.totalRub).toBe(10500 * 3 + 3900);
  });

  it("остаток добирается вверх, а не оставляет недобор", () => {
    const plan = autoAssembleProfiles(3.5, profiles)!;

    expect(plan.totalMeters).toBeGreaterThanOrEqual(3.5);
  });

  it("игнорирует позиции без цены и без длины куска", () => {
    const plan = autoAssembleProfiles(3, [
      product({ productId: "free", kind: "TRACK_PROFILE", priceRub: 0, pieceLengthMeters: 3 }),
      product({ productId: "nolen", kind: "TRACK_PROFILE", priceRub: 5000 }),
      ...profiles,
    ])!;

    expect(plan.pieces.every((piece) => piece.product.productId !== "free")).toBe(true);
    expect(plan.pieces.every((piece) => piece.product.productId !== "nolen")).toBe(true);
  });
});
