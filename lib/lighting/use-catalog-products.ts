"use client";

/**
 * T-029 · Клиентский доступ к каталогу без 940-килобайтного фида в бандле.
 *
 * Компоненты раньше делали `import snapshotData from "@/data/eks-feed2-snapshot.json"`,
 * из-за чего весь фид попадал в JS главной страницы. Хук отдаёт тот же
 * `FeedCatalogProduct[]`, но данные приезжают отдельным чанком через
 * `getCatalogIndex()` уже после гидратации.
 */
import { useEffect, useMemo, useState } from "react";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { toText } from "@/lib/feed2-snapshot-normalize";

import { getCatalogIndex, type CatalogIndexProduct } from "./catalog-index";

/**
 * Индекс не содержит `params`, `images`, `url` и `categoryPath` — они нужны только
 * серверному рендеру карточек. Здесь подставляем безопасные пустые значения,
 * чтобы форма `FeedCatalogProduct` осталась прежней для всех потребителей.
 */
function toFeedProduct(product: CatalogIndexProduct): FeedCatalogProduct {
  return {
    productId: product.productId,
    vendorCode: product.vendorCode,
    offerId: "",
    name: product.name,
    url: "",
    categoryId: "",
    categoryPath: "",
    images: product.coverImage ? [product.coverImage] : [],
    coverImage: product.coverImage,
    priceRub: product.priceRub,
    available: product.available,
    params: product.socket ? [{ label: "Цоколь", value: product.socket }] : [],
    keyAttributes: product.socket ? [{ label: "Цоколь", value: product.socket }] : [],
    system: product.system,
    kind: product.kind,
    unit: product.unit,
    lengthMeters: product.pieceLengthMeters,
    pieceLengthMeters: product.pieceLengthMeters,
  };
}

export type CatalogProductsState = {
  products: FeedCatalogProduct[];
  /** true, пока чанк каталога не загрузился: UI показывает скелетон. */
  isLoading: boolean;
  error: Error | null;
};

export function useCatalogProducts(): CatalogProductsState {
  const [raw, setRaw] = useState<CatalogIndexProduct[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Асинхронная загрузка данных (не синхронизация состояний) — единственный
  // допустимый здесь сценарий useEffect + setState.
  useEffect(() => {
    let cancelled = false;

    getCatalogIndex()
      .then((index) => {
        if (!cancelled) setRaw(index.products);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo(() => {
    if (!raw) return [];
    return raw
      .map(toFeedProduct)
      .map((product) => applyVendorOverrides(product))
      .filter((product) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(product.vendorCode)));
  }, [raw]);

  return { products, isLoading: raw === null && error === null, error };
}
