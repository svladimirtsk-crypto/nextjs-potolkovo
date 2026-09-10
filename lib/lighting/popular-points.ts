/**
 * N-021 · Выбор светильников по типу, а не по цоколю (F-15, F-16).
 *
 * Клиент, пришедший считать потолок, не знает, что такое GX53. Три таба с
 * маркировками цоколей — это стена: чтобы её пройти, надо уже разбираться в
 * светильниках. Поэтому первый вопрос задан на языке вида и цены («классические
 * врезные — от 350 ₽»), а цоколь остаётся вторичным фильтром для тех, кому он
 * важен.
 *
 * Здесь только чистые функции: какой товар считать популярным и что показать
 * на карточке типа. Разметка — в компоненте.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { matchesPointSubtype } from "@/lib/lighting/product-predicates";
import type { PointSubtypeId } from "@/lib/catalog-ui-config";

/** Тип светильника в терминах клиента, а не каталога. */
export type PointKindId = "recessed" | "swivel" | "panel";

export type PointKindSpec = {
  id: PointKindId;
  title: string;
  /** Чем этот тип отличается — одной строкой, без терминов. */
  meta: string;
  /**
   * Название в винительном падеже для кнопки «Добавить 6 …».
   * Родительный от заголовка не образуешь автоматически, а «Добавить 6
   * классические врезные» — безграмотно.
   */
  accusative: string;
  /** Подтипы каталога, попадающие в эту группу. */
  subtypes: PointSubtypeId[];
};

export const POINT_KINDS: PointKindSpec[] = [
  {
    id: "recessed",
    title: "Классические врезные",
    meta: "Ровный свет, самый частый выбор",
    accusative: "классических врезных",
    subtypes: ["GX53"],
  },
  {
    id: "swivel",
    title: "Тонкие поворотные",
    meta: "Направленный свет, можно повернуть",
    accusative: "тонких поворотных",
    subtypes: ["MR16", "GU10"],
  },
  {
    id: "panel",
    title: "Панели",
    meta: "Широкий мягкий свет без бликов",
    accusative: "панелей",
    subtypes: ["PANELS"],
  },
];

/** Товар можно предлагать: есть в наличии и с ценой. */
function isOfferable(product: FeedCatalogProduct): boolean {
  return product.available && product.priceRub > 0;
}

/** Все доступные светильники типа, от дешёвых к дорогим. */
export function pointsOfKind(
  products: FeedCatalogProduct[],
  kind: PointKindId
): FeedCatalogProduct[] {
  const spec = POINT_KINDS.find((item) => item.id === kind);
  if (!spec) return [];

  return products
    .filter(
      (product) =>
        isOfferable(product) &&
        spec.subtypes.some((subtype) => matchesPointSubtype(product, subtype))
    )
    .sort((a, b) => a.priceRub - b.priceRub);
}

/** Цена «от» для карточки типа. null — предлагать нечего. */
export function minPriceOfKind(
  products: FeedCatalogProduct[],
  kind: PointKindId
): number | null {
  const cheapest = pointsOfKind(products, kind)[0];
  return cheapest ? cheapest.priceRub : null;
}

export type PopularPointsResult = {
  product: FeedCatalogProduct;
  qty: number;
  /** Сумма без скидки — скидку считает вызывающий по режиму заказа. */
  totalRub: number;
};

/**
 * Готовое предложение «добавить N популярных».
 *
 * Популярный здесь — самый дешёвый доступный товар типа, взятый целиком на всё
 * нужное количество: один SKU вместо набора разных. Смысл в том, что светильники
 * в одной комнате должны быть одинаковыми — набор из шести разных моделей
 * технически возможен, но это не то, что человек имел в виду.
 */
export function popularPoints(
  products: FeedCatalogProduct[],
  required: number,
  kind: PointKindId
): PopularPointsResult | null {
  const qty = Math.max(0, Math.round(required));
  if (qty <= 0) return null;

  const product = pointsOfKind(products, kind)[0];
  if (!product) return null;

  return { product, qty, totalRub: product.priceRub * qty };
}

/**
 * Тип, который стоит предложить по умолчанию: самый дешёвый из доступных.
 * Если каталог пуст по всем трём — null, и экран honest-fallback покажет каталог.
 */
export function defaultPointKind(products: FeedCatalogProduct[]): PointKindId | null {
  let best: { kind: PointKindId; price: number } | null = null;

  for (const spec of POINT_KINDS) {
    const price = minPriceOfKind(products, spec.id);
    if (price === null) continue;
    if (!best || price < best.price) best = { kind: spec.id, price };
  }

  return best?.kind ?? null;
}

/** Что уже выбрано по каждому цоколю — подсказка на вторичных табах. */
export type SocketProgress = Record<
  PointSubtypeId,
  { current: number; required: number }
>;

/**
 * Считает выбранное по цоколям.
 *
 * Вынесено из компонента: это арифметика по корзине, а не разметка, и её
 * стоит проверять тестом, а не глазами на экране.
 */
export function pointProgressBySocket(
  entries: readonly { product: FeedCatalogProduct; qty: number }[],
  requiredTotal: number,
  isPanel: (product: FeedCatalogProduct) => boolean,
  detectSocket: (product: FeedCatalogProduct) => PointSubtypeId | null
): SocketProgress {
  const result: SocketProgress = {
    GX53: { current: 0, required: 0 },
    MR16: { current: 0, required: 0 },
    GU10: { current: 0, required: 0 },
    PANELS: { current: 0, required: 0 },
    OTHER: { current: 0, required: 0 },
  };

  for (const entry of entries) {
    if (entry.product.kind === "SPOT_FIXTURE") {
      const socket = detectSocket(entry.product);
      if (socket) result[socket].current += entry.qty;
      else if (!isPanel(entry.product)) result.OTHER.current += entry.qty;
    }
    if (isPanel(entry.product)) result.PANELS.current += entry.qty;
  }

  // Общий план показывает липкая полоса; на табах — только факт выбора.
  if (requiredTotal > 0) result.GX53.required = requiredTotal;

  return result;
}
