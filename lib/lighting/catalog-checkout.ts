import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";

/**
 * N-051 · Снапшот корзины каталога для передачи в калькулятор.
 *
 * Три кнопки страницы («Открыть в калькуляторе», «Только оборудование»,
 * «С потолком») собирали этот объект тремя одинаковыми копиями по 12 строк.
 * Копии обязаны совпадать: расходятся суммы — расходится и заявка.
 */

export function productToLightingItem(product: FeedCatalogProduct, qty: number): LightingItem {
  return {
    sku: toText(product.productId),
    name: toText(product.name),
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

export function cartToLightingItems(
  entries: ReadonlyArray<{ product: FeedCatalogProduct; qty: number }>,
): LightingItem[] {
  return entries.map((entry) => productToLightingItem(entry.product, entry.qty));
}

/**
 * Режим скидки здесь всегда `lighting-only`: на странице каталога потолка
 * ещё нет. На `with-ceiling` его переключает калькулятор, когда потолок
 * посчитан, — иначе в заявку уйдут 25 % за не заказанный потолок.
 */
/**
 * Суммы объявлены обязательными, хотя в `LightingSnapshot` они опциональны:
 * эта функция всегда их считает, и вызывающему коду не нужно проверять
 * `undefined` перед отправкой в аналитику.
 */
export type CatalogLightingSnapshot = LightingSnapshot & {
  totalRub: number;
  discountedTotalRub: number;
  withCeilingDiscountedTotalRub: number;
};

export function buildCatalogLightingSnapshot(items: LightingItem[]): CatalogLightingSnapshot {
  const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
  const discountedTotalRub = applyLightingOnlyDiscount(totalRub);

  return {
    mode: "catalog",
    items,
    totalRub,
    discountedTotalRub,
    standaloneDiscountedTotalRub: discountedTotalRub,
    withCeilingDiscountedTotalRub: applyLightingWithCeilingDiscount(totalRub),
    discountMode: "lighting-only",
    discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
    discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
    userCustomizedLighting: true,
  };
}

/**
 * PT-011 · Исход экрана интента «Как оформляем комплект?».
 *
 * Три значения вместо «да/нет», потому что `boolean` совмещал два разных
 * смысла: «человек выбрал только оборудование» и «человек закрыл диалог».
 * Закрытие (Escape, клик по подложке, крестик) — это `dismissed`, и оно не
 * должно ни менять корзину, ни уводить в оформление.
 */
export type CheckoutIntentChoice = "with-ceiling" | "lighting-only";

export type CheckoutIntentOutcome = CheckoutIntentChoice | "dismissed";

/** Куда вести человека после экрана интента. */
export type CheckoutIntentAction =
  | "open-ceiling-flow"
  | "open-lighting-order"
  | "stay-in-catalog";

/**
 * Соответствие «исход → действие». `switch` без `default`: если в union
 * появится четвёртое значение, TypeScript укажет на незакрытую ветку вместо
 * того, чтобы молча провалиться в «оформление».
 */
export function resolveCheckoutIntentAction(
  outcome: CheckoutIntentOutcome,
): CheckoutIntentAction {
  switch (outcome) {
    case "with-ceiling":
      return "open-ceiling-flow";
    case "lighting-only":
      return "open-lighting-order";
    case "dismissed":
      return "stay-in-catalog";
  }
}
