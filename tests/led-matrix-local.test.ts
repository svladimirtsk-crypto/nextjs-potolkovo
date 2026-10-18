import { describe, expect, it } from "vitest";

import snapshot from "@/data/eks-feed2-snapshot.json";
import { normalizeFeedCatalogProduct } from "@/lib/feed2-snapshot-normalize";
import { ledRoleOf, parseStripSpec, planLedPower } from "@/lib/lighting/led-hardware";
import { normalizeQty } from "@/lib/lighting/product-predicates";
import { resolvePriceBasis, stripPurchaseQty } from "@/lib/lighting/led-price-basis";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

const raw = (snapshot as { products: { vendorCode: string }[] }).products;

const product = (name: string): FeedCatalogProduct => ({
  productId: name, vendorCode: name, offerId: name, name,
  url: "", categoryId: "", categoryPath: "Светодиодная лента", images: [], coverImage: "",
  priceRub: 1000, available: true, params: [], keyAttributes: [],
  system: "SMART_HOME", kind: "LED_STRIP", unit: "m", lengthMeters: null, pieceLengthMeters: null,
});

/**
 * Только то, что можно проверить локально без паспортов/склада/стенда.
 * Остальные части сценариев и все 26 итоговых статусов — в
 * docs/evidence/catalog-led/acceptance-2026-10-18.md.
 */
describe("CATALOG-LED-TZ §10 · воспроизводимые локальные фикстуры", () => {
  it("01 · WB5, БП, RF-пульт и комплект получают pcs, не 0,5 м", () => {
    const ids = ["0У-00006564", "0У-00006525", "0У-00006554", "0У-00006565"];
    for (const sku of ids) {
      const fromFeed = raw.find((item) => item.vendorCode === sku);
      expect(fromFeed, sku).toBeDefined();
      const normalized = normalizeFeedCatalogProduct(fromFeed)!;
      expect(ledRoleOf(normalized), sku).not.toBe("strip");
      expect(normalized.unit, sku).toBe("pcs");
      expect(Number.isInteger(normalizeQty(0.5, normalized.unit)), sku).toBe(true);
    }
  });

  it("02 · при гипотетически подтверждённой цене катушки 6 м = 2 катушки × 970 ₽, не 6 × 970 ₽", () => {
    // Это тест расчётной ветки, не свидетельство EKS о priceUnit/packQty/MOQ.
    const basis = resolvePriceBasis({ name: "Лента 24V 10W катушка 5 м", priceRub: 970 });
    const bought = stripPurchaseQty({ installedMeters: 6, basis });
    expect(basis.evidence).toBe("title_reel");
    expect(bought).toEqual({ qty: 2, unit: "pcs", roundedMeters: 10 });
    expect(bought.qty * 970).toBe(1940);
  });

  it("06 · RGB-only C03RF не становится контроллером для RGBW и RGB+CCT", () => {
    for (const mode of ["RGBW", "RGB+CCT"]) {
      const strip = parseStripSpec(`Светодиодная лента ${mode} 24V 60 диодов 14,4W катушка 5 м`)!;
      const plan = planLedPower({
        strip, meters: 5,
        products: [product("Контроллер для светодиодной ленты RGB C03RF 12A, 12-24В")],
      });
      expect(plan.controller, mode).toBeNull();
      expect(plan.status, mode).toBe("needs_review");
      expect(plan.warnings.join(" "), mode).toContain("5-в-1");
    }
  });

  it("08 · учебный K=1,25 даёт 306 Вт; текущая политика владельца K=1,30 даёт 318,2 Вт", () => {
    const strip = parseStripSpec("Светодиодная лента RGB 24V 60 диодов 14,4W катушка 5 м")!;
    const plan = planLedPower({
      strip, meters: 17,
      products: [250, 300, 360].map((watts) => product(`Блок питания ПРО 24V ${watts}W`)),
    });
    expect(17 * 14.4 * 1.25).toBeCloseTo(306);
    expect(plan.loadW).toBe(244.8);
    expect(plan.requiredW).toBe(318.2);
    expect(plan.psu?.spec.watts).toBe(360); // 250 и 300 меньше обеих границ.
    expect(plan.status).toBe("needs_review"); // нет подходящего контроллера/паспортов.
  });

  it("09 · 6 м линии в два ряда по 12 Вт/м — 144 Вт, а не 72", () => {
    const strip = parseStripSpec("Светодиодная лента монохром 24V 120 диодов 12W катушка 5 м")!;
    const plan = planLedPower({ strip, meters: 6, rows: 2, products: [] });
    expect(plan.installedMeters).toBe(12);
    expect(plan.loadW).toBe(144);
    expect(plan.requiredW).toBe(187.2); // утверждённый запас 30 %.
    expect(plan.status).toBe("needs_review");
  });
});
