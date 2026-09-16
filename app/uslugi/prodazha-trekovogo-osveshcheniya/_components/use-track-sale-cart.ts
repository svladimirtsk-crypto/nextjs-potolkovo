"use client";

/**
 * PT-018 (B-F104, T-324) · корзина каталога на странице трекового света.
 *
 * Страница `/uslugi/prodazha-trekovogo-osveshcheniya` считает по корзине то же,
 * что и Шаг 1 модалки: выбранные позиции, сумму со скидкой «только свет»,
 * недостающие закладные и лампы по цоколям, варианты блока питания CLARUS — и
 * умеет их докладывать (закладная один-к-одному, самая дешёвая лампа, БП).
 *
 * Всё это лежало в `CatalogSectionClient.tsx` между разметкой и CTA, из-за чего
 * файл читался только целиком. Здесь — хук-обёртка над уже вынесенными чистыми
 * функциями `catalog-kit-gaps` и `step1-selectors`: правил он не знает, он их
 * собирает и отдаёт.
 *
 * Источник корзины один — `useLightingCart` (`lightingDraft`), локального
 * состояния хук не заводит, эффектов не содержит.
 *
 * Осознанно НЕ перенесено: эффект записи комплекта в общий снимок заявки — он
 * остаётся в компоненте под стражем `check-effect-setstate` (перенос эффекта в
 * отдельный файл вывел бы его из-под проверки, а не улучшил код).
 */
import { useCallback, useMemo } from "react";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import {
  CLARUS_PSU_VENDOR_CODES,
  POINT_TO_MOUNT_VENDOR_CODE,
  type LampSocket,
} from "@/lib/catalog-ui-config";
import { productToLightingItem } from "@/lib/lighting/catalog-checkout";
import {
  calcClarusPsuOptions,
  calcLampCurrentBySocket,
  calcLampRequiredBySocket,
  calcMissingLamps,
  calcMissingMounts,
  calcMountRequiredByVendor,
  groupLampsBySocket,
} from "@/lib/lighting/catalog-kit-gaps";
import { clearIncompatibleSystem } from "@/lib/lighting/kit-rules";
import { applyLightingOnlyDiscount } from "@/lib/lighting-formulas";
import { normalizeQty } from "@/lib/lighting/product-predicates";
import type { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { showConfirmDialog } from "@/components/ui/confirm-dialog";

export type CartItems = Record<string, number>;

/** Позиция корзины с разобранным товаром — основа всех производных. */
export type SelectedEntry = {
  productId: string;
  product: FeedCatalogProduct;
  qty: number;
};

export type UseTrackSaleCartInput = {
  /** Каталог страницы: уже отфильтрован от снятых с продажи и с оверрайдами. */
  products: FeedCatalogProduct[];
  byProductId: Map<string, FeedCatalogProduct>;
  productIdByVendorCode: Map<string, string>;
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined;
  /** Общая корзина (`lightingDraft`) — единственный источник позиций. */
  lightingCart: ReturnType<typeof useLightingCart>;
};

export function useTrackSaleCart(input: UseTrackSaleCartInput) {
  const { products, byProductId, productIdByVendorCode, resolveProduct, lightingCart } = input;
  const cartItems = lightingCart.cart;

  /** Совместимость со старым кодом: принимает как объект, так и updater. */
  const setCartItems = useCallback(
    (updater: CartItems | ((prev: CartItems) => CartItems)) => {
      const next = typeof updater === "function" ? updater(lightingCart.cart) : updater;
      lightingCart.replaceCart(next);
    },
    [lightingCart]
  );

  const selectedEntries = useMemo<SelectedEntry[]>(
    () =>
      Object.entries(cartItems)
        .filter(([, qty]) => qty > 0)
        .map(([productId, qty]) => {
          const product = byProductId.get(productId);
          return product ? { productId, product, qty } : null;
        })
        .filter((entry): entry is SelectedEntry => Boolean(entry)),
    [byProductId, cartItems]
  );

  const selectedLightingItems = useMemo(
    () => selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty)),
    [selectedEntries]
  );

  const selectedTotal = useMemo(
    () => selectedEntries.reduce((sum, entry) => sum + entry.qty * toNumber(entry.product.priceRub), 0),
    [selectedEntries]
  );

  const lightingOnlySelectedTotal = useMemo(
    () => applyLightingOnlyDiscount(selectedTotal),
    [selectedTotal]
  );

  /* ─── Комплектующие: чего не хватает, чтобы свет заработал ─── */

  const mountRequiredByVendor = useMemo(
    () => calcMountRequiredByVendor(selectedEntries),
    [selectedEntries]
  );

  const missingMounts = useMemo(
    () => calcMissingMounts(cartItems, productIdByVendorCode, byProductId),
    [byProductId, cartItems, productIdByVendorCode]
  );

  const lampProductsBySocket = useMemo(() => groupLampsBySocket(products), [products]);

  const lampRequiredBySocket = useMemo(
    () => calcLampRequiredBySocket(selectedEntries),
    [selectedEntries]
  );

  const lampCurrentBySocket = useMemo(
    () => calcLampCurrentBySocket(cartItems, lampProductsBySocket),
    [cartItems, lampProductsBySocket]
  );

  const missingLamps = useMemo(
    () => calcMissingLamps(lampRequiredBySocket, lampCurrentBySocket, lampProductsBySocket),
    [lampCurrentBySocket, lampProductsBySocket, lampRequiredBySocket]
  );

  const clarusPsuOptions = useMemo(
    () => calcClarusPsuOptions(selectedEntries, productIdByVendorCode, byProductId),
    [selectedEntries, productIdByVendorCode, byProductId]
  );

  /* ─── Действия над корзиной ─── */

  /** БП CLARUS ровно один: выбор другого снимает предыдущий. */
  const setClarusPsu = useCallback(
    (productId: string) => {
      setCartItems((prev) => {
        const next = { ...prev };
        for (const vendor of CLARUS_PSU_VENDOR_CODES) {
          const id = productIdByVendorCode.get(vendor);
          if (!id) continue;
          if (id !== productId) delete next[id];
        }
        next[productId] = Math.max(1, toNumber(next[productId]));
        return next;
      });
    },
    [productIdByVendorCode, setCartItems]
  );

  /** Закладная под светильник — один к одному, в нужном количестве. */
  const addMountOneToOne = useCallback(
    (fixtureVendor: string) => {
      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(fixtureVendor)];
      if (!mountVendor) return;
      const mountId = productIdByVendorCode.get(mountVendor);
      if (!mountId) return;

      const required = toNumber(mountRequiredByVendor[mountVendor]);
      if (required <= 0) return;

      setCartItems((prev) => ({ ...prev, [mountId]: required }));
    },
    [mountRequiredByVendor, productIdByVendorCode, setCartItems]
  );

  /** Лампы нужного цоколя: выбранная ставится в требуемом количестве, прочие снимаются. */
  const addLampOneToOneCheapest = useCallback(
    (socket: LampSocket, lampId: string) => {
      const required = toNumber(lampRequiredBySocket[socket]);
      if (required <= 0) return;

      setCartItems((prev) => {
        const next = { ...prev };
        const allLampIds = lampProductsBySocket[socket].map((p) => toText(p.productId));
        for (const id of allLampIds) if (id !== lampId) delete next[id];
        next[lampId] = required;
        return next;
      });
    },
    [lampProductsBySocket, lampRequiredBySocket, setCartItems]
  );

  /**
   * T-031: добавление позиции с проверкой совместимости систем.
   * При конфликте спрашиваем подтверждение; отказ не меняет корзину.
   */
  const incrementProduct = useCallback(
    async (product: FeedCatalogProduct, nextQtyRaw: number) => {
      const id = toText(product.productId);
      const nextQty = normalizeQty(nextQtyRaw, product.unit);
      if (nextQty <= 0) return;

      const conflict = lightingCart.checkConflict(product);
      if (conflict) {
        const confirmed = await showConfirmDialog({
          title: "Разные системы трека",
          message: conflict.message,
          confirmLabel: "Заменить",
          cancelLabel: "Оставить как есть",
          variant: "warning",
        });
        // Отказ — корзина остаётся нетронутой.
        if (confirmed !== true) return;

        lightingCart.update((prev) => ({
          ...clearIncompatibleSystem(prev, conflict.targetSystem, resolveProduct),
          [id]: nextQty,
        }));
        return;
      }

      lightingCart.update((prev) => ({ ...prev, [id]: nextQty }));
    },
    [lightingCart, resolveProduct]
  );

  return {
    cartItems,
    setCartItems,
    selectedEntries,
    selectedLightingItems,
    selectedTotal,
    lightingOnlySelectedTotal,
    missingMounts,
    missingLamps,
    clarusPsuOptions,
    setClarusPsu,
    addMountOneToOne,
    addLampOneToOneCheapest,
    incrementProduct,
  };
}
