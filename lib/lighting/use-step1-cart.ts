"use client";

/**
 * PT-018 (B-F104, T-324) · корзина Шага 1 «Свет»: факты и действия.
 *
 * Шаг 1 умеет менять корзину шестью способами (количество товара, профиль с
 * выбором системы, закладные один-к-одному, самые дешёвые лампы, блок питания
 * CLARUS, предложения по комплектующим) и считает по корзине полтора десятка
 * производных величин — от метража трека до недостающих ламп по цоколям. Всё
 * это лежало в компоненте между разметкой и состоянием экрана, из-за чего файл
 * читался только целиком.
 *
 * Здесь — хук-обёртка над чистыми функциями `cart-derived`, `kit-rules` и
 * `orphan-track`: сам он правил не знает, он их только собирает и отдаёт.
 * Источник корзины по-прежнему один (`lightingDraft` через `useLightingCart`),
 * локального состояния хук не заводит, эффектов не содержит.
 *
 * Осознанно НЕ перенесено: эффект автоочистки «осиротевшего» трека (T-024) —
 * он живёт в компоненте, чтобы остаться под стражем `check-effect-setstate`
 * (перенос эффекта в `lib/` вывел бы его из-под проверки, а не улучшил код).
 */
import { useCallback, useMemo } from "react";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { type LampSocket, type TrackSystemId } from "@/lib/catalog-ui-config";
import { trackLightingCartChanged } from "@/lib/analytics";
import {
  buildAccessorySuggestions,
  buildCartEntries,
  calcClarusPsuQty,
  calcLampCurrentBySocket,
  calcLampCurrentTotal,
  calcLampRequiredBySocket,
  calcLampRequiredTotal,
  calcLampSocketsToShow,
  calcMissingLamps,
  calcMissingMounts,
  calcSelectedPointQty,
  calcSelectedTrackMeters,
  groupLampOptionsBySocket,
  hasClarusInCart as hasClarusInCartFn,
  type CartEntry,
} from "@/lib/lighting/cart-derived";
import { clearAllTrackProducts, clearIncompatibleSystem, type Cart } from "@/lib/lighting/kit-rules";
import { calcOrphanTrackMeters, selectOrphanTrackEntries } from "@/lib/lighting/orphan-track";
import { normalizeQty } from "@/lib/lighting/product-predicates";
import {
  applyClarusPsu,
  applyProductQty,
  applyTrackProfileQty,
  cheapestLampsAddition,
  describeCartChange,
  dropOrphanTrackItems as dropOrphanTrackItemsRule,
  mountOneToOneTarget,
  trackSystemOfProduct,
} from "@/lib/lighting/step1-cart-rules";
import {
  buildClarusPsuOptions,
  buildSelectedViewItems,
  calcMountRequiredByVendor,
  type ClarusPsuOption,
  type SelectedViewItem,
} from "@/lib/lighting/step1-selectors";

/** Предложение из `cart-derived` плюс действие «добавить». */
export type AccessorySuggestion = ReturnType<typeof buildAccessorySuggestions>[number] & {
  apply: () => void;
};

export type UseStep1CartInput = {
  /** productId → количество. Единственный источник — `useLightingCart`. */
  cart: Cart;
  /** Стабильный апдейтер корзины в стиле `setState`. */
  updateCart: (updater: Cart | ((prev: Cart) => Cart)) => void;
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined;
  productsById: Map<string, FeedCatalogProduct>;
  productIdByVendorCode: Map<string, string>;
  products: FeedCatalogProduct[];
  /** Откуда пришёл человек — уходит в аналитику вместе с изменением корзины. */
  source?: string;
  /** Трек заказан на Шаге 0; 0 — трек не нужен. */
  requiredTrackMeters: number;
  /** Профиль кладут в корзину вместе с выбором системы (T-010). */
  onTrackSystemPicked: (system: TrackSystemId) => void;
};

export type Step1CartApi = {
  cartEntries: CartEntry[];
  selectedTrackMeters: number;
  selectedPointQty: number;

  lampOptionsBySocket: ReturnType<typeof groupLampOptionsBySocket>;
  lampRequiredBySocket: ReturnType<typeof calcLampRequiredBySocket>;
  lampCurrentBySocket: ReturnType<typeof calcLampCurrentBySocket>;
  mountRequiredByVendor: Record<string, number>;
  missingLamps: ReturnType<typeof calcMissingLamps>;
  lampRequiredTotal: number;
  lampCurrentTotal: number;
  lampSocketsToShow: LampSocket[];
  missingMounts: ReturnType<typeof calcMissingMounts>;
  hasClarusInCart: boolean;
  clarusPsuQty: number;
  clarusPsuOptions: ClarusPsuOption[];
  /** T-012: предложения по комплектующим — с готовым действием `apply`. */
  accessorySuggestions: AccessorySuggestion[];

  selectedViewItems: SelectedViewItem[];

  orphanTrackEntries: CartEntry[];
  orphanTrackMeters: number;
  orphanTrackCount: number;
  showOrphanTrackWarning: boolean;
  dropOrphanTrackItems: () => void;

  setProductQty: (product: FeedCatalogProduct, nextQty: number) => void;
  setTrackProfileQty: (product: FeedCatalogProduct, nextQty: number) => void;
  clearTrackProductsForSystem: (system: TrackSystemId | null) => void;
  addMountOneToOne: (fixtureVendorCode: string) => void;
  addCheapestLamps: (socket: LampSocket) => void;
  setClarusPsu: (productId: string) => void;
};

/** Аналитика изменения корзины: одно действие — одно событие. */
function reportCartChange(input: {
  source?: string;
  product: FeedCatalogProduct;
  prevQty: number;
  nextQty: number;
}) {
  const event = describeCartChange(input);
  if (event) trackLightingCartChanged(event);
}

export function useStep1Cart(input: UseStep1CartInput): Step1CartApi {
  const {
    cart,
    updateCart,
    resolveProduct,
    productsById,
    productIdByVendorCode,
    products,
    source,
    requiredTrackMeters,
    onTrackSystemPicked,
  } = input;

  /* ─── Состав корзины ─── */

  const cartEntries = useMemo(() => buildCartEntries(cart, resolveProduct), [cart, resolveProduct]);

  const selectedTrackMeters = useMemo(() => calcSelectedTrackMeters(cartEntries), [cartEntries]);
  const selectedPointQty = useMemo(() => calcSelectedPointQty(cartEntries), [cartEntries]);
  const selectedViewItems = useMemo(() => buildSelectedViewItems(cartEntries), [cartEntries]);

  /* ─── Лампы, закладные, блоки питания ─── */

  const lampOptionsBySocket = useMemo(() => groupLampOptionsBySocket(products), [products]);
  const lampRequiredBySocket = useMemo(() => calcLampRequiredBySocket(cartEntries), [cartEntries]);
  const lampCurrentBySocket = useMemo(
    () => calcLampCurrentBySocket(cart, lampOptionsBySocket),
    [cart, lampOptionsBySocket]
  );
  const mountRequiredByVendor = useMemo(() => calcMountRequiredByVendor(cartEntries), [cartEntries]);
  const missingLamps = useMemo(
    () => calcMissingLamps(lampRequiredBySocket, lampCurrentBySocket),
    [lampCurrentBySocket, lampRequiredBySocket]
  );
  const lampRequiredTotal = useMemo(
    () => calcLampRequiredTotal(lampRequiredBySocket),
    [lampRequiredBySocket]
  );
  const lampCurrentTotal = useMemo(
    () => calcLampCurrentTotal(lampRequiredBySocket, lampCurrentBySocket),
    [lampCurrentBySocket, lampRequiredBySocket]
  );
  const lampSocketsToShow = useMemo(
    () => calcLampSocketsToShow(lampRequiredBySocket, lampCurrentBySocket),
    [lampCurrentBySocket, lampRequiredBySocket]
  );
  const missingMounts = useMemo(
    () => calcMissingMounts({ cartItems: cart, productIdByVendorCode, productsById }),
    [cart, productIdByVendorCode, productsById]
  );

  const hasClarusInCart = useMemo(() => hasClarusInCartFn(cartEntries), [cartEntries]);
  const clarusPsuQty = useMemo(() => calcClarusPsuQty(cartEntries), [cartEntries]);

  /** Варианты БП для CLARUS; пусто — если блок уже выбран или CLARUS нет. */
  const clarusPsuOptions = useMemo(
    () => buildClarusPsuOptions({ hasClarusInCart, clarusPsuQty, productIdByVendorCode, productsById }),
    [hasClarusInCart, clarusPsuQty, productIdByVendorCode, productsById]
  );

  /* ─── T-024: трек выключен, но в корзине есть трековые позиции ─── */

  const orphanTrackEntries = useMemo(
    () => selectOrphanTrackEntries(cartEntries, requiredTrackMeters),
    [cartEntries, requiredTrackMeters]
  );
  const orphanTrackMeters = useMemo(
    () => calcOrphanTrackMeters(orphanTrackEntries),
    [orphanTrackEntries]
  );
  const orphanTrackCount = orphanTrackEntries.length;

  const dropOrphanTrackItems = useCallback(() => {
    if (orphanTrackEntries.length === 0) return;
    updateCart((prev) => dropOrphanTrackItemsRule(prev, orphanTrackEntries));
  }, [orphanTrackEntries, updateCart]);

  /**
   * Предупреждение показываем всегда, когда трековые позиции есть, а трек не
   * заказан: если их только что удалили автоматически, счётчик обнулится и
   * блок исчезнет сам.
   */
  const showOrphanTrackWarning = orphanTrackCount > 0 && requiredTrackMeters <= 0;

  /* ─── T-012: предложения по комплектующим (без принуждения) ─── */

  const accessorySuggestions = useMemo(() => {
    const suggestions = buildAccessorySuggestions({
      lampRequiredBySocket,
      lampCurrentBySocket,
      lampOptionsBySocket,
      missingMounts,
      productIdByVendorCode,
      productsById,
    });

    return suggestions.map((suggestion) => ({
      ...suggestion,
      apply: () =>
        updateCart((prev) => ({
          ...prev,
          [suggestion.productId]: toNumber(prev[suggestion.productId]) + suggestion.qty,
        })),
    }));
  }, [
    lampCurrentBySocket,
    lampOptionsBySocket,
    lampRequiredBySocket,
    missingMounts,
    productIdByVendorCode,
    productsById,
    updateCart,
  ]);

  /* ─── Действия с корзиной (правила — в `step1-cart-rules`) ─── */

  const setProductQty = useCallback(
    (product: FeedCatalogProduct, nextQtyRaw: number) => {
      const nextQty = normalizeQty(nextQtyRaw, product.unit);

      reportCartChange({ source, product, prevQty: toNumber(cart[toText(product.productId)]), nextQty });
      updateCart((prev) => applyProductQty(prev, { product, nextQty, resolveProduct }));
    },
    [cart, resolveProduct, source, updateCart]
  );

  const clearTrackProductsForSystem = useCallback(
    (system: TrackSystemId | null) => {
      /**
       * N-051: `system === null` — человек отказался от трека, и убрать надо
       * всё трековое, а не только чужую систему.
       */
      updateCart((prev) =>
        system === null
          ? clearAllTrackProducts(prev, resolveProduct)
          : clearIncompatibleSystem(prev, system, resolveProduct)
      );
    },
    [resolveProduct, updateCart]
  );

  const setTrackProfileQty = useCallback(
    (product: FeedCatalogProduct, nextQtyRaw: number) => {
      const system = trackSystemOfProduct(product);
      if (!system) return;

      const nextQty = normalizeQty(nextQtyRaw, product.unit);

      onTrackSystemPicked(system);
      reportCartChange({ source, product, prevQty: toNumber(cart[toText(product.productId)]), nextQty });
      updateCart((prev) => applyTrackProfileQty(prev, { product, nextQty, resolveProduct }));
    },
    [cart, onTrackSystemPicked, resolveProduct, source, updateCart]
  );

  /**
   * Закладные под точки — один к одному. Пустой клик корзину не трогает:
   * апдейтер пометил бы черновик изменённым пользователем (T-031).
   */
  const addMountOneToOne = useCallback(
    (fixtureVendorCode: string) => {
      const addition = mountOneToOneTarget({
        fixtureVendorCode,
        mountRequiredByVendor,
        productIdByVendorCode,
      });
      if (!addition) return;

      updateCart((prev) => ({ ...prev, [addition.productId]: addition.qty }));
    },
    [mountRequiredByVendor, productIdByVendorCode, updateCart]
  );

  /** Добрать лампы нужного цоколя самым дешёвым вариантом из каталога. */
  const addCheapestLamps = useCallback(
    (socket: LampSocket) => {
      const addition = cheapestLampsAddition({
        socket,
        lampRequiredBySocket,
        lampCurrentBySocket,
        lampOptionsBySocket,
      });
      if (!addition) return;

      updateCart((prev) => ({
        ...prev,
        [addition.productId]: toNumber(prev[addition.productId]) + addition.qty,
      }));
    },
    [lampCurrentBySocket, lampOptionsBySocket, lampRequiredBySocket, updateCart]
  );

  /** Блок питания CLARUS — ровно один: остальные снимаются. */
  const setClarusPsu = useCallback(
    (productId: string) =>
      updateCart((prev) => applyClarusPsu(prev, { productId, productIdByVendorCode })),
    [productIdByVendorCode, updateCart]
  );

  return {
    cartEntries,
    selectedTrackMeters,
    selectedPointQty,
    lampOptionsBySocket,
    lampRequiredBySocket,
    lampCurrentBySocket,
    mountRequiredByVendor,
    missingLamps,
    lampRequiredTotal,
    lampCurrentTotal,
    lampSocketsToShow,
    missingMounts,
    hasClarusInCart,
    clarusPsuQty,
    clarusPsuOptions,
    accessorySuggestions,
    selectedViewItems,
    orphanTrackEntries,
    orphanTrackMeters,
    orphanTrackCount,
    showOrphanTrackWarning,
    dropOrphanTrackItems,
    setProductQty,
    setTrackProfileQty,
    clearTrackProductsForSystem,
    addMountOneToOne,
    addCheapestLamps,
    setClarusPsu,
  };
}
