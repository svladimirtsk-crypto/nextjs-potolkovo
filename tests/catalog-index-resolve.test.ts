import { describe, expect, it } from "vitest";

import snapshot from "../data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct } from "../lib/eks-feed2-catalog";
import { toText } from "../lib/feed2-snapshot-normalize";

/**
 * N-051 · Разрешение товара по ключу корзины.
 *
 * Модалка и страница держали свои индексы, и `resolveProduct` у них
 * отличался: модалка умела фолбэк по артикулу, страница — нет. Тест
 * фиксирует, что фолбэк нужен и почему.
 *
 * Проверяется чистая логика резолва, а не хук: React-обёртка здесь ничего не
 * решает, а @testing-library в зависимости добавлять нельзя (ТЗ разрешает
 * только drizzle/pg).
 */
const products = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;

/** Та же логика, что в `useCatalogIndex`, без React. */
function makeResolve(list: readonly FeedCatalogProduct[]) {
  const byProductId = new Map<string, FeedCatalogProduct>();
  for (const product of list) byProductId.set(toText(product.productId), product);

  const productIdByVendorCode = new Map<string, string>();
  for (const product of list) {
    const vendor = toText(product.vendorCode);
    const id = toText(product.productId);
    if (vendor && id) productIdByVendorCode.set(vendor, id);
  }

  return (key: string) => {
    const direct = byProductId.get(key);
    if (direct) return direct;
    const viaVendor = productIdByVendorCode.get(key);
    return viaVendor ? byProductId.get(viaVendor) : undefined;
  };
}

describe("N-051 · ключи корзины", () => {
  it("productId и артикул — разные форматы у каждого товара фида", () => {
    /**
     * Это и есть причина фолбэка: `eks-00008487` против `ЦБ-00008487`.
     * Если форматы когда-нибудь совпадут, фолбэк станет безвредным, но
     * бессмысленным — и тест об этом скажет.
     */
    const differing = products.filter(
      (product) => toText(product.productId) !== toText(product.vendorCode)
    );
    expect(differing.length).toBe(products.length);
  });

  it("товар находится по productId", () => {
    const resolve = makeResolve(products);
    const sample = products[0];
    expect(resolve(toText(sample.productId))?.productId).toBe(sample.productId);
  });

  it("товар находится и по артикулу поставщика", () => {
    // Страница до N-051 этого не умела: позиция с таким ключом молча пропадала
    // из корзины, хотя в модалке отображалась.
    const resolve = makeResolve(products);
    const sample = products.find((product) => toText(product.vendorCode))!;
    expect(resolve(toText(sample.vendorCode))?.productId).toBe(sample.productId);
  });

  it("неизвестный ключ не подставляет случайный товар", () => {
    const resolve = makeResolve(products);
    expect(resolve("нет-такого-ключа")).toBeUndefined();
    expect(resolve("")).toBeUndefined();
  });

  it("пустой каталог не роняет резолв", () => {
    expect(makeResolve([])("eks-00008487")).toBeUndefined();
  });
});
