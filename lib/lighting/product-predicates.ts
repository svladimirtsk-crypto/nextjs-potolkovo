import type { LampSocket, PointSubtypeId } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

/**
 * N-051 · Единая классификация товаров каталога.
 *
 * Раньше эти предикаты жили двумя копиями — в `wizard-step1-lighting.tsx`
 * (модалка) и в `CatalogSectionClient.tsx` (страница света), — и успели
 * разойтись: страница не имела ветки «Прочее» для точечных светильников без
 * распознанного цоколя, а `isPanelProduct` обзавёлся там лишними подстроками.
 * На текущем фиде обе версии давали одинаковый результат, но это совпадение:
 * первый же товар с нестандартным цоколем пропал бы из каталога страницы,
 * оставшись видимым в модалке. Теперь реализация одна.
 */

/** Светодиодная панель (в т.ч. армстронг 600×600). */
export function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return (
    text.includes("панел") ||
    text.includes("panel") ||
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

/** Лампа, доступная к заказу и с ценой. */
export function isLamp(product: FeedCatalogProduct): boolean {
  return product.kind === "LAMP" && toNumber(product.priceRub) > 0 && product.available !== false;
}

/** Товар из линейки «умный дом». */
export function isSmartProduct(product: FeedCatalogProduct): boolean {
  const text =
    `${toText(product.name)} ${toText(product.categoryPath)} ${toText(product.vendorCode)}`.toLowerCase();
  return text.includes("смарт") || text.includes("smart") || text.includes("умный дом");
}

/** Закладные и вентиляционные решётки. */
export function isMountsOrGrilles(product: FeedCatalogProduct): boolean {
  const text =
    `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
  if (product.kind === "CEILING_COMPONENT") return true;
  return text.includes("заклад") || text.includes("решетк") || text.includes("решётк");
}

/**
 * Цоколь точечного светильника.
 *
 * Часть позиций заведена в фиде без цоколя в названии — для них зашиты
 * артикулы, иначе светильник не попадал бы ни в одну вкладку.
 */
export function getPointSocket(product: FeedCatalogProduct): LampSocket | null {
  const vendorCode = toText(product.vendorCode);

  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  return detectSocket(product);
}

/**
 * Соответствие товара вкладке точечных светильников.
 *
 * T-013: светильники с нераспознанным цоколем не теряются — они попадают
 * в «Прочее», а не выпадают из каталога молча.
 */
export function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  // Панели определяются до проверки kind: в фиде они заведены по-разному.
  if (subtype === "PANELS") return isPanelProduct(product);
  if (product.kind !== "SPOT_FIXTURE") return false;

  if (subtype === "OTHER") return getPointSocket(product) === null && !isPanelProduct(product);

  return getPointSocket(product) === subtype;
}

/** Количество с шагом: метры — 0.5, штуки — 1. Отрицательные отсекаются. */
export function normalizeQty(rawQty: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  const normalized = Math.round(rawQty / step) * step;
  return Math.max(0, Number.isFinite(normalized) ? normalized : 0);
}

/**
 * N-051 · Подписи бейджей карточки товара.
 *
 * Карточка в модалке и карточка на странице каталога рисуются по-разному
 * (вертикальная плитка против горизонтальной строки), но набор бейджей у них
 * обязан совпадать: покупатель видит один и тот же товар в двух местах.
 * Раньше обе цепочки условий были скопированы дословно, и любое новое
 * значение `system`/`kind` пришлось бы добавлять дважды.
 */
export function systemBadgeLabel(product: FeedCatalogProduct): string | null {
  if (product.system === "COLIBRI_220") return "COLIBRI";
  if (product.system === "CLARUS_48") return "CLARUS";
  if (product.system === "TRACK_220") return "ART";
  return null;
}

export function kindBadgeLabel(product: FeedCatalogProduct): string | null {
  if (product.kind === "TRACK_PROFILE") return "Профиль";
  if (product.kind === "TRACK_FIXTURE") return "Трековый свет";
  if (product.kind === "SPOT_FIXTURE" || isPanelProduct(product)) return "Точечный";
  if (product.kind === "LAMP") return "Лампа";
  return null;
}
