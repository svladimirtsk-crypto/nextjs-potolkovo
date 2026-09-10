import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CATALOG_SECTIONS } from "../lib/catalog-ui-config";
import { searchMatchesBySection, sectionOfProduct } from "../lib/lighting/catalog-filters";
import { applyCatalogFilterChange } from "../lib/lighting/use-catalog-filters";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";

const source = readFileSync(
  new URL("../app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx", import.meta.url),
  "utf8"
);

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
    categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
    available: true, params: [], keyAttributes: [], system: "NONE", kind: "OTHER",
    unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
  }) as FeedCatalogProduct;

describe("T-065 · глобальный поиск по каталогу", () => {
  it("запрос не сбрасывается при смене раздела", () => {
    /**
     * N-051: правило переехало из обработчика вкладки в общий переход
     * `applyCatalogFilterChange`, поэтому проверяем его напрямую, а не
     * грепом по разметке — прежний вариант ломался от любого рефакторинга,
     * хотя поведение оставалось верным.
     */
    const searching = {
      section: "track-systems",
      trackSystem: "COLIBRI_220",
      trackGroup: "TRACK_FIXTURE",
      pointSubtype: "GX53",
      lampSocket: "GX53",
      query: "диммер",
    } as const;

    const next = applyCatalogFilterChange({ ...searching }, {
      type: "section",
      value: "lamps",
    });

    expect(next.section).toBe("lamps");
    expect(next.query).toBe("диммер");
  });

  it("совпадения считаются по всему каталогу, а не по активной секции", () => {
    const products = [
      product({ productId: "psu", name: "Блок питания 100Вт", kind: "PSU" }),
      product({ productId: "ch", name: "Люстра Блок", kind: "CHANDELIER" }),
    ];

    // Активен раздел трековых систем — совпадений там нет, но подсказка их находит.
    const matches = searchMatchesBySection(products, "блок", "track-systems");
    expect(matches?.map((m) => m.id).sort()).toEqual(["chandeliers", "cornice-lighting"]);
  });

  it("активный раздел из подсказок исключён — переходить некуда", () => {
    const products = [product({ productId: "psu", name: "Блок питания", kind: "PSU" })];
    expect(searchMatchesBySection(products, "блок", "cornice-lighting")).toEqual([]);
  });

  it("подсказка показывает раздел и число найденного", () => {
    expect(source).toMatch(/«\{match\.label\}»: \{match\.count\}/);
  });

  it("у горизонтальных лент есть fade-край", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".scroll-fade-x");
    expect(source).toContain("scroll-fade-x");
  });

  /**
   * Каждый раздел каталога должен быть достижим: подсказка ведёт только туда,
   * куда `sectionOfProduct` умеет относить товары. Раздел без единого
   * возможного товара — мёртвая вкладка.
   */
  it("каждая секция каталога может быть целью подсказки", () => {
    const samples: Array<[string, FeedCatalogProduct]> = [
      ["track-systems", product({ kind: "TRACK_PROFILE" })],
      ["point-fixtures", product({ kind: "SPOT_FIXTURE" })],
      ["chandeliers", product({ kind: "CHANDELIER" })],
      ["cornice-lighting", product({ kind: "LED_STRIP" })],
      ["lamps", product({ kind: "LAMP" })],
      ["mounts-grilles", product({ name: "Вент.решетка D100", kind: "CEILING_COMPONENT" })],
    ];

    const reachable = new Set(samples.map(([, p]) => sectionOfProduct(p)));
    for (const section of CATALOG_SECTIONS) {
      expect(reachable, section.id).toContain(section.id);
    }
  });
});
