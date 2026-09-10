import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import {
  POINT_KINDS,
  defaultPointKind,
  minPriceOfKind,
  pointsOfKind,
  popularPoints,
} from "../lib/lighting/popular-points";
import { matchesPointSubtype } from "../lib/lighting/product-predicates";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";

/**
 * N-021 · Выбор светильников по типу и кнопка «добавить N популярных».
 * Проверки на реальном фиде: подбор обязан работать на том каталоге,
 * который отдаётся клиенту, а не на выдуманном.
 */
const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;

describe("N-021 · типы светильников", () => {
  it("все три типа что-то предлагают на реальном фиде", () => {
    for (const spec of POINT_KINDS) {
      expect(pointsOfKind(products, spec.id).length, spec.title).toBeGreaterThan(0);
    }
  });

  it("предлагаются только доступные товары с ценой", () => {
    for (const spec of POINT_KINDS) {
      for (const product of pointsOfKind(products, spec.id)) {
        expect(product.available).toBe(true);
        expect(product.priceRub).toBeGreaterThan(0);
      }
    }
  });

  it("список отсортирован от дешёвых к дорогим", () => {
    const prices = pointsOfKind(products, "recessed").map((p) => p.priceRub);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("«от» на карточке совпадает с первым товаром списка", () => {
    for (const spec of POINT_KINDS) {
      expect(minPriceOfKind(products, spec.id)).toBe(pointsOfKind(products, spec.id)[0].priceRub);
    }
  });

  it("поворотные объединяют MR16 и GU10 — клиенту важен вид, а не цоколь", () => {
    const swivel = pointsOfKind(products, "swivel");
    const hasMr16 = swivel.some((p) => matchesPointSubtype(p, "MR16"));
    const hasGu10 = swivel.some((p) => matchesPointSubtype(p, "GU10"));
    expect(hasMr16 && hasGu10).toBe(true);
  });

  it("типы не пересекаются: товар не попадает в две группы сразу", () => {
    const seen = new Map<string, string>();
    for (const spec of POINT_KINDS) {
      for (const product of pointsOfKind(products, spec.id)) {
        const previous = seen.get(product.productId);
        expect(previous, `${product.name}: ${previous} и ${spec.id}`).toBeUndefined();
        seen.set(product.productId, spec.id);
      }
    }
  });
});

describe("N-021 · popularPoints", () => {
  it("возвращает 6 штук одного SKU по минимальной цене", () => {
    const result = popularPoints(products, 6, "recessed");
    expect(result).not.toBeNull();
    expect(result!.qty).toBe(6);
    expect(result!.product.available).toBe(true);
    expect(result!.product.priceRub).toBe(minPriceOfKind(products, "recessed"));
  });

  it("сумма — цена × количество", () => {
    const result = popularPoints(products, 6, "recessed")!;
    expect(result.totalRub).toBe(result.product.priceRub * 6);
  });

  it("берёт один SKU на всё количество, а не набор разных моделей", () => {
    // Шесть разных светильников в одной комнате — технически валидно и
    // практически бессмысленно; человек ждёт одинаковые.
    const result = popularPoints(products, 6, "swivel")!;
    expect(result.product.productId).toBeTruthy();
    expect(result.qty).toBe(6);
  });

  it("нулевая и отрицательная потребность ничего не предлагает", () => {
    expect(popularPoints(products, 0, "recessed")).toBeNull();
    expect(popularPoints(products, -3, "recessed")).toBeNull();
  });

  it("дробное количество округляется до штук", () => {
    expect(popularPoints(products, 5.4, "recessed")!.qty).toBe(5);
  });

  it("пустой каталог не ломает подбор", () => {
    expect(popularPoints([], 6, "recessed")).toBeNull();
    expect(minPriceOfKind([], "recessed")).toBeNull();
    expect(defaultPointKind([])).toBeNull();
  });
});

describe("N-021 · тип по умолчанию", () => {
  it("предлагается самый дешёвый из доступных типов", () => {
    const kind = defaultPointKind(products);
    expect(kind).not.toBeNull();

    const chosen = minPriceOfKind(products, kind!)!;
    for (const spec of POINT_KINDS) {
      const price = minPriceOfKind(products, spec.id);
      if (price !== null) expect(chosen).toBeLessThanOrEqual(price);
    }
  });
});
