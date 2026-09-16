import { describe, expect, it } from "vitest";

import type { LightingItem } from "../lib/calculator-modal-types";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
} from "../lib/lighting-formulas";
import {
  buildLightingSnapshotFromItems,
  createLightingOnlySnapshot,
  nextCatalogSnapshot,
} from "../lib/lighting/track-sale-snapshot";

/**
 * PT-018 (B-F104) · снимок заявки из каталога страницы трекового света.
 *
 * До переноса это тело жило внутри `useEffect(() => setSnapshot(prev => …))`:
 * проверить его можно было только кликами по странице. Здесь фиксируются оба
 * правила, которые легко потерять при правке: пустая корзина не трогает снимок
 * без блока «свет», а `leadSource` не перезаписывается.
 */

const item = (over: Partial<LightingItem> = {}): LightingItem => ({
  sku: "0У-00006089",
  name: "Профиль COLIBRI 1 м",
  qty: 1,
  priceRub: 3700,
  ...over,
});

describe("createLightingOnlySnapshot", () => {
  it("даёт полную структуру с нулями и подписью «потолок не рассчитан»", () => {
    const snapshot = createLightingOnlySnapshot();

    expect(snapshot.total).toBe(0);
    expect(snapshot.ceilingTypeLabel).toBe("Потолок пока не рассчитан");
    expect(snapshot.derivedInputs).toEqual({
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    });
    expect(snapshot.leadSource).toBeUndefined();
  });
});

describe("buildLightingSnapshotFromItems", () => {
  it("пустая корзина — null, а не блок с нулями", () => {
    expect(buildLightingSnapshotFromItems([])).toBeNull();
  });

  it("считает сумму и обе скидки: «только свет» и «с потолком»", () => {
    const lighting = buildLightingSnapshotFromItems([item({ qty: 2 }), item({ sku: "0У-00002308", priceRub: 5220 })]);

    expect(lighting).not.toBeNull();
    expect(lighting?.mode).toBe("catalog");
    expect(lighting?.totalRub).toBe(2 * 3700 + 5220);
    expect(lighting?.discountedTotalRub).toBe(applyLightingOnlyDiscount(12620));
    expect(lighting?.discountPercentApplied).toBe(LIGHTING_ONLY_DISCOUNT_PERCENT);
    expect(lighting?.userCustomizedLighting).toBe(true);
    // Скидка «с потолком» глубже, чем «только свет» — иначе экран покажет не ту цену.
    expect(lighting?.withCeilingDiscountedTotalRub).toBeLessThan(
      lighting?.discountedTotalRub ?? 0
    );
  });
});

describe("nextCatalogSnapshot", () => {
  // `!` — ниже проверяем, что комплект собрался; `null` уронит тесты явно.
  const lighting = buildLightingSnapshotFromItems([item()])!;

  it("пустая корзина и снимка нет — возвращает тот же объект (записи в стор не будет)", () => {
    expect(nextCatalogSnapshot(null, {
      lighting: null,
      selectedTotal: 0,
      lightingOnlySelectedTotal: 0,
    })).toBeNull();

    const prev = { ...createLightingOnlySnapshot(), total: 12345 };
    expect(
      nextCatalogSnapshot(prev, { lighting: null, selectedTotal: 0, lightingOnlySelectedTotal: 0 })
    ).toBe(prev);
  });

  it("пустая корзина при собранном комплекте — снимает свет и его скидку, остальное не трогает", () => {
    const prev = {
      ...createLightingOnlySnapshot(),
      total: 99000,
      leadSource: "service-page",
      lighting,
      lightingDiscountApplied: true,
    };

    const next = nextCatalogSnapshot(prev, {
      lighting: null,
      selectedTotal: 0,
      lightingOnlySelectedTotal: 0,
    });

    expect(next?.lighting).toBeUndefined();
    expect(next?.lightingDiscountApplied).toBe(false);
    expect(next?.lightingDiscountMode).toBe("none");
    expect(next?.lightingDiscountPercentApplied).toBe(0);
    expect(next?.lightingDiscountAmountRub).toBe(0);
    expect(next?.total).toBe(99000);
    expect(next?.leadSource).toBe("service-page");
  });

  it("без снимка создаёт заготовку «сначала свет» и ставит свой leadSource", () => {
    const next = nextCatalogSnapshot(null, {
      lighting,
      selectedTotal: 3700,
      lightingOnlySelectedTotal: applyLightingOnlyDiscount(3700),
    });

    expect(next?.ceilingTypeLabel).toBe("Потолок пока не рассчитан");
    expect(next?.leadSource).toBe("track-sale-page-catalog");
    expect(next?.lighting).toEqual(lighting);
    expect(next?.lightingDiscountApplied).toBe(true);
    expect(next?.lightingDiscountMode).toBe("lighting-only");
    expect(next?.lightingDiscountPercentApplied).toBe(LIGHTING_ONLY_DISCOUNT_PERCENT);
  });

  it("существующий leadSource не перезаписывает: источник привлечения важнее", () => {
    const prev = { ...createLightingOnlySnapshot(), leadSource: "yandex-direct" };

    const next = nextCatalogSnapshot(prev, {
      lighting,
      selectedTotal: 3700,
      lightingOnlySelectedTotal: applyLightingOnlyDiscount(3700),
    });

    expect(next?.leadSource).toBe("yandex-direct");
  });

  it("сумму скидки берёт из блока света, а при её отсутствии считает от разницы", () => {
    const fromLighting = nextCatalogSnapshot(null, {
      lighting,
      selectedTotal: 3700,
      lightingOnlySelectedTotal: applyLightingOnlyDiscount(3700),
    });
    expect(fromLighting?.lightingDiscountAmountRub).toBe(lighting?.discountAmountRub);

    const withoutAmount = { ...lighting, discountAmountRub: undefined };
    const fallback = nextCatalogSnapshot(null, {
      lighting: withoutAmount,
      selectedTotal: 4000,
      lightingOnlySelectedTotal: 3000,
    });
    expect(fallback?.lightingDiscountAmountRub).toBe(1000);
  });

  it("разница не уходит в минус", () => {
    const withoutAmount = { ...lighting, discountAmountRub: undefined };
    const next = nextCatalogSnapshot(null, {
      lighting: withoutAmount,
      selectedTotal: 3000,
      lightingOnlySelectedTotal: 4000,
    });

    expect(next?.lightingDiscountAmountRub).toBe(0);
  });
});
