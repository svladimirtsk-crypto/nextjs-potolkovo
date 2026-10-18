import { describe, expect, it } from "vitest";

import {
  filterCatalogProducts,
  productsOfSection,
  searchMatchesBySection,
  sectionOfProduct,
  type CatalogFilters,
} from "@/lib/lighting/catalog-filters";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
    categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
    available: true, params: [], keyAttributes: [], system: "NONE", kind: "OTHER",
    unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
  }) as FeedCatalogProduct;

const base: CatalogFilters = {
  section: "chandeliers", trackSystem: "COLIBRI_220", trackGroup: "TRACK_FIXTURE",
  pointSubtype: "GX53", lampSocket: "GX53", smartOnly: false, query: "",
};

const chandelier = product({ productId: "ch1", name: "Люстра Верона", kind: "CHANDELIER" });
const strip = product({ productId: "st1", name: "Лента 12В", kind: "LED_STRIP" });
const psu = product({ productId: "ps1", name: "Блок питания 100Вт", kind: "PSU" });
const grille = product({ productId: "gr1", name: "Вент.решетка D100", kind: "CEILING_COMPONENT" });
const all = [chandelier, strip, psu, grille];

describe("Разделы каталога", () => {
  /**
   * Регрессия: у «Люстр» и «Подсветки карниза» не было своей ветки отбора,
   * оба раздела проваливались в else и показывали вентиляционные решётки.
   */
  it("«Люстры» показывают люстры, а не решётки", () => {
    const got = productsOfSection(all, { ...base, section: "chandeliers" });
    expect(got.map((p) => p.productId)).toEqual(["ch1"]);
  });

  it("«Подсветка карниза» показывает ленты и блоки питания", () => {
    const got = productsOfSection(all, { ...base, section: "cornice-lighting" });
    expect(got.map((p) => p.productId).sort()).toEqual(["ps1", "st1"]);
  });

  it("«Закладные и решетки» показывают решётки", () => {
    const got = productsOfSection(all, { ...base, section: "mounts-grilles" });
    expect(got.map((p) => p.productId)).toEqual(["gr1"]);
  });

  it("раздел и глобальный поиск согласованы между собой", () => {
    for (const p of [chandelier, strip, psu]) {
      const section = sectionOfProduct(p);
      expect(section).not.toBeNull();
      const inSection = productsOfSection(all, { ...base, section: section! });
      expect(inSection).toContain(p);
    }
  });
});

describe("Поиск и фильтры", () => {
  // PT-017: ранг фото inject-ится, чтобы тест не зависел от реального манифеста
  // превью (в нём сейчас все 547 товаров, и различить порядок было бы нечем).
  const rank = (p: FeedCatalogProduct) => (p.productId === "st1" ? 0 : 2);

  it("подсказывает разделы с совпадениями, кроме активного", () => {
    const matches = searchMatchesBySection(all, "блок питания", "chandeliers");
    expect(matches).toEqual([{ id: "cornice-lighting", label: "Подсветка карниза", count: 1 }]);
  });

  it("молчит на запрос короче двух символов", () => {
    expect(searchMatchesBySection(all, "б", "chandeliers")).toBeNull();
  });

  it("товары с фото идут первыми", () => {
    const got = filterCatalogProducts(all, { ...base, section: "cornice-lighting" }, rank);
    expect(got[0].productId).toBe("st1");
  });

  it("поиск сужает выдачу внутри раздела", () => {
    const got = filterCatalogProducts(all, { ...base, section: "cornice-lighting", query: "лента" }, rank);
    expect(got.map((p) => p.productId)).toEqual(["st1"]);
  });

  /**
   * PT-017 (B-F109) · товар без фото НЕ скрывается.
   *
   * Прямой поиск обязан приводить человека к позиции, даже если снимка нет:
   * это может быть обязательное комплектующее, без которого комплект неполный.
   * Понижение в порядке — да, исчезновение — нет.
   */
  it("товар без фото находится прямым поиском и остаётся в выдаче", () => {
    const found = filterCatalogProducts(
      all,
      { ...base, section: "cornice-lighting", query: "блок питания" },
      rank,
    );
    expect(found.map((p) => p.productId)).toEqual(["ps1"]);
  });

  it("без фото товар опускается ниже, но из раздела не выпадает", () => {
    const got = filterCatalogProducts(all, { ...base, section: "cornice-lighting" }, rank);
    expect(got.map((p) => p.productId)).toEqual(["st1", "ps1"]);
  });

  it("LED-03 · лента 24В/24V и Wi-Fi/WIFI находятся одинаково в подсказке и разделе", () => {
    const items = [
      product({ productId: "led24", name: "Светодиодная лента ПРО 160 24V 22W", kind: "LED_STRIP" }),
      product({ productId: "wb5", name: "Контроллер WIFI TUYA 5в1 WB5 15A", kind: "LED_STRIP" }),
    ];
    for (const query of ["лента 24В", "лента 24 V", "лента 24V"]) {
      expect(filterCatalogProducts(items, { ...base, section: "cornice-lighting", query }).map((p) => p.productId)).toEqual(["led24"]);
      expect(searchMatchesBySection(items, query, "chandeliers")).toEqual([
        { id: "cornice-lighting", label: "Подсветка карниза", count: 1 },
      ]);
    }
    for (const query of ["Wi-Fi", "Wi Fi", "WIFI"]) {
      expect(filterCatalogProducts(items, { ...base, section: "cornice-lighting", query }).map((p) => p.productId)).toEqual(["wb5"]);
    }
    expect(filterCatalogProducts(items, { ...base, section: "cornice-lighting", query: "лента 12В" })).toEqual([]);
  });

  it("LED-03 · точный SKU выигрывает у фото и подстроки, регистр артикула не важен", () => {
    const target = product({ productId: "target", vendorCode: "0У-00006564", name: "Контроллер 5в1", kind: "LED_STRIP" });
    const mention = product({ productId: "mention", vendorCode: "OTHER", name: "Совместимые 0У-00006564", kind: "LED_STRIP" });
    const photoFirst = (p: FeedCatalogProduct) => p.productId === "mention" ? 0 : 2;
    expect(filterCatalogProducts([mention, target], { ...base, section: "cornice-lighting", query: "0у-00006564" }, photoFirst).map((p) => p.productId)).toEqual(["target", "mention"]);
  });
});
