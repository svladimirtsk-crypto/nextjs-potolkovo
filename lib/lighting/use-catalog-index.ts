"use client";

/**
 * N-051 · Индексы каталога и разрешение товара по ключу корзины.
 *
 * Модалка и страница строили две пары одинаковых `Map` (`productId → товар` и
 * `артикул → productId`), но `resolveProduct` у них отличался: модалка умела
 * фолбэк по артикулу, страница — нет.
 *
 * Форматы ключей в фиде разные (`eks-00008487` против `ЦБ-00008487`), причём
 * различаются все 547 позиций. Сейчас черновик всегда пишет `productId`,
 * поэтому расхождение ничего не ломает — но стоит одному источнику положить
 * артикул, и страница молча потеряет позицию, а модалка её покажет. Держим
 * одно поведение на обе стороны, с фолбэком.
 */
import { useCallback, useMemo } from "react";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toText } from "@/lib/feed2-snapshot-normalize";

export type CatalogIndexApi = {
  /** productId → товар. */
  byProductId: Map<string, FeedCatalogProduct>;
  /** артикул поставщика → productId. */
  productIdByVendorCode: Map<string, string>;
  /** Ключ корзины → товар. Понимает и productId, и артикул. */
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined;
};

export function useCatalogIndex(products: readonly FeedCatalogProduct[]): CatalogIndexApi {
  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) map.set(toText(product.productId), product);
    return map;
  }, [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendor = toText(product.vendorCode);
      const id = toText(product.productId);
      if (vendor && id) map.set(vendor, id);
    }
    return map;
  }, [products]);

  const resolveProduct = useCallback(
    (productId: string) => {
      const direct = byProductId.get(productId);
      if (direct) return direct;

      // Черновик мог прийти оттуда, где ключом был артикул.
      const byVendor = productIdByVendorCode.get(productId);
      return byVendor ? byProductId.get(byVendor) : undefined;
    },
    [byProductId, productIdByVendorCode]
  );

  return { byProductId, productIdByVendorCode, resolveProduct };
}
