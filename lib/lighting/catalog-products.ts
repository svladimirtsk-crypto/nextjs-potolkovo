/**
 * PT-010 · Один и тот же каталог на клиенте и на сервере.
 *
 * Серверный пересчёт цены заявки обязан считать по тем же товарам, что видит
 * клиент, иначе расхождение в 1 % гарантировано самой реализацией: индекс
 * (`data/catalog-index.json`) — это ещё не каталог клиента. Клиент поверх
 * индекса применяет `applyVendorOverrides` (переклассификация `kind`/`system`
 * по артикулу — от неё зависит, какие позиции считаются метрами трека, а какие
 * точками света) и отфильтровывает снятые с продажи COLIBRI.
 *
 * Раньше это преобразование жило внутри `"use client"`-хука
 * `use-catalog-products.ts`, то есть серверу было недоступно. Теперь оно здесь,
 * в модуле без директивы: хук и серверный пересчёт вызывают одну функцию.
 */
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toText } from "@/lib/feed2-snapshot-normalize";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";

import { getCatalogIndex, type CatalogIndex, type CatalogIndexProduct } from "./catalog-index";

/**
 * Индекс не содержит `params`, `images`, `url` и `categoryPath` — они нужны
 * только серверному рендеру карточек. Здесь подставляем безопасные пустые
 * значения, чтобы форма `FeedCatalogProduct` осталась прежней для всех
 * потребителей (`calcTrackProfileMeters`, `isPanelProduct`, предикаты каталога).
 */
export function catalogIndexToFeedProduct(product: CatalogIndexProduct): FeedCatalogProduct {
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

/** Индекс → список товаров в том виде, в котором их видит клиент. */
export function buildCatalogProducts(index: CatalogIndex): FeedCatalogProduct[] {
  return buildCatalogLookupProducts(index).filter(
    (product) => !REMOVED_COLIBRI_VENDOR_CODES.has(toText(product.vendorCode))
  );
}

/**
 * PT-010 · Тот же список, но без фильтра снятых с продажи.
 *
 * Нужен серверному пересчёту заявки: товар, который убрали из каталога уже
 * после того, как человек собрал корзину, всё равно существует — его надо
 * опознать и принять с пометкой, а не отклонять заявку как «неизвестный SKU».
 */
export function buildCatalogLookupProducts(index: CatalogIndex): FeedCatalogProduct[] {
  return index.products.map(catalogIndexToFeedProduct).map((product) => applyVendorOverrides(product));
}

/**
 * Каталог для серверных расчётов. Сам файл мемоизирован внутри
 * `getCatalogIndex()`, поэтому повторных чтений нет; отображение списка —
 * несколько сотен позиций — на каждый вызов, чтобы не заводить второй кэш,
 * который пришлось бы сбрасывать в тестах.
 */
export async function getCatalogProducts(): Promise<FeedCatalogProduct[]> {
  return buildCatalogProducts(await getCatalogIndex());
}

/** Полный список для резолва артикулов — см. `buildCatalogLookupProducts`. */
export async function getCatalogLookupProducts(): Promise<FeedCatalogProduct[]> {
  return buildCatalogLookupProducts(await getCatalogIndex());
}
