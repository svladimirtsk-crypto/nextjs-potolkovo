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
  const hasPhoto = (p: FeedCatalogProduct) => p.productId === "st1";

  it("подсказывает разделы с совпадениями, кроме активного", () => {
    const matches = searchMatchesBySection(all, "блок питания", "chandeliers");
    expect(matches).toEqual([{ id: "cornice-lighting", label: "Подсветка карниза", count: 1 }]);
  });

  it("молчит на запрос короче двух символов", () => {
    expect(searchMatchesBySection(all, "б", "chandeliers")).toBeNull();
  });

  it("товары с фото идут первыми", () => {
    const got = filterCatalogProducts(all, { ...base, section: "cornice-lighting" }, hasPhoto);
    expect(got[0].productId).toBe("st1");
  });

  it("поиск сужает выдачу внутри раздела", () => {
    const got = filterCatalogProducts(all, { ...base, section: "cornice-lighting", query: "лента" }, hasPhoto);
    expect(got.map((p) => p.productId)).toEqual(["st1"]);
  });
});
