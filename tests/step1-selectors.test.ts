import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import {
  POINT_SUBTYPES,
  POINT_TO_MOUNT_VENDOR_CODE,
  TRACK_SYSTEMS,
  type TrackSystemId,
} from "../lib/catalog-ui-config";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";
import type { CartEntry } from "../lib/lighting/cart-derived";
import { detectSocket } from "../lib/feed2-products";
import { toText } from "../lib/feed2-snapshot-normalize";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
} from "../lib/lighting-formulas";
import { pointsOfKind } from "../lib/lighting/popular-points";
import {
  allowedTrackProfileVendors,
  buildClarusPsuOptions,
  buildSelectedViewItems,
  buildTrackProfileRecommendations,
  calcMountRequiredByVendor,
  calcSelectedTotals,
  cardDiscountPercentFor,
  detectCartTrackSystem,
  scopeCatalogProducts,
  selectChandeliers,
  selectCorniceLighting,
  selectPointProducts,
  selectTrackFixtures,
  selectTrackProfilesOfSystem,
  selectWizardTrackProfiles,
  summarizeCartForStep,
  systemLabelOf,
  systemsForMountType,
  wizardSystemOptionsFor,
} from "../lib/lighting/step1-selectors";

/**
 * PT-018 (B-F104) · чистые селекторы Шага 1.
 *
 * До переноса эти правила жили в `useMemo` внутри компонента на 1395 строк и
 * проверялись только E2E. Здесь они зафиксированы на реальном фиде: тесты
 * ловят и «сломали выдачу», и «случайно изменили правило при переносе».
 */

const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;
const byId = new Map(products.map((p) => [toText(p.productId), p]));
const byVendor = new Map(products.map((p) => [toText(p.vendorCode), toText(p.productId)]));

const find = (predicate: (p: FeedCatalogProduct) => boolean) => {
  const found = products.find(predicate);
  if (!found) throw new Error("в фиде нет подходящего товара для теста");
  return found;
};

const entry = (product: FeedCatalogProduct, qty: number): CartEntry => ({
  productId: toText(product.productId),
  product,
  qty,
});

/** Самый дешёвый профиль COLIBRI в фиде: 3 700 ₽, кусок 1 м. */
const colibriCheapest = find(
  (p) => p.kind === "TRACK_PROFILE" && p.system === "COLIBRI_220" && p.vendorCode === "0У-00006089"
);
/** Единственный профиль ART в фиде: 1 770 ₽, кусок 2 м. */
const artProfile = find((p) => p.kind === "TRACK_PROFILE" && p.system === "TRACK_220");
const clarusFixture = find((p) => p.kind === "TRACK_FIXTURE" && p.system === "CLARUS_48");
const clarusAccessory = find(
  (p) => p.kind === "TRACK_ACCESSORY" && p.system === "CLARUS_48"
);

describe("PT-018 · метки систем", () => {
  it("совпадают со справочником TRACK_SYSTEMS", () => {
    for (const { id, label } of TRACK_SYSTEMS) expect(systemLabelOf(id)).toBe(label);
  });

  it("неизвестный id возвращается как есть, а не падает", () => {
    expect(systemLabelOf("НЕТ-ТАКОЙ" as TrackSystemId)).toBe("НЕТ-ТАКОЙ");
  });
});

describe("PT-018 · белый список профилей", () => {
  it("ART дополняется вторым списком артикулов", () => {
    expect(allowedTrackProfileVendors("TRACK_220").has("0У-00001354")).toBe(true);
    expect(allowedTrackProfileVendors("TRACK_220").size).toBe(7);
  });

  it("COLIBRI и CLARUS второго списка не получают", () => {
    expect(allowedTrackProfileVendors("COLIBRI_220").size).toBe(4);
    expect(allowedTrackProfileVendors("COLIBRI_220").has("0У-00001354")).toBe(false);
    expect(allowedTrackProfileVendors("CLARUS_48").size).toBe(2);
  });

  it("в выдачу попадают только профили белого списка с ценой", () => {
    const colibri = selectTrackProfilesOfSystem(products, "COLIBRI_220");
    expect(colibri).toHaveLength(3);
    for (const p of colibri) {
      expect(p.kind).toBe("TRACK_PROFILE");
      expect(p.system).toBe("COLIBRI_220");
      expect(p.priceRub).toBeGreaterThan(0);
    }

    const outside = [...colibri, { ...colibriCheapest, vendorCode: "НЕТ-В-СПИСКЕ" }, { ...colibriCheapest, priceRub: 0 }];
    expect(selectTrackProfilesOfSystem(outside, "COLIBRI_220")).toHaveLength(3);
  });
});

describe("PT-018 · какие системы предлагать", () => {
  it("без метража трека систем не предлагаем", () => {
    expect(wizardSystemOptionsFor({ requiredTrackMeters: 0, trackMountType: "built-in" })).toEqual([]);
  });

  it("способ монтажа сужает набор систем", () => {
    expect(systemsForMountType("built-in")).toEqual(["COLIBRI_220", "CLARUS_48"]);
    expect(systemsForMountType("surface")).toEqual(["TRACK_220"]);
    expect(systemsForMountType("none")).toEqual(["COLIBRI_220", "CLARUS_48", "TRACK_220"]);
    expect(wizardSystemOptionsFor({ requiredTrackMeters: 4, trackMountType: "surface" })).toEqual(["TRACK_220"]);
  });
});

describe("PT-018 · предложение «профиль под метраж»", () => {
  it("без потолка и без метража предложение пустое", () => {
    expect(
      buildTrackProfileRecommendations({ showCeiling: false, requiredTrackMeters: 5, trackMountType: "built-in", products })
    ).toEqual([]);
    expect(
      buildTrackProfileRecommendations({ showCeiling: true, requiredTrackMeters: 0, trackMountType: "built-in", products })
    ).toEqual([]);
  });

  it("монтаж «не выбран» ничего не предлагает — сначала отвечаем на вопрос Шага 0", () => {
    expect(
      buildTrackProfileRecommendations({ showCeiling: true, requiredTrackMeters: 5, trackMountType: "none", products })
    ).toEqual([]);
  });

  it("берёт самый дешёвый профиль системы и считает куски с округлением вверх", () => {
    const recs = buildTrackProfileRecommendations({
      showCeiling: true,
      requiredTrackMeters: 5,
      trackMountType: "built-in",
      products,
    });

    expect(recs.map((r) => r.system)).toEqual(["COLIBRI_220", "CLARUS_48"]);
    const colibri = recs[0];
    expect(toText(colibri.product.vendorCode)).toBe(toText(colibriCheapest.vendorCode));
    expect(colibri.qty).toBe(5); // кусок 1 м → 5 кусков ровно
    expect(colibri.totalMeters).toBe(5);
  });

  it("накладной монтаж предлагает ART и округляет 5 м до трёх кусков по 2 м", () => {
    const recs = buildTrackProfileRecommendations({
      showCeiling: true,
      requiredTrackMeters: 5,
      trackMountType: "surface",
      products,
    });

    expect(recs).toHaveLength(1);
    expect(recs[0].system).toBe("TRACK_220");
    expect(toText(recs[0].product.vendorCode)).toBe(toText(artProfile.vendorCode));
    expect(recs[0].qty).toBe(3);
    expect(recs[0].totalMeters).toBe(6);
  });
});

describe("PT-018 · экран «Трековый профиль»", () => {
  it("выбранная система важнее рекомендаций", () => {
    const list = selectWizardTrackProfiles({
      products,
      selectedSystem: "CLARUS_48",
      recommendedSystems: ["COLIBRI_220"],
      trackMountType: "built-in",
    });

    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.system === "CLARUS_48")).toBe(true);
  });

  it("без выбора и без рекомендаций набор следует за способом монтажа", () => {
    const list = selectWizardTrackProfiles({
      products,
      selectedSystem: null,
      recommendedSystems: [],
      trackMountType: "surface",
    });

    expect(list).toHaveLength(1);
    expect(list[0].system).toBe("TRACK_220");
  });

  it("системы не перемешиваются: сначала по названию системы, затем по цене", () => {
    const list = selectWizardTrackProfiles({
      products,
      selectedSystem: null,
      recommendedSystems: ["CLARUS_48", "COLIBRI_220"],
      trackMountType: "built-in",
    });

    const labels = list.map((p) => systemLabelOf(p.system as TrackSystemId));
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "ru"));
    expect(labels).toEqual(sorted);
    expect(labels[0]).toBe("CLARUS 48V");
    expect(list.slice(0, 2).map((p) => p.priceRub)).toEqual([4000, 8000]);
  });
});

describe("PT-018 · светильники, люстры, подсветка карниза", () => {
  it("без выбранной системы светильники не показываем", () => {
    expect(selectTrackFixtures(products, null)).toEqual([]);
  });

  it("светильники системы отсортированы по цене", () => {
    const fixtures = selectTrackFixtures(products, "CLARUS_48");
    expect(fixtures.length).toBeGreaterThan(1);
    const prices = fixtures.map((p) => p.priceRub);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(fixtures.every((p) => p.kind === "TRACK_FIXTURE" && p.system === "CLARUS_48")).toBe(true);
  });

  it("люстры и подсветка карниза — свои наборы товаров", () => {
    const chandeliers = selectChandeliers(products);
    expect(chandeliers.length).toBeGreaterThan(0);
    expect(chandeliers.every((p) => p.kind === "CHANDELIER")).toBe(true);

    const cornice = selectCorniceLighting(products);
    expect(cornice.length).toBeGreaterThan(0);
    for (const p of cornice) {
      expect(["LED_STRIP", "PSU", "CONTROL"]).toContain(p.kind);
    }
  });
});

describe("PT-018 · точечные светильники (N-021)", () => {
  it("по умолчанию сетка следует за выбранным типом точки", () => {
    for (const kind of ["recessed", "swivel", "panel"] as const) {
      const auto = selectPointProducts({
        products,
        manualOpen: false,
        socketTab: POINT_SUBTYPES[0].id,
        pointKind: kind,
      });
      expect(auto).toEqual(pointsOfKind(products, kind));
    }
  });

  it("ручной выбор цоколя сужает выдачу и сортирует по цене", () => {
    const manual = selectPointProducts({
      products,
      manualOpen: true,
      socketTab: "MR16",
      pointKind: "recessed",
    });

    expect(manual.length).toBeGreaterThan(0);
    const prices = manual.map((p) => p.priceRub);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(manual.every((p) => p.priceRub > 0)).toBe(true);
  });
});

describe("PT-018 · система трека из корзины", () => {
  it("профиль и светильник дают систему", () => {
    expect(detectCartTrackSystem([entry(artProfile, 1)])).toBe("TRACK_220");
    expect(detectCartTrackSystem([entry(clarusFixture, 2)])).toBe("CLARUS_48");
  });

  it("аксессуар учитывается только с явным флагом", () => {
    const cart = [entry(clarusAccessory, 1)];
    expect(detectCartTrackSystem(cart)).toBeNull();
    expect(detectCartTrackSystem(cart, { withAccessory: true })).toBe("CLARUS_48");
  });

  it("корзина без трека систему не выдумывает", () => {
    expect(detectCartTrackSystem([entry(find((p) => p.kind === "CHANDELIER"), 1)])).toBeNull();
    expect(detectCartTrackSystem([])).toBeNull();
  });
});

describe("PT-018 · закладные и БП", () => {
  it("закладные считаются по артикулам точек в корзине", () => {
    const point = find((p) => POINT_TO_MOUNT_VENDOR_CODE[toText(p.vendorCode)] !== undefined);
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(point.vendorCode)];

    expect(calcMountRequiredByVendor([entry(point, 3)])).toEqual({ [mountVendor]: 3 });
    expect(calcMountRequiredByVendor([entry(point, 2), entry(point, 1)])).toEqual({ [mountVendor]: 3 });
    expect(calcMountRequiredByVendor([entry(clarusFixture, 5)])).toEqual({});
  });

  it("БП CLARUS предлагается, пока блока нет в корзине", () => {
    const options = buildClarusPsuOptions({
      hasClarusInCart: true,
      clarusPsuQty: 0,
      productIdByVendorCode: byVendor,
      productsById: byId,
    });

    expect(options).toHaveLength(2);
    expect(options.every((o) => o.productId.length > 0 && o.name.length > 0)).toBe(true);
  });

  it("блок уже выбран или CLARUS нет — вариантов нет", () => {
    expect(
      buildClarusPsuOptions({ hasClarusInCart: true, clarusPsuQty: 1, productIdByVendorCode: byVendor, productsById: byId })
    ).toEqual([]);
    expect(
      buildClarusPsuOptions({ hasClarusInCart: false, clarusPsuQty: 0, productIdByVendorCode: byVendor, productsById: byId })
    ).toEqual([]);
  });

  it("несуществующий артикул БП пропускается, а не роняет список", () => {
    expect(
      buildClarusPsuOptions({
        hasClarusInCart: true,
        clarusPsuQty: 0,
        productIdByVendorCode: new Map([["0У-00002310", byVendor.get("0У-00002310")!]]),
        productsById: byId,
      })
    ).toHaveLength(1);
  });
});

describe("PT-018 · сводка корзины для стартового экрана", () => {
  it("пустая корзина помечена пустой", () => {
    expect(summarizeCartForStep([], 0)).toEqual({
      hasTrackProfile: false,
      hasTrackFixture: false,
      hasPoints: false,
      hasMissingLamps: false,
      isEmpty: true,
    });
  });

  it("наборы корзины отражаются в флагах", () => {
    const point = find((p) => p.kind === "SPOT_FIXTURE");
    const summary = summarizeCartForStep(
      [entry(artProfile, 2), entry(clarusFixture, 1), entry(point, 4)],
      3
    );

    expect(summary).toEqual({
      hasTrackProfile: true,
      hasTrackFixture: true,
      hasPoints: true,
      hasMissingLamps: true,
      isEmpty: false,
    });
  });
});

describe("PT-018 · вкладка «Выбранное»", () => {
  const items = buildSelectedViewItems([entry(colibriCheapest, 2), entry(clarusFixture, 1)]);

  it("позиции корзины превращаются в строки списка", () => {
    expect(items).toHaveLength(2);
    expect(items[0].item.qty).toBe(2);
    expect(items[0].item.sku).toBe(toText(colibriCheapest.productId));
    expect(items[0].item.priceRub).toBe(3700);
  });

  it("скидка зависит от контекста потолка", () => {
    const only = calcSelectedTotals(items, false);
    const withCeiling = calcSelectedTotals(items, true);

    expect(only.regular).toBe(2 * 3700 + clarusFixture.priceRub);
    expect(only.effective).toBe(only.standalone);
    expect(only.effectivePercent).toBe(LIGHTING_ONLY_DISCOUNT_PERCENT);
    expect(withCeiling.effective).toBe(withCeiling.withCeiling);
    expect(withCeiling.effectivePercent).toBe(LIGHTING_WITH_CEILING_DISCOUNT_PERCENT);
    expect(withCeiling.effective).toBeLessThan(only.effective);
    expect(withCeiling.effectiveBenefit).toBeGreaterThan(only.effectiveBenefit);
  });

  it("процент на карточках совпадает с итогами", () => {
    expect(cardDiscountPercentFor(true)).toBe(LIGHTING_WITH_CEILING_DISCOUNT_PERCENT);
    expect(cardDiscountPercentFor(false)).toBe(LIGHTING_ONLY_DISCOUNT_PERCENT);
    expect(calcSelectedTotals([], true).effectivePercent).toBe(LIGHTING_WITH_CEILING_DISCOUNT_PERCENT);
  });

  it("пустая корзина даёт нули без NaN", () => {
    expect(calcSelectedTotals([], false)).toEqual({
      regular: 0,
      standalone: 0,
      withCeiling: 0,
      effective: 0,
      effectivePercent: LIGHTING_ONLY_DISCOUNT_PERCENT,
      effectiveBenefit: 0,
      withCeilingBenefit: 0,
    });
  });
});

describe("PT-018 · выдача каталога внутри мастера", () => {
  const base = {
    products,
    selectedMode: false,
    selectedProducts: [] as FeedCatalogProduct[],
    section: "track-systems" as const,
    trackSystem: "TRACK_220" as TrackSystemId,
    trackGroup: "TRACK_PROFILE" as const,
    pointSubtype: POINT_SUBTYPES[0].id,
    lampSocket: "GX53" as const,
    query: "",
  };

  it("режим «Выбранное» показывает позиции корзины, а не каталог", () => {
    const scoped = scopeCatalogProducts({
      ...base,
      selectedMode: true,
      selectedProducts: [colibriCheapest, clarusFixture],
    });
    expect(scoped).toEqual([colibriCheapest, clarusFixture]);
  });

  it("профили на вкладке каталога не фильтруются по цене (правило экрана мастера — другое)", () => {
    const withZeroPrice = [...products, { ...artProfile, priceRub: 0 }];
    const scoped = scopeCatalogProducts({ ...base, products: withZeroPrice });

    expect(scoped).toHaveLength(2);
    expect(scoped.some((p) => p.priceRub === 0)).toBe(true);
    expect(selectTrackProfilesOfSystem(withZeroPrice, "TRACK_220")).toHaveLength(1);
  });

  it("группа аксессуаров отдаёт товары своей системы", () => {
    const scoped = scopeCatalogProducts({ ...base, trackGroup: "TRACK_ACCESSORY", trackSystem: "CLARUS_48" });
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((p) => p.kind === "TRACK_ACCESSORY" && p.system === "CLARUS_48")).toBe(true);
  });

  it("лампы отбираются по цоколю", () => {
    const gx53 = scopeCatalogProducts({ ...base, section: "lamps", lampSocket: "GX53" });
    expect(gx53.length).toBeGreaterThan(0);
    expect(gx53.every((p) => detectSocket(p) === "GX53")).toBe(true);

    const gu10 = scopeCatalogProducts({ ...base, section: "lamps", lampSocket: "GU10" });
    expect(gu10.length).toBeLessThan(gx53.length);
    expect(gu10.length).toBeGreaterThan(0);
  });

  it("поиск ищет и по атрибутам карточки", () => {
    const target = find((p) => p.kind === "CHANDELIER" && (p.keyAttributes?.length ?? p.params?.length ?? 0) > 0);
    const attr = (target.keyAttributes?.length ? target.keyAttributes : target.params)![0];
    const query = toText(attr.value).toLowerCase();
    if (query.length < 3) throw new Error("в фиде нет атрибута длиннее двух символов");

    const scoped = scopeCatalogProducts({ ...base, section: "chandeliers", query });
    expect(scoped.map((p) => toText(p.productId))).toContain(toText(target.productId));
  });

  it("пустой запрос не сужает выдачу раздела", () => {
    const all = scopeCatalogProducts({ ...base, section: "chandeliers", query: "" });
    expect(all).toEqual(selectChandeliers(products));
  });

  it("раздел закладных не пропускает трековые товары", () => {
    const scoped = scopeCatalogProducts({ ...base, section: "mounts-grilles" });
    expect(scoped.every((p) => p.kind !== "TRACK_PROFILE")).toBe(true);
  });
});
