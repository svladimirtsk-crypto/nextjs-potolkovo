/**
 * T-029 · Серверная обёртка каталога.
 *
 * Раньше компонент был клиентским и импортировал весь фид (~940 КБ), из-за чего
 * тот попадал в бандл страницы. Теперь фид читается на сервере, а в клиент
 * уезжает только то, что реально рисуется в карточках.
 */
import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import { pricing } from "@/content/pricing";

import { CatalogSectionClient } from "./CatalogSectionClient";

/** Поля, которые не участвуют в отрисовке, до клиента не доезжают. */
function toClientProduct(product: FeedCatalogProduct): FeedCatalogProduct {
  return {
    ...product,
    // Галерея не используется — карточке достаточно обложки.
    images: product.coverImage ? [product.coverImage] : [],
    // Фильтры и характеристики читают keyAttributes; полный params дублирует их.
    params: product.keyAttributes?.length ? product.keyAttributes : product.params,
  };
}

export function CatalogSection() {
  const products = normalizeFeedCatalogProducts(
    (snapshotData as { products?: unknown[] }).products ?? []
  ).map(toClientProduct);

  const data: FeedCatalogResult = {
    ok: true,
    updatedAt: String(
      (snapshotData as { updatedAt?: unknown }).updatedAt ?? new Date().toISOString()
    ),
    source: "snapshot",
    discountPercentForCeilingOrder: pricing.lightingDiscount.withCeilingPct,
    categories: [],
    products,
  };

  return <CatalogSectionClient data={data} />;
}
