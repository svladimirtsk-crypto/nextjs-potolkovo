import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import { POINT_TO_MOUNT_VENDOR_CODE } from "../lib/catalog-ui-config";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";
import { toText } from "../lib/feed2-snapshot-normalize";
import { groupLampOptionsBySocket, type CartEntry } from "../lib/lighting/cart-derived";
import {
  applyClarusPsu,
  applyProductQty,
  applyTrackProfileQty,
  cheapestLampsAddition,
  describeCartChange,
  dropOrphanTrackItems,
  mountOneToOneTarget,
  trackSystemOfProduct,
} from "../lib/lighting/step1-cart-rules";
import type { Cart } from "../lib/lighting/kit-rules";

/**
 * PT-018 (B-F104) · правила изменения корзины Шага 1.
 *
 * Это денежный путь: количество товара, выбор системы профилем, закладные,
 * лампы и блок питания CLARUS. До переноса правила жили в замыканиях
 * `useCallback` и проверялись только кликами в браузере. Тесты на реальном
   фиде фиксируют и совместимость систем, и «пустой клик корзину не меняет».
 */

const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;
const byId = new Map(products.map((p) => [toText(p.productId), p]));
const byVendor = new Map(products.map((p) => [toText(p.vendorCode), toText(p.productId)]));
const resolve = (id: string) => byId.get(id);
const idOf = (p: FeedCatalogProduct) => toText(p.productId);

const find = (predicate: (p: FeedCatalogProduct) => boolean) => {
  const found = products.find(predicate);
  if (!found) throw new Error("в фиде нет подходящего товара для теста");
  return found;
};

const colibriFixture = find((p) => p.kind === "TRACK_FIXTURE" && p.system === "COLIBRI_220");
const clarusFixture = find((p) => p.kind === "TRACK_FIXTURE" && p.system === "CLARUS_48");
const colibriProfile = find((p) => p.kind === "TRACK_PROFILE" && p.system === "COLIBRI_220");
const chandelier = find((p) => p.kind === "CHANDELIER");
const clarusPsu = find((p) => toText(p.vendorCode) === "0У-00002310");
const otherClarusPsu = find((p) => toText(p.vendorCode) === "0У-00002308");
const pointWithMount = find((p) => POINT_TO_MOUNT_VENDOR_CODE[toText(p.vendorCode)] !== undefined);
const lampOptionsBySocket = groupLampOptionsBySocket(products);

const entry = (product: FeedCatalogProduct, qty: number): CartEntry => ({
  productId: idOf(product),
  product,
  qty,
});

describe("PT-018 · система товара", () => {
  it("трековая система распознаётся, прочее — нет", () => {
    expect(trackSystemOfProduct(colibriFixture)).toBe("COLIBRI_220");
    expect(trackSystemOfProduct(clarusPsu)).toBe("CLARUS_48");
    expect(trackSystemOfProduct(chandelier)).toBeNull();
    expect(
      trackSystemOfProduct({ ...colibriFixture, system: "НЕТ-ТАКОЙ" as FeedCatalogProduct["system"] })
    ).toBeNull();
  });
});

describe("PT-018 · количество товара", () => {
  it("ноль снимает позицию, а не оставляет её с нулём", () => {
    const cart: Cart = { [idOf(colibriFixture)]: 2 };
    expect(applyProductQty(cart, { product: colibriFixture, nextQty: 0, resolveProduct: resolve })).toEqual({});
  });

  it("чужая система вычищается при добавлении своей", () => {
    const cart: Cart = { [idOf(clarusFixture)]: 3, [idOf(chandelier)]: 1 };

    const next = applyProductQty(cart, { product: colibriFixture, nextQty: 2, resolveProduct: resolve });

    expect(next[idOf(colibriFixture)]).toBe(2);
    expect(next[idOf(clarusFixture)]).toBeUndefined();
    // Люстра к системе не привязана — остаётся.
    expect(next[idOf(chandelier)]).toBe(1);
  });

  it("своя система не вычищает саму себя", () => {
    const cart: Cart = { [idOf(colibriProfile)]: 4 };
    const next = applyProductQty(cart, { product: colibriFixture, nextQty: 1, resolveProduct: resolve });

    expect(next[idOf(colibriProfile)]).toBe(4);
    expect(next[idOf(colibriFixture)]).toBe(1);
  });

  it("блок питания CLARUS тянет за собой систему CLARUS", () => {
    const cart: Cart = { [idOf(colibriFixture)]: 2 };
    const next = applyProductQty(cart, { product: clarusPsu, nextQty: 1, resolveProduct: resolve });

    expect(next[idOf(clarusPsu)]).toBe(1);
    expect(next[idOf(colibriFixture)]).toBeUndefined();
  });

  it("товар без системы ничего не вычищает", () => {
    const cart: Cart = { [idOf(colibriFixture)]: 2, [idOf(clarusFixture)]: 1 };
    const next = applyProductQty(cart, { product: chandelier, nextQty: 1, resolveProduct: resolve });

    expect(next).toEqual({ [idOf(colibriFixture)]: 2, [idOf(clarusFixture)]: 1, [idOf(chandelier)]: 1 });
  });

  it("исходная корзина не мутируется", () => {
    const cart: Cart = { [idOf(chandelier)]: 1 };
    applyProductQty(cart, { product: colibriFixture, nextQty: 2, resolveProduct: resolve });
    expect(cart).toEqual({ [idOf(chandelier)]: 1 });
  });
});

describe("PT-018 · количество профиля", () => {
  it("профиль выбирает систему и снимает чужие позиции", () => {
    const cart: Cart = { [idOf(clarusFixture)]: 2, [idOf(chandelier)]: 1 };
    const next = applyTrackProfileQty(cart, { product: colibriProfile, nextQty: 3, resolveProduct: resolve });

    expect(next[idOf(colibriProfile)]).toBe(3);
    expect(next[idOf(clarusFixture)]).toBeUndefined();
    expect(next[idOf(chandelier)]).toBe(1);
  });

  it("ноль снимает профиль", () => {
    const cart: Cart = { [idOf(colibriProfile)]: 3 };
    expect(
      applyTrackProfileQty(cart, { product: colibriProfile, nextQty: 0, resolveProduct: resolve })
    ).toEqual({});
  });

  it("товар без системы корзину не меняет вовсе", () => {
    const cart: Cart = { [idOf(chandelier)]: 1 };
    const next = applyTrackProfileQty(cart, { product: chandelier, nextQty: 5, resolveProduct: resolve });
    expect(next).toBe(cart);
  });
});

describe("PT-018 · закладные один к одному", () => {
  const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(pointWithMount.vendorCode)];
  const mountId = byVendor.get(mountVendor)!;

  it("сколько точек — столько закладных", () => {
    expect(
      mountOneToOneTarget({
        fixtureVendorCode: toText(pointWithMount.vendorCode),
        mountRequiredByVendor: { [mountVendor]: 4 },
        productIdByVendorCode: byVendor,
      })
    ).toEqual({ productId: mountId, qty: 4 });
  });

  it("нет потребности — добавлять нечего", () => {
    expect(
      mountOneToOneTarget({
        fixtureVendorCode: toText(pointWithMount.vendorCode),
        mountRequiredByVendor: { [mountVendor]: 0 },
        productIdByVendorCode: byVendor,
      })
    ).toBeNull();
  });

  it("у точки нет закладной в справочнике — нечего", () => {
    expect(
      mountOneToOneTarget({
        fixtureVendorCode: toText(chandelier.vendorCode),
        mountRequiredByVendor: { [mountVendor]: 4 },
        productIdByVendorCode: byVendor,
      })
    ).toBeNull();
  });

  it("закладной нет в каталоге — нечего, а не «добавить неизвестно что»", () => {
    expect(
      mountOneToOneTarget({
        fixtureVendorCode: toText(pointWithMount.vendorCode),
        mountRequiredByVendor: { [mountVendor]: 4 },
        productIdByVendorCode: new Map(),
      })
    ).toBeNull();
  });
});

describe("PT-018 · добор ламп", () => {
  const cheapest = lampOptionsBySocket.GX53[0];

  it("докладывается ровно недостача самым дешёвым вариантом", () => {
    expect(
      cheapestLampsAddition({
        socket: "GX53",
        lampRequiredBySocket: { GX53: 6 },
        lampCurrentBySocket: { GX53: 2 },
        lampOptionsBySocket,
      })
    ).toEqual({ productId: idOf(cheapest), qty: 4 });
  });

  it("цоколь закрыт или лампы не нужны — ничего", () => {
    expect(
      cheapestLampsAddition({
        socket: "GX53",
        lampRequiredBySocket: { GX53: 6 },
        lampCurrentBySocket: { GX53: 6 },
        lampOptionsBySocket,
      })
    ).toBeNull();
    expect(
      cheapestLampsAddition({
        socket: "GX53",
        lampRequiredBySocket: { GX53: 0 },
        lampCurrentBySocket: { GX53: 0 },
        lampOptionsBySocket,
      })
    ).toBeNull();
  });

  it("перебор не превращается в отрицательное количество", () => {
    expect(
      cheapestLampsAddition({
        socket: "MR16",
        lampRequiredBySocket: { MR16: 2 },
        lampCurrentBySocket: { MR16: 5 },
        lampOptionsBySocket,
      })
    ).toBeNull();
  });

  it("в каталоге нет ламп цоколя — ничего", () => {
    expect(
      cheapestLampsAddition({
        socket: "GU10",
        lampRequiredBySocket: { GU10: 3 },
        lampCurrentBySocket: { GU10: 0 },
        lampOptionsBySocket: { GU10: [] },
      })
    ).toBeNull();
  });
});

describe("PT-018 · блок питания CLARUS", () => {
  it("остаётся ровно один блок", () => {
    const cart: Cart = { [idOf(otherClarusPsu)]: 1, [idOf(clarusFixture)]: 2 };
    const next = applyClarusPsu(cart, { productId: idOf(clarusPsu), productIdByVendorCode: byVendor });

    expect(next[idOf(clarusPsu)]).toBe(1);
    expect(next[idOf(otherClarusPsu)]).toBeUndefined();
    expect(next[idOf(clarusFixture)]).toBe(2);
  });

  it("количество блока не меньше одного", () => {
    const next = applyClarusPsu({ [idOf(clarusPsu)]: 0 }, {
      productId: idOf(clarusPsu),
      productIdByVendorCode: byVendor,
    });
    expect(next[idOf(clarusPsu)]).toBe(1);
  });

  it("уже выбранное количество сохраняется", () => {
    const next = applyClarusPsu({ [idOf(clarusPsu)]: 2 }, {
      productId: idOf(clarusPsu),
      productIdByVendorCode: byVendor,
    });
    expect(next[idOf(clarusPsu)]).toBe(2);
  });
});

describe("PT-018 · снятие осиротевшего трека (T-024)", () => {
  it("снимает перечисленные позиции", () => {
    const cart: Cart = { [idOf(colibriProfile)]: 2, [idOf(chandelier)]: 1 };
    const next = dropOrphanTrackItems(cart, [entry(colibriProfile, 2)]);

    expect(next).toEqual({ [idOf(chandelier)]: 1 });
  });

  it("пустой список возвращает тот же объект — корзина «не изменилась»", () => {
    const cart: Cart = { [idOf(chandelier)]: 1 };
    expect(dropOrphanTrackItems(cart, [])).toBe(cart);
  });

  it("чужих позиций не снимает", () => {
    const cart: Cart = { [idOf(chandelier)]: 1 };
    expect(dropOrphanTrackItems(cart, [entry(colibriProfile, 2)])).toBe(cart);
  });
});

describe("PT-018 · событие аналитики о корзине", () => {
  const base = { product: colibriFixture, source: "calculator" as string | undefined };

  it("добавление, снятие и изменение различаются", () => {
    expect(describeCartChange({ ...base, prevQty: 0, nextQty: 2 })?.action).toBe("add");
    expect(describeCartChange({ ...base, prevQty: 2, nextQty: 0 })?.action).toBe("remove");
    expect(describeCartChange({ ...base, prevQty: 2, nextQty: 3 })?.action).toBe("change");
  });

  it("количество не изменилось — события нет", () => {
    expect(describeCartChange({ ...base, prevQty: 2, nextQty: 2 })).toBeNull();
    expect(describeCartChange({ ...base, prevQty: 0, nextQty: 0 })).toBeNull();
  });

  it("событие несёт sku, вид товара и источник", () => {
    expect(describeCartChange({ ...base, prevQty: 0, nextQty: 1 })).toEqual({
      action: "add",
      sku: idOf(colibriFixture),
      productKind: String(colibriFixture.kind),
      qty: 1,
      source: "calculator",
    });
  });

  it("неизвестный источник не становится undefined", () => {
    expect(describeCartChange({ product: colibriFixture, prevQty: 0, nextQty: 1 })?.source).toBe("unknown");
  });
});
