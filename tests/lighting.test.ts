import { describe, expect, it } from "vitest";

import { resolveInitialLightingStep } from "@/lib/lighting/resolve-initial-step";
import { pricing } from "@/content/pricing";
import { detectSocket, normalizeSocketText } from "@/lib/feed2-products";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import snapshotData from "@/data/eks-feed2-snapshot.json";
import { TRACK_PROFILE_WHITELIST } from "@/lib/catalog-ui-config";

const products = normalizeFeedCatalogProducts(
  (snapshotData as { products?: unknown[] }).products ?? []
).map((p) => applyVendorOverrides(p));

const byVendor = new Map(products.map((p) => [String(p.vendorCode).trim(), p]));

const emptyCart = {
  hasTrackProfile: false,
  hasTrackFixture: false,
  hasPoints: false,
  hasMissingLamps: false,
  isEmpty: true,
};

describe("T-010 · стартовый экран Шага 1", () => {
  it("трек с Шага 0 → выбор системы", () => {
    expect(
      resolveInitialLightingStep({ requiredTrackMeters: 8, requiredPointQty: 0, cart: emptyCart })
    ).toBe("system");
  });

  it("только точки → экран точек", () => {
    expect(
      resolveInitialLightingStep({ requiredTrackMeters: 0, requiredPointQty: 6, cart: emptyCart })
    ).toBe("points");
  });

  it("нет данных → состояние none", () => {
    expect(
      resolveInitialLightingStep({ requiredTrackMeters: 0, requiredPointQty: 0, cart: emptyCart })
    ).toBe("none");
  });

  it("в корзине профиль без светильников → трековые светильники", () => {
    expect(
      resolveInitialLightingStep({
        requiredTrackMeters: 8,
        requiredPointQty: 0,
        cart: { ...emptyCart, isEmpty: false, hasTrackProfile: true },
      })
    ).toBe("trackFixtures");
  });
});

describe("T-011 · метраж профилей", () => {
  it("профили из whitelist имеют длину куска", () => {
    for (const [system, skus] of Object.entries(TRACK_PROFILE_WHITELIST)) {
      for (const sku of skus) {
        const product = byVendor.get(sku);
        expect(product, `${sku} (${system}) должен быть в фиде`).toBeTruthy();
        expect(inferPieceLengthMeters(product!), `${sku} длина куска`).toBeGreaterThan(0);
      }
    }
  });

  it("шинопровод АРТ 3000 мм читается как 3 м", () => {
    expect(inferPieceLengthMeters(byVendor.get("0У-00006341")!)).toBeCloseTo(3, 3);
  });
});

describe("T-013 · нормализация цоколей", () => {
  it("варианты написания приводятся к канону", () => {
    expect(normalizeSocketText("MR-16")).toContain("mr16");
    expect(normalizeSocketText("GU 10")).toContain("gu10");
    expect(normalizeSocketText("GU5,3")).toContain("gu5.3");
  });

  it("GU10 распознаётся отдельным цоколем", () => {
    const gu10 = products.filter((p) => detectSocket(p) === "GU10");
    expect(gu10.length).toBeGreaterThan(0);
  });
});

describe("T-009 · досчёт монтажа", () => {
  const extraSpots = (selected: number, included: number) =>
    Math.max(0, selected - included) * pricing.spotInstall;

  it("корзина в пределах Шага 0 не даёт доплаты", () => {
    expect(extraSpots(12, 12)).toBe(0);
  });

  it("две лишние точки — 1500 ₽", () => {
    expect(extraSpots(14, 12)).toBe(1500);
  });
});
