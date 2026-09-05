import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import {
  getPointSocket,
  isMountsOrGrilles,
  isPanelProduct,
  isSmartProduct,
  matchesPointSubtype,
  normalizeQty,
} from "../lib/lighting/product-predicates";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";

/**
 * N-051 · Классификация каталога должна быть одна на модалку и страницу.
 *
 * До объединения существовали две разошедшиеся копии предикатов. Тест
 * фиксирует поведение общей реализации на реальном фиде, чтобы расхождение
 * не появилось снова.
 */

const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;

describe("N-051 · предикаты каталога", () => {
  it("каждый точечный светильник попадает ровно в одну вкладку", () => {
    const spots = products.filter((p) => p.kind === "SPOT_FIXTURE" && !isPanelProduct(p));
    expect(spots.length).toBeGreaterThan(0);

    const subtypes = ["GX53", "MR16", "GU10", "OTHER"] as const;

    for (const product of spots) {
      const hits = subtypes.filter((subtype) => matchesPointSubtype(product, subtype));

      // Ни одного «потерянного» товара и ни одного дубля во вкладках.
      expect(hits, `${product.name} попал во вкладки: ${hits.join(", ") || "ни в одну"}`)
        .toHaveLength(1);
    }
  });

  it("светильник без распознанного цоколя уходит в «Прочее», а не пропадает", () => {
    const orphan = {
      kind: "SPOT_FIXTURE",
      name: "Светильник без цоколя в названии",
      vendorCode: "TEST-0001",
      categoryPath: "Точечные светильники",
    } as unknown as FeedCatalogProduct;

    expect(getPointSocket(orphan)).toBeNull();
    expect(matchesPointSubtype(orphan, "OTHER")).toBe(true);
  });

  it("legacy-артикулы без цоколя в названии распознаются", () => {
    const legacy = (vendorCode: string) =>
      ({
        kind: "SPOT_FIXTURE",
        name: "Светильник точечный",
        vendorCode,
        categoryPath: "Точечные светильники",
      }) as unknown as FeedCatalogProduct;

    expect(getPointSocket(legacy("0У-00007177"))).toBe("GX53");
    expect(getPointSocket(legacy("0У-00001551"))).toBe("MR16");
  });

  it("панели и закладные распознаются", () => {
    expect(
      isPanelProduct({ name: "Панель LED 600x600", categoryPath: "" } as FeedCatalogProduct)
    ).toBe(true);
    expect(
      isMountsOrGrilles({
        name: "Закладная под светильник",
        vendorCode: "",
        categoryPath: "",
      } as FeedCatalogProduct)
    ).toBe(true);
    expect(
      isSmartProduct({
        name: "КОЛИБРИ СМАРТ светильник",
        vendorCode: "",
        categoryPath: "",
      } as FeedCatalogProduct)
    ).toBe(true);
  });

  it("normalizeQty округляет по шагу и не уходит в минус", () => {
    expect(normalizeQty(2.3, "m")).toBe(2.5);
    expect(normalizeQty(2.2, "m")).toBe(2);
    expect(normalizeQty(3.4, "pcs")).toBe(3);
    expect(normalizeQty(-5, "pcs")).toBe(0);
    expect(normalizeQty(Number.NaN, "pcs")).toBe(0);
  });
});
