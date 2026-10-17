import { describe, expect, it } from "vitest";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import {
  OWNER_CONFIRMED,
  SMART_SECTION_NOTE,
  aliceRouteOf,
} from "@/lib/lighting/alice-routes";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

/**
 * Реальная витрина: нормализация + те же правки ролей, что применяют страница,
 * API и индекс каталога (`applyVendorOverrides`). Так тест видит то же, что лид.
 */
const products = normalizeFeedCatalogProducts((snapshotData as { products?: unknown[] }).products ?? []).map(
  applyVendorOverrides
);
const byName = (part: string) => products.find((p) => p.name.includes(part))!;

describe("Алиса · маршруты, подтверждённые владельцем", () => {
  it("любая лента идёт через Wi-Fi 5-в-1", () => {
    for (const name of ["6W", "10W", "22W", "RGBW", "RGB 24V", "CCT 24V"]) {
      const strip = products.find((p) => p.kind === "LED_STRIP" && p.name.includes("Светодиодная лента") && p.name.includes(name))!;
      expect(strip, name).toBeTruthy();
      const route = aliceRouteOf(strip);
      expect(route?.id, name).toBe("strip-5in1");
      expect(route?.detail).toContain(OWNER_CONFIRMED);
    }
  });

  it("SMART-трековые светильники идут через панель-конвертер", () => {
    const smartTrack = products.filter((p) => p.kind === "TRACK_FIXTURE" && /смарт/i.test(p.name));
    expect(smartTrack.length).toBeGreaterThanOrEqual(17);
    for (const product of smartTrack) {
      const route = aliceRouteOf(product);
      expect(route?.id, product.name).toBe("track-converter");
      expect(route?.detail).toContain("панель-конвертер");
    }
  });

  it("конвертер и панель управления — сам шлюз, пульт — нет", () => {
    expect(aliceRouteOf(byName("Конвертер WI-FI"))?.id).toBe("track-converter-gateway");
    expect(aliceRouteOf(byName("Панель управления"))?.id).toBe("track-converter-gateway");
    expect(aliceRouteOf(byName("Пульт для управления смарт системы"))).toBeNull();
  });

  it("обычный трековый светильник без SMART и точка не обещают Алису", () => {
    const plainTrack = products.find(
      (p) => p.kind === "TRACK_FIXTURE" && !/смарт/i.test(p.name)
    )!;
    expect(plainTrack).toBeTruthy();
    expect(aliceRouteOf(plainTrack)).toBeNull();
    const spot = products.find((p) => p.kind === "SPOT_FIXTURE")!;
    expect(aliceRouteOf(spot)).toBeNull();
  });

  it("формулировка держится на подтверждении владельца, а не на паспорте", () => {
    expect(SMART_SECTION_NOTE).toContain("подтверждены владельцем");
    expect(SMART_SECTION_NOTE).toContain("5-в-1");
    expect(SMART_SECTION_NOTE).toContain("панель-конвертер");
    expect(SMART_SECTION_NOTE).toContain("проверим перед заказом");
  });
});

describe("Управление треком · классификация из фида", () => {
  it("конвертер, панели и пульты SMART-трека — это управление, а не «прочее»", () => {
    const controlNames = products
      .filter((p) => /конвертер|панель управления|пульт для управления смарт/i.test(p.name))
      .map((p) => ({ name: p.name, kind: p.kind, system: p.system }));

    expect(controlNames.length).toBe(5);
    for (const item of controlNames) {
      expect(item.kind, item.name).toBe("TRACK_CONTROL");
      expect(item.system, item.name).toBe("COLIBRI_220");
    }
  });

  it("чёрная панель больше не уезжает в раздел «Подсветка карниза»", () => {
    const black = byName("Панель управления для трековой системы, черная");
    expect(black.system).toBe("COLIBRI_220");
    expect(black.kind).toBe("TRACK_CONTROL");
  });

  it("SMART-светильники трека остаются светильниками", () => {
    const luminaire: FeedCatalogProduct = byName("КОЛИБРИ СМАРТ трековый светильник");
    expect(luminaire.kind).toBe("TRACK_FIXTURE");
  });
});
