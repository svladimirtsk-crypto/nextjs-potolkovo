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

import { buildCatalogProducts } from "./catalog-products";
import { getCatalogIndex, type CatalogIndex } from "./catalog-index";

export type CatalogProductsState = {
  products: FeedCatalogProduct[];
  /** true, пока чанк каталога не загрузился: UI показывает скелетон. */
  isLoading: boolean;
  error: Error | null;
};

export function useCatalogProducts(): CatalogProductsState {
  const [raw, setRaw] = useState<CatalogIndex | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Асинхронная загрузка данных (не синхронизация состояний) — единственный
  // допустимый здесь сценарий useEffect + setState.
  useEffect(() => {
    let cancelled = false;

    getCatalogIndex()
      .then((index) => {
        if (!cancelled) setRaw(index);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // PT-010 · преобразование индекса вынесено в `catalog-products.ts`, чтобы
  // серверный пересчёт заявки считал по тому же списку, что видит клиент.
  const products = useMemo(() => (raw ? buildCatalogProducts(raw) : []), [raw]);

  return { products, isLoading: raw === null && error === null, error };
}
