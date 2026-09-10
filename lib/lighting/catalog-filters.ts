import {
  CATALOG_SECTIONS,
  TRACK_PROFILE_WHITELIST,
  type CatalogSectionId,
  type LampSocket,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  isMountsOrGrilles,
  isPanelProduct,
  isSmartProduct,
  matchesPointSubtype,
} from "@/lib/lighting/product-predicates";
import { ART_TRACK_PROFILE_VENDOR_WHITELIST } from "@/lib/vendor-code-overrides";

/**
 * N-051 · Отбор товаров каталога: раздел, фильтры, поиск.
 *
 * Вынесено из `CatalogSectionClient` в чистые функции — какой товар в каком
 * разделе показывать решают правила каталога, а не разметка.
 */

export type CatalogFilters = {
  section: CatalogSectionId;
  trackSystem: TrackSystemId;
  trackGroup: TrackGroupId;
  pointSubtype: PointSubtypeId;
  lampSocket: LampSocket;
  smartOnly: boolean;
  query: string;
};

/** Строка, по которой ищем: название, артикул и путь категории. */
export function searchHaystack(product: FeedCatalogProduct): string {
  return `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
}

/**
 * T-065 · К какой секции каталога относится товар.
 *
 * Нужна для глобального поиска: правила отбора раньше жили только внутри
 * `filteredProducts` вперемешку с активными фильтрами, поэтому «где ещё
 * есть эта позиция» посчитать было нечем.
 */
export function sectionOfProduct(product: FeedCatalogProduct): CatalogSectionId | null {
  if (product.kind === "TRACK_PROFILE" || product.kind === "TRACK_FIXTURE" || product.kind === "TRACK_ACCESSORY") {
    return "track-systems";
  }
  if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) return "point-fixtures";
  if (product.kind === "CHANDELIER") return "chandeliers";
  if (product.kind === "LED_STRIP" || product.kind === "PSU" || product.kind === "CONTROL") {
    return "cornice-lighting";
  }
  if (product.kind === "LAMP") return "lamps";
  if (isMountsOrGrilles(product)) return "mounts-grilles";
  return null;
}

/**
 * Товары раздела до применения фильтров «умный свет» и поиска.
 *
 * У «Люстр» и «Подсветки карниза» веток здесь раньше не было: оба раздела
 * проваливались в `else` и показывали вентиляционные решётки — те же, что в
 * «Закладных». 16 люстр и 85 позиций подсветки клиент увидеть не мог, хотя
 * `sectionOfProduct` (глобальный поиск) их правильно относил к своим
 * разделам. Теперь оба источника согласованы.
 */
export function productsOfSection(
  products: readonly FeedCatalogProduct[],
  filters: Pick<CatalogFilters, "section" | "trackSystem" | "trackGroup" | "pointSubtype" | "lampSocket">,
): FeedCatalogProduct[] {
  const { section, trackSystem, trackGroup, pointSubtype, lampSocket } = filters;

  if (section === "track-systems") {
    if (trackGroup === "TRACK_PROFILE") {
      const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
      const allowed =
        trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);

      return products.filter(
        (product) =>
          product.system === trackSystem &&
          product.kind === "TRACK_PROFILE" &&
          allowed.has(toText(product.vendorCode)),
      );
    }
    return products.filter((product) => product.system === trackSystem && product.kind === trackGroup);
  }

  if (section === "point-fixtures") {
    return products.filter((product) => matchesPointSubtype(product, pointSubtype));
  }

  if (section === "lamps") {
    return products
      .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
      .filter((p) => detectSocket(p) === lampSocket);
  }

  if (section === "chandeliers" || section === "cornice-lighting") {
    return products.filter((product) => sectionOfProduct(product) === section);
  }

  return products.filter((product) => isMountsOrGrilles(product));
}

/**
 * Товары с фотографией — вперёд.
 *
 * Порядок внутри групп сохраняется — меняется только приоритет показа.
 */
export function withPhotoFirst(
  list: readonly FeedCatalogProduct[],
  hasPhoto: (product: FeedCatalogProduct) => boolean,
): FeedCatalogProduct[] {
  return [...list].sort((a, b) => Number(hasPhoto(b)) - Number(hasPhoto(a)));
}

export function filterCatalogProducts(
  products: readonly FeedCatalogProduct[],
  filters: CatalogFilters,
  hasPhoto: (product: FeedCatalogProduct) => boolean,
): FeedCatalogProduct[] {
  let scoped = productsOfSection(products, filters);

  if (filters.smartOnly) scoped = scoped.filter(isSmartProduct);

  const q = toText(filters.query).toLowerCase();
  if (q) scoped = scoped.filter((product) => searchHaystack(product).includes(q));

  return withPhotoFirst(scoped, hasPhoto);
}

/**
 * T-065 · Глобальный поиск: сколько совпадений в КАЖДОМ разделе.
 *
 * Раньше поиск работал только внутри активной секции и молчал, если товар
 * лежал в соседней: человек искал «блок питания», получал «ничего не
 * найдено» в «Трековых системах» и уходил, хотя позиция была в «Подсветке
 * карниза». Считаем по всему каталогу и показываем, куда перейти.
 */
export function searchMatchesBySection(
  products: readonly FeedCatalogProduct[],
  query: string,
  activeSection: CatalogSectionId,
): Array<{ id: CatalogSectionId; label: string; count: number }> | null {
  const q = toText(query).trim().toLowerCase();
  if (q.length < 2) return null;

  const counts = new Map<CatalogSectionId, number>();
  for (const product of products) {
    if (!searchHaystack(product).includes(q)) continue;
    const productSection = sectionOfProduct(product);
    if (!productSection) continue;
    counts.set(productSection, (counts.get(productSection) ?? 0) + 1);
  }

  return CATALOG_SECTIONS.filter((item) => item.id !== activeSection && (counts.get(item.id) ?? 0) > 0).map((item) => ({
    id: item.id,
    label: item.label,
    count: counts.get(item.id) ?? 0,
  }));
}
