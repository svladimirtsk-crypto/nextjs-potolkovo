import { describe, expect, it } from "vitest";

import { decideOrphanTrackAction } from "../lib/lighting/orphan-track";
import { clearAllTrackProducts } from "../lib/lighting/kit-rules";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";

/**
 * N-051 · Автоочистка трековых позиций съедала то, что клиент добавлял руками:
 * «+» на трековом светильнике не работал и никто не объяснял почему. Тесты
 * фиксируют границу между «трек выключили» и «клиент кладёт осознанно».
 */

const base = {
  requiredTrackMeters: 0,
  previousRequiredTrackMeters: 0,
  orphanCount: 1,
  isLightingFirst: false,
};

describe("N-051 · судьба трековых позиций без трека", () => {
  it("пустая корзина — делать нечего", () => {
    expect(decideOrphanTrackAction({ ...base, orphanCount: 0 })).toBe("none");
  });

  it("трек заказан — позиции законны", () => {
    expect(
      decideOrphanTrackAction({ ...base, requiredTrackMeters: 5, previousRequiredTrackMeters: 5 })
    ).toBe("none");
  });

  it("трек только что выключили — остатки убираем", () => {
    expect(decideOrphanTrackAction({ ...base, previousRequiredTrackMeters: 6 })).toBe("drop");
  });

  it("трека не было и нет: клиент добавил сам — не трогаем, объясняем", () => {
    // Главный регресс: раньше здесь было молчаливое удаление.
    expect(decideOrphanTrackAction(base)).toBe("warn");
  });

  it("вход «сначала свет» — набор из каталога не трогаем даже после выключения трека", () => {
    expect(
      decideOrphanTrackAction({
        ...base,
        isLightingFirst: true,
        previousRequiredTrackMeters: 6,
      })
    ).toBe("warn");
  });

  it("вход «сначала свет» без истории трека — тоже предупреждение", () => {
    expect(decideOrphanTrackAction({ ...base, isLightingFirst: true })).toBe("warn");
  });

  it("после автоудаления решение становится «нечего делать»", () => {
    // drop обнуляет корзину — следующий проход не должен зациклиться.
    const afterDrop = decideOrphanTrackAction({
      ...base,
      previousRequiredTrackMeters: 6,
      orphanCount: 0,
    });
    expect(afterDrop).toBe("none");
  });

  it("возврат трека делает позиции снова законными", () => {
    expect(
      decideOrphanTrackAction({ ...base, requiredTrackMeters: 4, previousRequiredTrackMeters: 0 })
    ).toBe("none");
  });
});

describe("N-051 · clearAllTrackProducts", () => {
  const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
    ({
      productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
      categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
      available: true, params: [], keyAttributes: [], system: "COLIBRI_220",
      kind: "OTHER", unit: "pcs", lengthMeters: null, pieceLengthMeters: null,
      ...over,
    }) as FeedCatalogProduct;

  const catalog = new Map<string, FeedCatalogProduct>([
    ["profile", product({ productId: "profile", kind: "TRACK_PROFILE" })],
    ["fixture", product({ productId: "fixture", kind: "TRACK_FIXTURE" })],
    ["accessory", product({ productId: "accessory", kind: "TRACK_ACCESSORY" })],
    ["psu", product({ productId: "psu", kind: "PSU", vendorCode: "ЦБ-00008490", system: "CLARUS_48" })],
    ["lamp", product({ productId: "lamp", kind: "LAMP", system: "UNKNOWN" })],
    ["spot", product({ productId: "spot", kind: "SPOT_FIXTURE", system: "UNKNOWN" })],
  ]);
  const resolve = (id: string) => catalog.get(id);

  it("убирает профиль, светильники трека и аксессуары", () => {
    const next = clearAllTrackProducts(
      { profile: 2, fixture: 3, accessory: 1, lamp: 4 },
      resolve
    );
    expect(Object.keys(next)).toEqual(["lamp"]);
  });

  it("не трогает то, что живёт без трека", () => {
    // Точечные светильники и лампы остаются: человек отказался от трека,
    // а не от света вообще.
    const cart = { lamp: 4, spot: 6 };
    expect(clearAllTrackProducts(cart, resolve)).toEqual(cart);
  });

  it("возвращает прежний объект, когда удалять нечего", () => {
    // По этому признаку вызывающий решает, обновлять ли состояние.
    const cart = { lamp: 1 };
    expect(clearAllTrackProducts(cart, resolve)).toBe(cart);
  });

  it("неизвестные позиции сохраняются — чужое не выбрасываем", () => {
    const next = clearAllTrackProducts({ profile: 1, "нет-в-каталоге": 2 }, resolve);
    expect(next).toEqual({ "нет-в-каталоге": 2 });
  });
});
