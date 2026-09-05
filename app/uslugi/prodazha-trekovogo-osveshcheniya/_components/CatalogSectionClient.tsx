"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import {
  type CalculatorLeadSnapshot,
  usePriceCalculatorBridge,
} from "@/components/home/price-calculator-context";
import { ProductImageLightbox } from "@/components/feed2/ProductImageLightbox";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";

import { trackLightingCartCheckout, trackSmartInterestSelected } from "@/lib/analytics";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { clearIncompatibleSystem } from "@/lib/lighting/kit-rules";
import { showConfirmDialog } from "@/components/ui/confirm-dialog";
import { LightingCartDrawer } from "@/components/lighting/LightingCartDrawer";

import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";
import { detectSocket, getDiscountedPrice, getRequiredLampSocket } from "@/lib/feed2-products";

import {
  CATALOG_SECTIONS,
  POINT_SUBTYPES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  POINT_TO_MOUNT_VENDOR_CODE,
  CLARUS_PSU_VENDOR_CODES,
  isRemovedColibriVendorCode,
  type CatalogSectionId,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
  LAMP_SOCKETS,
  type LampSocket,
} from "@/lib/catalog-ui-config";

import { ART_TRACK_PROFILE_VENDOR_WHITELIST, applyVendorOverrides } from "@/lib/vendor-code-overrides";

type CartItems = Record<string, number>;

function toText(value: unknown): string {
  return String(value ?? "").trim();
}
function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function isMountsOrGrilles(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
  if (product.kind === "CEILING_COMPONENT") return true;
  return text.includes("заклад") || text.includes("решетк") || text.includes("решётк");
}

function isSmartProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)} ${toText(product.vendorCode)}`.toLowerCase();
  return text.includes("смарт") || text.includes("smart") || text.includes("умный дом");
}

function isPanelProduct(product: FeedCatalogProduct): boolean {
  const text = `${toText(product.name)} ${toText(product.categoryPath)}`.toLowerCase();
  return (
    text.includes("панел") ||
    text.includes("panel") ||
    text.includes("led панел") ||
    text.includes("led-панел") ||
    text.includes("led panel") ||
    text.includes("600x600") ||
    text.includes("595x595")
  );
}

function getPointSocket(product: FeedCatalogProduct): LampSocket | null {
  const vendorCode = toText(product.vendorCode);

  // legacy точечные
  if (vendorCode === "0У-00007177" || vendorCode === "0У-00007176") return "GX53";
  if (vendorCode === "0У-00001551" || vendorCode === "0У-00001552") return "MR16";

  const fromDetect = detectSocket(product);
  if (fromDetect === "GX53") return "GX53";
  if (fromDetect === "MR16") return "MR16";
  return null;
}

function matchesPointSubtype(product: FeedCatalogProduct, subtype: PointSubtypeId): boolean {
  // FIX: панели определяем до kind-check
  if (subtype === "PANELS") return isPanelProduct(product);
  if (product.kind !== "SPOT_FIXTURE") return false;
  const socket = getPointSocket(product);
  return socket === subtype;
}

function normalizeQty(nextQtyRaw: number, unit: "pcs" | "m"): number {
  const step = unit === "m" ? 0.5 : 1;
  const normalized = Math.round(nextQtyRaw / step) * step;
  return Math.max(0, Number.isFinite(normalized) ? normalized : 0);
}

function productToLightingItem(product: FeedCatalogProduct, qty: number): LightingItem {
  return {
    sku: toText(product.productId),
    name: toText(product.name),
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

function createLightingOnlySnapshot(): CalculatorLeadSnapshot {
  return {
    area: 0,
    ceilingTypeLabel: "Потолок пока не рассчитан",
    ceilingBaseRate: 0,
    ceilingBaseTotal: 0,
    ceilingExtraLabel: null,
    ceilingLength: null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal: 0,
    lightLinesEnabled: false,
    lightLinesLabel: null,
    lightLinesLength: null,
    lightLinesRatePerMeter: null,
    lightLinesTotal: 0,
    corniceLabel: null,
    corniceLength: null,
    corniceRatePerMeter: null,
    corniceTotal: 0,
    trackLabel: null,
    trackLength: null,
    trackRatePerMeter: null,
    trackTotal: 0,
    lightsEnabled: false,
    lightsCount: null,
    lightsRatePerUnit: 0,
    lightsTotal: 0,
    total: 0,
    derivedInputs: {
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    },
  };
}

function buildLightingSnapshotFromItems(items: LightingItem[]): LightingSnapshot | null {
  if (items.length === 0) return null;

  const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
  const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
  const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

  return {
    mode: "catalog",
    items,
    totalRub,
    discountedTotalRub,
    standaloneDiscountedTotalRub: discountedTotalRub,
    withCeilingDiscountedTotalRub,
    discountMode: "lighting-only",
    discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
    discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
    userCustomizedLighting: true,
  };
}

function benefitRub(priceRub: number, discountPercent: number): number {
  return Math.max(0, Math.round(priceRub - getDiscountedPrice(priceRub, discountPercent)));
}

function ProductCard({
  product,
  qty,
  onDec,
  onInc,
}: {
  product: FeedCatalogProduct;
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const regular = toNumber(product.priceRub);
  const lightingOnly = getDiscountedPrice(regular, LIGHTING_ONLY_DISCOUNT_PERCENT);
  const lightingOnlyBenefit = benefitRub(regular, LIGHTING_ONLY_DISCOUNT_PERCENT);
  const systemBadge = product.system === "COLIBRI_220"
    ? "COLIBRI"
    : product.system === "CLARUS_48"
      ? "CLARUS"
      : product.system === "TRACK_220"
        ? "ART"
        : null;
  const kindBadge = product.kind === "TRACK_PROFILE"
    ? "Профиль"
    : product.kind === "TRACK_FIXTURE"
      ? "Трековый свет"
      : product.kind === "SPOT_FIXTURE" || isPanelProduct(product)
        ? "Точечный"
        : product.kind === "LAMP"
          ? "Лампа"
          : null;

  const allAttrs = (product.keyAttributes?.length ? product.keyAttributes : product.params)
    .slice(0, 4)
    .map((p) => ({ label: toText(p.label), value: toText(p.value) }))
    .filter((a) => a.label && a.value);

  // V-20: show first 2 attributes on card surface, "+N ещё" expandable
  const visibleAttrs = allAttrs.slice(0, 2);
  const hiddenCount = allAttrs.length - visibleAttrs.length;

  const [showAllAttrs, setShowAllAttrs] = useState(false);
  const displayAttrs = showAllAttrs ? allAttrs : visibleAttrs;

  const attrs = displayAttrs.map((a) => `${a.label}: ${a.value}`).join(" • ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
        <div className="cursor-zoom-in">
          <ProductImageLightbox src={toText(product.coverImage)} alt={toText(product.name)} />
        </div>

        <div className="min-w-0">
          {(systemBadge || kindBadge || isSmartProduct(product)) ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {isSmartProduct(product) ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">SMART</span>
              ) : null}
              {systemBadge ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{systemBadge}</span>
              ) : null}
              {kindBadge ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{kindBadge}</span>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm font-semibold text-slate-950 break-words">{toText(product.name)}</p>

          {/* V-20: vendor code hidden from main card */}

          {attrs ? (
            <p className="mt-2 text-xs text-slate-600 break-words">
              {attrs}
              {hiddenCount > 0 && !showAllAttrs ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(true)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  ещё {hiddenCount}
                </button>
              ) : null}
              {showAllAttrs && hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(false)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  свернуть
                </button>
              ) : null}
            </p>
          ) : null}

          {/*
            T-044: одна ценовая подпись — итог со скидкой и зачёркнутая базовая.
            Раньше карточка несла шесть чисел (две скидки, два процента, две
            выгоды), и цену приходилось расшифровывать. Режим скидки объявлен
            баннером над сеткой.
          */}
          <div className="mt-3 text-xs">
            <span className="font-semibold text-emerald-700">{fmt(lightingOnly)} ₽</span>
            {lightingOnlyBenefit > 0 ? (
              <span className="ml-1.5 text-slate-500 line-through">{fmt(regular)} ₽</span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDec}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                −
              </button>

              <div className="min-w-[4.5rem] text-center text-sm font-semibold text-slate-950">
                {product.unit === "m" ? qty.toFixed(1) : qty} {product.unit === "m" ? "м" : "шт"}
              </div>

              <button
                type="button"
                onClick={onInc}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                +
              </button>
            </div>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                qty > 0 ? "bg-emerald-50 text-emerald-700" : "hidden",
              ].join(" ")}
            >
              В корзине
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = { data: FeedCatalogResult };

export function CatalogSectionClient({ data }: Props) {
  /** Дата прайса поставщика — показываем рядом с каталогом. */
  const catalogUpdatedAtLabel = useMemo(() => {
    const parsed = new Date(toText(data.updatedAt));
    if (Number.isNaN(parsed.getTime())) return "актуальную дату уточню";
    return parsed.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  }, [data.updatedAt]);

  const { openCalculator } = useCalculatorModal();
  const { setSnapshot } = usePriceCalculatorBridge();

  const products = useMemo(() => {
    return (data.products ?? [])
      .filter((product) => !isRemovedColibriVendorCode(product.vendorCode))
      .map((p) => applyVendorOverrides(p));
  }, [data.products]);

  const byProductId = useMemo(() => {
    const map = new Map<string, FeedCatalogProduct>();
    for (const product of products) map.set(toText(product.productId), product);
    return map;
  }, [products]);

  const productIdByVendorCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) {
      const vendor = toText(product.vendorCode);
      const id = toText(product.productId);
      if (vendor && id) map.set(vendor, id);
    }
    return map;
  }, [products]);

  const [section, setSection] = useState<CatalogSectionId>("track-systems");
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");
  const [smartOnly, setSmartOnly] = useState(false);

  const [query, setQuery] = useState("");
  /**
   * T-031: корзина общая с модалкой (`lightingDraft`), локального состояния нет —
   * счётчики страницы и калькулятора всегда совпадают, комплект не теряется.
   */
  const resolveProduct = useCallback(
    (productId: string) => byProductId.get(productId),
    [byProductId]
  );
  const lightingCart = useLightingCart(resolveProduct);
  const cartItems = lightingCart.cart;

  /** Совместимость со старым кодом: принимает как объект, так и updater. */
  const setCartItems = useCallback(
    (updater: CartItems | ((prev: CartItems) => CartItems)) => {
      const next = typeof updater === "function" ? updater(lightingCart.cart) : updater;
      lightingCart.replaceCart(next);
    },
    [lightingCart]
  );
  const [visibleCount, setVisibleCount] = useState(24);
  const [cartOpen, setCartOpen] = useState(false);

  const selectedEntries = useMemo(() => {
    return Object.entries(cartItems)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => {
        const product = byProductId.get(productId);
        return product ? { productId, product, qty } : null;
      })
      .filter((x): x is { productId: string; product: FeedCatalogProduct; qty: number } => Boolean(x));
  }, [byProductId, cartItems]);

  const selectedLightingItems = useMemo(() => {
    return selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));
  }, [selectedEntries]);

  const selectedTotal = useMemo(() => {
    return selectedEntries.reduce((sum, entry) => sum + entry.qty * toNumber(entry.product.priceRub), 0);
  }, [selectedEntries]);

  const lightingOnlySelectedTotal = useMemo(() => applyLightingOnlyDiscount(selectedTotal), [selectedTotal]);
  const withCeilingSelectedTotal = useMemo(() => applyLightingWithCeilingDiscount(selectedTotal), [selectedTotal]);
  const additionalCeilingBenefit = Math.max(0, lightingOnlySelectedTotal - withCeilingSelectedTotal);

  useEffect(() => {
    const lighting = buildLightingSnapshotFromItems(selectedLightingItems);

    setSnapshot((prev) => {
      if (!lighting) {
        if (!prev?.lighting) return prev;
        return {
          ...prev,
          lighting: undefined,
          lightingDiscountApplied: false,
          lightingDiscountPercentApplied: 0,
          lightingDiscountMode: "none",
          lightingDiscountAmountRub: 0,
        };
      }

      const base = prev ?? createLightingOnlySnapshot();
      return {
        ...base,
        leadSource: base.leadSource ?? "track-sale-page-catalog",
        lighting,
        lightingDiscountApplied: true,
        lightingDiscountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
        lightingDiscountMode: "lighting-only",
        lightingDiscountAmountRub: lighting.discountAmountRub ?? Math.max(0, selectedTotal - lightingOnlySelectedTotal),
      };
    });
  }, [lightingOnlySelectedTotal, selectedLightingItems, selectedTotal, setSnapshot]);

  // ===== Dependencies (mounts / lamps / PSU) =====
  const mountRequiredByVendor = useMemo(() => {
    const required: Record<string, number> = {};
    for (const entry of selectedEntries) {
      const fixtureVendor = toText(entry.product.vendorCode);
      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[fixtureVendor];
      if (!mountVendor) continue;
      required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
    }
    return required;
  }, [selectedEntries]);

  const missingMounts = useMemo(() => {
    const out: Array<{
      fixtureVendorCode: string;
      mountVendorCode: string;
      requiredQty: number;
      currentQty: number;
      mountName?: string;
    }> = [];

    for (const [fixtureVendor, mountVendor] of Object.entries(POINT_TO_MOUNT_VENDOR_CODE)) {
      const fixtureId = productIdByVendorCode.get(fixtureVendor);
      const mountId = productIdByVendorCode.get(mountVendor);
      if (!fixtureId || !mountId) continue;

      const fixtureQty = toNumber(cartItems[fixtureId]);
      if (fixtureQty <= 0) continue;

      const mountQty = toNumber(cartItems[mountId]);
      if (mountQty < fixtureQty) {
        out.push({
          fixtureVendorCode: fixtureVendor,
          mountVendorCode: mountVendor,
          requiredQty: fixtureQty,
          currentQty: mountQty,
          mountName: byProductId.get(mountId)?.name,
        });
      }
    }

    return out;
  }, [byProductId, cartItems, productIdByVendorCode]);

  const lampProductsBySocket = useMemo(() => {
    const base = products
      .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
      .sort((a, b) => toNumber(a.priceRub) - toNumber(b.priceRub));

    const bySocket: Record<LampSocket, FeedCatalogProduct[]> = { GX53: [], MR16: [], GU10: [] };
    for (const socket of LAMP_SOCKETS) {
      bySocket[socket] = base.filter((p) => detectSocket(p) === socket);
    }
    return bySocket;
  }, [products]);

  const lampRequiredBySocket = useMemo(() => {
    const required: Record<LampSocket, number> = { GX53: 0, MR16: 0, GU10: 0 };
    for (const entry of selectedEntries) {
      const socket = getRequiredLampSocket(entry.product);
      if (!socket) continue;
      required[socket] = (required[socket] ?? 0) + entry.qty;
    }
    return required;
  }, [selectedEntries]);

  const lampCurrentBySocket = useMemo(() => {
    const current: Record<LampSocket, number> = { GX53: 0, MR16: 0, GU10: 0 };
    for (const lamp of lampProductsBySocket.GX53) current.GX53 += toNumber(cartItems[toText(lamp.productId)]);
    for (const lamp of lampProductsBySocket.MR16) current.MR16 += toNumber(cartItems[toText(lamp.productId)]);
    return current;
  }, [cartItems, lampProductsBySocket]);

  const missingLamps = useMemo(() => {
    const out: Array<{ socket: LampSocket; requiredQty: number; currentQty: number; cheapestLampId: string | null }> =
      [];

    for (const socket of LAMP_SOCKETS) {
      const required = toNumber(lampRequiredBySocket[socket]);
      if (required <= 0) continue;

      const current = toNumber(lampCurrentBySocket[socket]);
      if (current >= required) continue;

      const cheapest = lampProductsBySocket[socket][0];
      out.push({
        socket,
        requiredQty: required,
        currentQty: current,
        cheapestLampId: cheapest ? toText(cheapest.productId) : null,
      });
    }

    return out;
  }, [lampCurrentBySocket, lampProductsBySocket, lampRequiredBySocket]);

  const hasClarusFixtures = useMemo(() => {
    return selectedEntries.some((e) => e.product.system === "CLARUS_48" && e.product.kind === "TRACK_FIXTURE");
  }, [selectedEntries]);

  const clarusPsuQty = useMemo(() => {
    return selectedEntries
      .filter((entry) => {
        const vendorCode = toText(entry.product.vendorCode);
        return CLARUS_PSU_VENDOR_CODES.some((code) => code === vendorCode);
      })
      .reduce((sum, entry) => sum + entry.qty, 0);
  }, [selectedEntries]);

  const setClarusPsu = (productId: string) => {
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
  };

  const addMountOneToOne = (fixtureVendor: string) => {
    const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(fixtureVendor)];
    if (!mountVendor) return;
    const mountId = productIdByVendorCode.get(mountVendor);
    if (!mountId) return;

    const required = toNumber(mountRequiredByVendor[mountVendor]);
    if (required <= 0) return;

    setCartItems((prev) => ({ ...prev, [mountId]: required }));
  };

  const addLampOneToOneCheapest = (socket: LampSocket, lampId: string) => {
    const required = toNumber(lampRequiredBySocket[socket]);
    if (required <= 0) return;

    setCartItems((prev) => {
      const next = { ...prev };
      const allLampIds = lampProductsBySocket[socket].map((p) => toText(p.productId));
      for (const id of allLampIds) if (id !== lampId) delete next[id];
      next[lampId] = required;
      return next;
    });
  };

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

  const openInCalculator = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) {
      openCalculator({
        entryMode: "lighting-first",
        initialStep: 1,
        initialLightingTab: "catalog",
        initialLightingView: "browse",
        source: "track-sale-empty",
      });
      return;
    }

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "open-calculator",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: discountedTotalRub,
      source: "track-sale-page",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 1,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page",
    });
  };

  /**
   * T-045 · Экран интента перед оформлением.
   *
   * Режим скидки определяет весь дальнейший путь: «только оборудование» ведёт
   * сразу к заявке (Шаг 2), «с потолком» — в расчёт потолка (Шаг 0). Спрашиваем
   * это один раз явным вопросом, а не двумя кнопками в липком баре.
   */
  const openCheckoutIntent = async () => {
    if (selectedEntries.length === 0) return;

    const withCeiling = await showConfirmDialog({
      title: "Как оформляем комплект?",
      message:
        "Только оборудование — скидка 10 %, пришлю счёт после проверки наличия. " +
        "С натяжным потолком — скидка на свет 25 %, сначала посчитаем потолок.",
      confirmLabel: "С потолком −25 %",
      cancelLabel: "Только оборудование −10 %",
      variant: "info",
    });

    if (withCeiling === true) {
      openWithCeiling();
      return;
    }
    openLightingOrder();
  };

  // T-031: «Посмотреть» открывает мини-корзину прямо на странице,
  // без ухода в калькулятор.
  const openSelectedList = () => {
    setCartOpen(true);
  };

  const openLightingOrder = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) return;

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "lighting-only",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: discountedTotalRub,
      source: "track-sale-page-lighting-only",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 2,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page-lighting-only",
    });
  };

  const openWithCeiling = () => {
    const items: LightingItem[] = selectedEntries.map((entry) => productToLightingItem(entry.product, entry.qty));

    if (items.length === 0) {
      openCalculator({ initialStep: 0, source: "track-sale-add-ceiling-empty" });
      return;
    }

    const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
    const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
    const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

    const initialLighting: LightingSnapshot = {
      mode: "catalog",
      items,
      totalRub,
      discountedTotalRub,
      standaloneDiscountedTotalRub: discountedTotalRub,
      withCeilingDiscountedTotalRub,
      discountMode: "lighting-only",
      discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
      discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
      userCustomizedLighting: true,
    };

    trackLightingCartCheckout({
      mode: "with-ceiling",
      itemsCount: items.length,
      lightingTotalRub: totalRub,
      lightingDiscountedRub: withCeilingDiscountedTotalRub,
      source: "track-sale-page-add-ceiling",
    });

    openCalculator({
      entryMode: "lighting-first",
      initialStep: 0,
      initialLightingTab: "catalog",
      initialLightingView: "selected",
      initialLighting,
      source: "track-sale-page-add-ceiling",
    });
  };

  const filteredProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];

    if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed =
          trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);

        scoped = products.filter((product) => {
          if (product.system !== trackSystem) return false;
          if (product.kind !== "TRACK_PROFILE") return false;
          return allowed.has(toText(product.vendorCode));
        });
      } else {
        scoped = products.filter((product) => product.system === trackSystem && product.kind === trackGroup);
      }
    } else if (section === "point-fixtures") {
      scoped = products.filter((product) => matchesPointSubtype(product, pointSubtype));
    } else if (section === "lamps") {
      scoped = products
        .filter((p) => p.kind === "LAMP" && p.available !== false && toNumber(p.priceRub) > 0)
        .filter((p) => detectSocket(p) === lampSocket);
    } else {
      scoped = products.filter((product) => isMountsOrGrilles(product));
    }

    if (smartOnly) {
      scoped = scoped.filter(isSmartProduct);
    }

    const q = toText(query).toLowerCase();
    if (!q) return scoped;

    return scoped.filter((product) => {
      const haystack = `${toText(product.name)} ${toText(product.vendorCode)} ${toText(product.categoryPath)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [lampSocket, pointSubtype, products, query, section, smartOnly, trackGroup, trackSystem]);

  return (
    <Section id="price" className={selectedEntries.length > 0 ? "scroll-mt-24 py-10 pb-36 max-sm:pb-44" : "scroll-mt-24 py-10"}>
      <Container>
        <div className="flex items-start justify-between gap-6">
          <Heading title="Каталог освещения" />

          <button
            type="button"
            onClick={openInCalculator}
            className="min-h-11 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
          >
Собрать в калькуляторе →
          </button>
        </div>

        {/* Controls */}
        {/*
          T-064: секции каталога — это настоящие вкладки, поэтому размечены
          как tablist/tab. Скринридер теперь сообщает «вкладка 2 из 6» и
          состояние выбора, чего не давал набор обычных кнопок.
        */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
          <div role="tablist" aria-label="Разделы каталога" className="contents">
            {CATALOG_SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`catalog-tab-${item.id}`}
                aria-selected={section === item.id}
                aria-controls="catalog-panel"
                onClick={() => {
                  setSection(item.id);
                  setQuery("");
                  setVisibleCount(24);
                }}
                className={[
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-[var(--radius-sm)] px-3.5 text-sm font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2",
                  section === item.id
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  "border",
                ].join(" ")}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSmartOnly((prev) => {
                const next = !prev;
                trackSmartInterestSelected({ placement: "catalog", enabled: next, source: "track-sale-page" });
                if (next) setSection("track-systems");
                return next;
              });
              setVisibleCount(24);
            }}
            className={[
              "whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium border",
              smartOnly ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
            ].join(" ")}
          >
            SMART
          </button>
        </div>

        {smartOnly ? (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
            Показаны SMART-позиции: светильники, панели управления и аксессуары. Управление лучше подбирать под сценарии помещения — зафиксирую интерес и предложу вариант лично.
          </div>
        ) : null}

        {section === "track-systems" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
            {TRACK_SYSTEMS.map((system) => (
              <button
                key={system.id}
                type="button"
                onClick={() => {
                  setTrackSystem(system.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  trackSystem === system.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {system.label}
              </button>
            ))}

            {TRACK_GROUPS.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  setTrackGroup(group.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  trackGroup === group.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "point-fixtures" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
            {POINT_SUBTYPES.map((subtype) => (
              <button
                key={subtype.id}
                type="button"
                onClick={() => {
                  setPointSubtype(subtype.id);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  pointSubtype === subtype.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {subtype.label}
              </button>
            ))}
          </div>
        ) : null}

        {section === "lamps" ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap">
            {(LAMP_SOCKETS).map((socket) => (
              <button
                key={socket}
                type="button"
                onClick={() => {
                  setLampSocket(socket);
                  setQuery("");
                }}
                className={[
                  "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
                  lampSocket === socket ? "bg-slate-900 text-white" : "bg-white text-slate-700",
                  "border border-slate-200",
                ].join(" ")}
              >
                {socket}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative mt-4">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5L17 17" strokeLinecap="round" />
            </svg>
          </span>
          <input
          value={query}
          onChange={(event) => setQuery(String(event.target.value ?? ""))}
          placeholder="Поиск в текущем разделе"
          className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
        </div>

        {/*
          T-045: один липкий бар вместо трёх конкурирующих кнопок.
          Выбор режима скидки перенесён в экран интента — раньше человек должен
          был решить «свет −10 %» или «потолок −25 %» прямо в баре, не понимая
          разницы.
        */}
        {selectedEntries.length > 0 ? (
          <div data-cart-bar data-count={selectedEntries.length} style={{ zIndex: "var(--z-cart, 45)" }} className="fixed bottom-4 left-1/2 hidden w-[min(1120px,calc(100vw-2rem))] -translate-x-1/2 rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-[0_14px_42px_rgba(15,23,42,0.16)] backdrop-blur sm:block">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* T-064: сумма меняется от кликов по карточкам — озвучиваем. */}
              <p aria-live="polite" aria-atomic="true" className="min-w-0 text-sm font-semibold text-slate-950">
                Корзина · {selectedEntries.length} поз. · {fmt(lightingOnlySelectedTotal)} ₽
              </p>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={openSelectedList}
                  className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Посмотреть
                </button>
                <button
                  type="button"
                  onClick={openCheckoutIntent}
                  className="min-h-11 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                >
                  Оформить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {selectedEntries.length > 0 ? (
          <div data-cart-bar data-count={selectedEntries.length} style={{ zIndex: "var(--z-cart, 45)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }} className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_28px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <p aria-live="polite" aria-atomic="true" className="min-w-0 text-xs font-semibold text-slate-950">
                Корзина · {selectedEntries.length} поз. · {fmt(lightingOnlySelectedTotal)} ₽
              </p>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={openSelectedList}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Посмотреть
                </button>
                <button
                  type="button"
                  onClick={openCheckoutIntent}
                  className="min-h-11 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white"
                >
                  Оформить
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* T-044: режим скидки — одной строкой над сеткой, а не в каждой карточке */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          Цены со скидкой −{LIGHTING_ONLY_DISCOUNT_PERCENT} % на свет · −{LIGHTING_WITH_CEILING_DISCOUNT_PERCENT} % при заказе с потолком
        </div>

        {/*
          T-045: честная оговорка про источник цен. Прайс поставщика меняется,
          и обещать неизменную цену до проверки наличия нельзя.
        */}
        <p className="mt-3 text-xs leading-5 text-slate-600">
          Цены и наличие по прайсу поставщика EKS Market на {catalogUpdatedAtLabel}; уточню перед счётом.
        </p>

        {/* Products grid with "Показать ещё" */}
        <div
          id="catalog-panel"
          role="tabpanel"
          aria-labelledby={`catalog-tab-${section}`}
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredProducts.slice(0, visibleCount).map((product) => {
            const id = toText(product.productId);
            const qty = toNumber(cartItems[id]);
            const step = product.unit === "m" ? 0.5 : 1;

            return (
              <ProductCard
                key={id}
                product={product}
                qty={qty}
                onDec={() =>
                  setCartItems((prev) => {
                    const next = { ...prev };
                    const nextQty = normalizeQty(qty - step, product.unit);
                    if (nextQty <= 0) delete next[id];
                    else next[id] = nextQty;
                    return next;
                  })
                }
                onInc={() => void incrementProduct(product, qty + step)}
              />
            );
          })}
        </div>

        {/* "Показать ещё" button */}
        {filteredProducts.length > visibleCount ? (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 24)}
              className="rounded-2xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400"
            >
              Показать ещё ({filteredProducts.length - visibleCount} из {filteredProducts.length})
            </button>
          </div>
        ) : null}

        {filteredProducts.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Ничего не найдено
          </div>
        ) : null}

        {/* Dependencies / warnings */}
        {selectedEntries.length > 0 ? (
          <div className="mt-6 space-y-3">
            {hasClarusFixtures && clarusPsuQty < 1 ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
                <p className="font-semibold">Для системы CLARUS обязателен минимум 1 блок питания.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CLARUS_PSU_VENDOR_CODES.map((vendor) => {
                    const id = productIdByVendorCode.get(vendor);
                    if (!id) return null;
                    const product = byProductId.get(id);
                    if (!product) return null;

                    return (
                      <button
                        key={vendor}
                        type="button"
                        onClick={() => setClarusPsu(id)}
                        className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
                      >
                        Добавить: {toText(product.name)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {missingMounts.map((m) => (
              <div
                key={`${m.fixtureVendorCode}-${m.mountVendorCode}`}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-semibold">Не хватает закладных 1:1</p>
                <p className="mt-2">
                  Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
                  <span className="font-semibold">{m.currentQty}</span> шт.
                  {m.mountName ? ` · Закладная: ${toText(m.mountName)}` : ""}
                </p>

                <button
                  type="button"
                  onClick={() => addMountOneToOne(m.fixtureVendorCode)}
                  className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  Добавить 1:1
                </button>
              </div>
            ))}

            {missingLamps.map((m) => (
              <div key={m.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">Не хватает ламп {m.socket} (1:1)</p>
                <p className="mt-2">
                  Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
                  <span className="font-semibold">{m.currentQty}</span> шт.
                </p>

                <button
                  type="button"
                  disabled={!m.cheapestLampId}
                  onClick={() => {
                    if (!m.cheapestLampId) return;
                    addLampOneToOneCheapest(m.socket, m.cheapestLampId);
                    setSection("lamps");
                    setLampSocket(m.socket);
                    setQuery("");
                  }}
                  className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Добавить 1:1 (самые доступные)
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <LightingCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          entries={lightingCart.entries}
          totalRub={lightingCart.totalRub}
          discountedTotalRub={lightingCart.discountedTotalRub}
          withCeilingTotalRub={lightingCart.withCeilingTotalRub}
          onSetQty={(entry, qty) => lightingCart.setQty(entry.product, qty)}
          onRemove={(productId) => lightingCart.remove(productId)}
          onCheckout={() => {
            setCartOpen(false);
            openLightingOrder();
          }}
        />

        {!data.ok ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
            Каталог временно не загрузился. Напишите мне — подберу комплект вручную.
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
