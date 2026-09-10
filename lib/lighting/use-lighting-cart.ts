"use client";

/**
 * T-031 · Единая корзина света для страницы каталога и модалки.
 *
 * Раньше каждая из них держала собственный `useState<CartItems>` и
 * синхронизировалась с `lightingDraft` цепочкой эффектов — счётчики разъезжались,
 * а комплект, добавленный с карточки, терялся при переходе в модалку.
 * Теперь источник один: `lightingDraft` в `CalculatorModalProvider`
 * (он смонтирован в `app/providers.tsx`, то есть общий для всего приложения).
 */
import { useCallback, useMemo } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";

import { clearIncompatibleSystem, conflicts, type Cart, type CartConflict } from "./kit-rules";

export type CartEntry = {
  productId: string;
  product: FeedCatalogProduct;
  qty: number;
  totalRub: number;
};

export type LightingCartApi = {
  /** productId → количество. */
  cart: Cart;
  entries: CartEntry[];
  itemsCount: number;
  totalRub: number;
  /** Сумма со скидкой «только свет» (−10 %). */
  discountedTotalRub: number;
  /** Сумма со скидкой при заказе потолка (−25 %). */
  withCeilingTotalRub: number;
  setQty: (product: FeedCatalogProduct, qty: number) => void;
  add: (product: FeedCatalogProduct, qty?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  /** Полная замена корзины — для миграции существующего UI. */
  replaceCart: (next: Cart) => void;
  /**
   * Стабильный (не меняющийся между рендерами) апдейтер в стиле `setState`.
   * Нужен UI, который ещё передаёт колбэк `prev => next`: если бы такой колбэк
   * замыкался на текущую корзину, он пересоздавался бы каждый рендер и ломал
   * мемоизацию React Compiler у всех зависимых обработчиков.
   */
  update: (updater: Cart | ((prev: Cart) => Cart)) => void;
  /** Добавляет готовый комплект одним действием (карточка LightKitShowcase). */
  applyKit: (items: Array<{ product: FeedCatalogProduct; qty: number }>) => void;
  /**
   * Тот же комплект, но заданный позициями черновика (sku + qty).
   * Нужен карточкам готовых наборов, которые оперируют `LightingItem`,
   * а не товарами фида.
   */
  applyKitItems: (items: readonly LightingItem[]) => void;
  /** Проверка конфликта систем перед добавлением; null — конфликта нет. */
  checkConflict: (product: FeedCatalogProduct) => CartConflict | null;
  /** Удаляет позиции чужой системы. */
  dropIncompatible: (targetSystem: string) => void;
};

/** Черновик → корзина (`productId → qty`). */
function cartFromDraft(draft: LightingSnapshot | null): Cart {
  const result: Cart = {};
  if (!draft || draft.mode !== "catalog") return result;
  for (const item of draft.items ?? []) {
    const sku = toText(item.sku);
    if (sku) result[sku] = toNumber(item.qty);
  }
  return result;
}

/** Штучные позиции округляем до целого, метражные — до 0.1. */
function normalizeQty(qty: number, unit: string): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return unit === "m" ? Math.round(qty * 10) / 10 : Math.max(0, Math.round(qty));
}

export function useLightingCart(
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined
): LightingCartApi {
  const { lightingDraft, setLightingDraft } = useCalculatorModal();

  // Корзина выводится из черновика — отдельного состояния не заводим.
  const cart = useMemo<Cart>(() => cartFromDraft(lightingDraft), [lightingDraft]);

  const entries = useMemo<CartEntry[]>(() => {
    const result: CartEntry[] = [];
    for (const [productId, qty] of Object.entries(cart)) {
      const product = resolveProduct(productId);
      if (!product || toNumber(qty) <= 0) continue;
      result.push({
        productId,
        product,
        qty: toNumber(qty),
        totalRub: toNumber(product.priceRub) * toNumber(qty),
      });
    }
    return result;
  }, [cart, resolveProduct]);

  const totalRub = useMemo(
    () => entries.reduce((sum, entry) => sum + entry.totalRub, 0),
    [entries]
  );

  /** Корзина → черновик. Единственное место, где собирается `LightingSnapshot`. */
  const draftFromCart = useCallback(
    (nextCart: Cart): LightingSnapshot => {
      const items: LightingItem[] = [];
      let sum = 0;

      for (const [productId, qty] of Object.entries(nextCart)) {
        const product = resolveProduct(productId);
        const quantity = toNumber(qty);
        if (!product || quantity <= 0) continue;

        const priceRub = toNumber(product.priceRub);
        sum += priceRub * quantity;
        items.push({
          sku: productId,
          name: toText(product.name),
          qty: quantity,
          priceRub,
          vendorCode: toText(product.vendorCode),
          system: toText(product.system),
          kind: toText(product.kind),
          unit: toText(product.unit),
        });
      }

      if (items.length === 0) return { mode: "none", userCustomizedLighting: false };

      return {
        mode: "catalog",
        items,
        totalRub: sum,
        discountedTotalRub: applyLightingOnlyDiscount(sum),
        standaloneDiscountedTotalRub: applyLightingOnlyDiscount(sum),
        withCeilingDiscountedTotalRub: applyLightingWithCeilingDiscount(sum),
        userCustomizedLighting: true,
      };
    },
    [resolveProduct]
  );

  /**
   * Стабильный апдейтер в стиле `setState`: читает предыдущую корзину из самого
   * черновика, поэтому не зависит от текущего рендера и не ломает мемоизацию
   * обработчиков, которые его захватывают.
   */
  const update = useCallback(
    (updater: Cart | ((prev: Cart) => Cart)) => {
      setLightingDraft((prev) => {
        const next = typeof updater === "function" ? updater(cartFromDraft(prev)) : updater;
        return draftFromCart(next);
      });
    },
    [draftFromCart, setLightingDraft]
  );

  const commit = useCallback((nextCart: Cart) => update(nextCart), [update]);

  const setQty = useCallback(
    (product: FeedCatalogProduct, qty: number) => {
      const productId = toText(product.productId);
      const normalized = normalizeQty(qty, toText(product.unit));
      update((prev) => {
        const next = { ...prev };
        if (normalized <= 0) delete next[productId];
        else next[productId] = normalized;
        return next;
      });
    },
    [update]
  );

  const add = useCallback(
    (product: FeedCatalogProduct, qty = 1) => {
      const productId = toText(product.productId);
      const unit = toText(product.unit);
      update((prev) => {
        const normalized = normalizeQty(toNumber(prev[productId]) + qty, unit);
        const next = { ...prev };
        if (normalized <= 0) delete next[productId];
        else next[productId] = normalized;
        return next;
      });
    },
    [update]
  );

  const remove = useCallback(
    (productId: string) => {
      update((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    },
    [update]
  );

  const clear = useCallback(() => {
    setLightingDraft({ mode: "none", userCustomizedLighting: false });
  }, [setLightingDraft]);

  const replaceCart = useCallback((next: Cart) => commit(next), [commit]);

  const applyKit = useCallback(
    (items: Array<{ product: FeedCatalogProduct; qty: number }>) => {
      update((prev) => {
        const next = { ...prev };
        for (const { product, qty } of items) {
          const productId = toText(product.productId);
          const normalized = normalizeQty(qty, toText(product.unit));
          if (normalized > 0) next[productId] = normalized;
        }
        return next;
      });
    },
    [update]
  );

  const applyKitItems = useCallback(
    (items: readonly LightingItem[]) => {
      update((prev) => {
        const next = { ...prev };
        for (const item of items) {
          const sku = toText(item.sku);
          const qty = toNumber(item.qty);
          if (!sku || qty <= 0) continue;
          // Комплект задаёт количество целиком, а не прибавляет к текущему.
          next[sku] = qty;
        }
        return next;
      });
    },
    [update]
  );

  const checkConflict = useCallback(
    (product: FeedCatalogProduct) => conflicts(cart, product, resolveProduct),
    [cart, resolveProduct]
  );

  const dropIncompatible = useCallback(
    (targetSystem: string) => {
      update((prev) => clearIncompatibleSystem(prev, targetSystem, resolveProduct));
    },
    [resolveProduct, update]
  );

  return {
    cart,
    entries,
    itemsCount: entries.length,
    totalRub,
    discountedTotalRub: applyLightingOnlyDiscount(totalRub),
    withCeilingTotalRub: applyLightingWithCeilingDiscount(totalRub),
    setQty,
    add,
    remove,
    clear,
    replaceCart,
    update,
    applyKit,
    applyKitItems,
    checkConflict,
    dropIncompatible,
  };
}
