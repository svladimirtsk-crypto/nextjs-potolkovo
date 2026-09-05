"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  trackLightingSearch,
  trackLightingStepView,
  trackLightingSystemSelected,
} from "@/lib/analytics";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { trackLightingCartChanged } from "@/lib/analytics";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  LIGHTING_WITH_CEILING_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";
import {
  buildProductsIndex,
  detectSocket,
  getDiscountedPrice,
} from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { resolveInitialLightingStep, type WizardStep } from "@/lib/lighting/resolve-initial-step";
import { pricing } from "@/content/pricing";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import { completeKit } from "@/lib/lighting/kit-rules";
import {
  autoAssembleProfiles,
  clearIncompatibleSystem as clearIncompatibleSystem_,
  fixturesHintForMeters,
  isTrackSystemId,
} from "@/lib/lighting/kit-rules";

import {
  visibleCatalogSections,
  POINT_SUBTYPES,
  POINT_TO_MOUNT_VENDOR_CODE,
  CLARUS_PSU_VENDOR_CODES,
  REMOVED_COLIBRI_VENDOR_CODES,
  TRACK_GROUPS,
  TRACK_PROFILE_WHITELIST,
  TRACK_SYSTEMS,
  type CatalogSectionId,
  LAMP_SOCKETS,
  type PointSubtypeId,
  type TrackGroupId,
  type TrackSystemId,
  type LampSocket,
} from "@/lib/catalog-ui-config";

import {
  ART_TRACK_PROFILE_VENDOR_WHITELIST,
} from "@/lib/vendor-code-overrides";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";

import {
  isLamp,
  isMountsOrGrilles,
  isPanelProduct,
  matchesPointSubtype,
  normalizeQty,
} from "@/lib/lighting/product-predicates";
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
} from "@/lib/lighting/cart-derived";
import {
  calcOrphanTrackMeters,
  decideOrphanTrackAction,
  selectOrphanTrackEntries,
} from "@/lib/lighting/orphan-track";
import {
  KitDoneScreen,
  ManualPickScreen,
  TrackSystemScreen,
} from "@/components/lighting/Step1Screens";
import { ProductImage } from "@/components/feed2/ProductImage";
import { useCalculatorModal } from "./calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";

/* ─── helpers ─── */

type Tab = "recommendations" | "catalog";
type CatalogView = "selected" | "browse";
type CartItems = Record<string, number>;

function fmt(v: number): string { return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }
function fmtM(v: number): string { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v); }








function pickAttrs(p: FeedCatalogProduct): { label: string; value: string }[] {
  const a = p.keyAttributes?.length ? p.keyAttributes : p.params;
  return (a ?? []).slice(0, 4).map((x) => ({ label: toText(x.label), value: toText(x.value) }));
}

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node || typeof window === "undefined") return null;

  let parent = node.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll") &&
      parent.scrollHeight > parent.clientHeight;

    if (canScroll) return parent;
    parent = parent.parentElement;
  }

  return (document.scrollingElement as HTMLElement | null) ?? null;
}

/* ─── small UI components ─── */

import {
  ImageQuickPreview,
  OrphanTrackNotice,
  ProductCard,
  TabBtn,
  ThinProgress,
} from "@/components/lighting/CatalogPieces";
import { ProductGrid, ProductPickerScreen, WizardFooter } from "@/components/lighting/ProductPickerScreen";
import { resolveStep1FooterAction } from "@/lib/lighting/step1-footer-action";


/* ─── MAIN COMPONENT ─── */

export function WizardStep1Lighting() {
  const { snapshot } = useCalculatorStore();
  const {
    lightingDraft, options,
    step1CatalogView, setStep1CatalogView,
    setStep1FooterAction,
    goToStep, showCeilingInUi,
    lightingDiscountMode, lightingEffectiveTotal, lightingRegularTotal,
  } = useCalculatorModal();
  const hasCeilingContext = Boolean(showCeilingInUi || toNumber(snapshot?.total) > 0 || (snapshot?.roomBreakdown?.length ?? 0) > 0);

  /**
   * T-031: вкладка и режим каталога больше не синхронизируются эффектами.
   * Базовое значение выводится из `options` и `step1CatalogView` (общий контекст),
   * а ручной выбор пользователя хранится как override и сбрасывается, когда
   * меняется сам базис — то есть при новом открытии или переходе шага.
   */
  const baseTab = useMemo<Tab>(() => {
    if (step1CatalogView) return "catalog";
    if (options?.initialLightingTab === "catalog") return "catalog";
    if (options?.initialLightingTab === "recommendations") return "recommendations";
    return options?.entryMode === "lighting-first" ? "catalog" : "recommendations";
  }, [options?.entryMode, options?.initialLightingTab, step1CatalogView]);

  const baseCatalogView = useMemo<CatalogView>(() => {
    if (step1CatalogView) return step1CatalogView;
    return options?.initialLightingView === "selected" ? "selected" : "browse";
  }, [options?.initialLightingView, step1CatalogView]);

  const [tabOverride, setTabOverride] = useState<{ base: string; tab: Tab; view: CatalogView } | null>(null);
  const baseKey = `${baseTab}|${baseCatalogView}`;
  const override = tabOverride?.base === baseKey ? tabOverride : null;

  const activeTab = override?.tab ?? baseTab;
  const catalogView = override?.view ?? baseCatalogView;

  const setActiveTab = useCallback(
    (tab: Tab) => setTabOverride((prev) => ({
      base: baseKey,
      tab,
      view: prev?.base === baseKey ? prev.view : baseCatalogView,
    })),
    [baseCatalogView, baseKey]
  );

  const setCatalogView = useCallback(
    (view: CatalogView) => setTabOverride((prev) => ({
      base: baseKey,
      tab: prev?.base === baseKey ? prev.tab : baseTab,
      view,
    })),
    [baseKey, baseTab]
  );

  /* ─── Catalog filters ─── */
  const [section, setSection] = useState<CatalogSectionId>("track-systems");

  /**
   * T-043: «Люстры» и «Подсветка карниза» показываются только тем, кто ответил
   * «да» на Шаге 0 — остальным они лишний шум в и без того длинном каталоге.
   */
  const needsChandeliers = Boolean(snapshot?.derivedInputs?.chandeliersEnabled);
  const needsCorniceLighting = Boolean(snapshot?.derivedInputs?.corniceLightingEnabled);

  const shownCatalogSections = useMemo(
    () =>
      visibleCatalogSections({
        chandeliersEnabled: Boolean(snapshot?.derivedInputs?.chandeliersEnabled),
        corniceLightingEnabled: Boolean(snapshot?.derivedInputs?.corniceLightingEnabled),
      }),
    [snapshot?.derivedInputs?.chandeliersEnabled, snapshot?.derivedInputs?.corniceLightingEnabled]
  );
  const [trackSystem, setTrackSystem] = useState<TrackSystemId>("COLIBRI_220");
  const [trackGroup, setTrackGroup] = useState<TrackGroupId>("TRACK_FIXTURE");
  const [pointSubtype, setPointSubtype] = useState<PointSubtypeId>("GX53");
  const [lampSocket, setLampSocket] = useState<LampSocket>("GX53");
  const [query, setQuery] = useState("");

  /* ─── Cart state (T-031: общая корзина со страницей каталога) ─── */

  /* ─── Products index ─── */
  // T-029: каталог приезжает отдельным чанком, а не из фида в бандле.
  const { products: catalogProductsFromIndex } = useCatalogProducts();
  const products = catalogProductsFromIndex;

  const productsById = useMemo(() => buildProductsIndex(products), [products]);

  const productIdByVendorCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) { const vc = toText(p.vendorCode); const id = toText(p.productId); if (vc && id) m.set(vc, id); }
    return m;
  }, [products]);

  /**
   * T-031: единственный источник корзины — `lightingDraft` через общий хук.
   * Локального состояния и эффектов рехидратации/синхронизации больше нет:
   * позиции, добавленные на странице каталога, здесь уже на месте.
   */
  const resolveProduct = useCallback(
    (productId: string) => {
      const direct = productsById.get(productId);
      if (direct) return direct;
      // Черновик мог прийти со страницы каталога, где ключом был артикул.
      const byVendor = productIdByVendorCode.get(productId);
      return byVendor ? productsById.get(byVendor) : undefined;
    },
    [productIdByVendorCode, productsById]
  );
  const lightingCart = useLightingCart(resolveProduct);
  const cartItems = lightingCart.cart;
  // Стабильная ссылка — иначе каждый рендер пересоздаёт все зависимые колбэки.
  const setCartItems = lightingCart.update;

  /**
   * T-031: входящий `options.initialLighting` больше не переливается в корзину
   * эффектом — провайдер уже кладёт его в `lightingDraft` при открытии.
   * Здесь остаётся только вывести подсказку про снятые с продажи позиции.
   */
  const removedHint = useMemo(() => {
    const inc = options?.initialLighting;
    if (!inc || inc.mode !== "catalog") return false;
    return (inc.items ?? []).some((item) => {
      const product = resolveProduct(toText(item.sku));
      return !product || REMOVED_COLIBRI_VENDOR_CODES.has(toText(product.vendorCode));
    });
  }, [options?.initialLighting, resolveProduct]);

  /* ─── Derived cart data ─── */
  const cartEntries = useMemo(
    () => buildCartEntries(cartItems, resolveProduct),
    [cartItems, resolveProduct]
  );

  const selectedTrackMeters = useMemo(() => calcSelectedTrackMeters(cartEntries), [cartEntries]);
  const selectedPointQty = useMemo(() => calcSelectedPointQty(cartEntries), [cartEntries]);

  const requiredTrackMeters = showCeilingInUi ? toNumber(snapshot?.derivedInputs?.trackLengthMeters) : 0;
  const requiredPointQty = showCeilingInUi ? toNumber(snapshot?.derivedInputs?.pointSpotsQty) : 0;
  const trackMountType = (snapshot?.derivedInputs?.trackMountType ?? "none") as "built-in" | "surface" | "none";

  // T-010: шаги подбора, включая состояние "нет данных с Шага 0"
  type WStep = WizardStep;
  /**
   * T-031: шаг подбора и выбранная система выводятся из резолвера, а ручной
   * выбор живёт как override поверх него. Раньше это делали три эффекта с
   * `setState`, из-за чего экран мог «прыгать» лишним рендером.
   */
  const [wOverride, setWOverride] = useState<{ step: WStep; system: TrackSystemId | null } | null>(null);
  const setWStep = useCallback(
    (step: WStep) => setWOverride((prev) => ({ step, system: prev?.system ?? null })),
    []
  );
  const setWSystem = useCallback(
    (system: TrackSystemId | null) =>
      setWOverride((prev) => ({ step: prev?.step ?? "none", system })),
    []
  );
  const [wPointTab, setWPointTab] = useState<PointSubtypeId>("GX53");

  /* ─── Recommendations ─── */
  const recommendedTrackProfiles = useMemo(() => {
    if (!showCeilingInUi || requiredTrackMeters <= 0) return [];
    const targetSystems: TrackSystemId[] = trackMountType === "built-in" ? ["COLIBRI_220", "CLARUS_48"]
      : trackMountType === "surface" ? ["TRACK_220"] : [];
    return targetSystems.map((system) => {
      const base = TRACK_PROFILE_WHITELIST[system] ?? [];
      const allowed = system === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
      const profiles = products.filter((p) => p.kind === "TRACK_PROFILE" && p.system === system && p.priceRub > 0 && allowed.has(toText(p.vendorCode)));
      if (!profiles.length) return null;
      profiles.sort((a, b) => a.priceRub - b.priceRub);
      const best = profiles[0];
      const pieceM = inferPieceLengthMeters(best);
      if (!pieceM || pieceM <= 0) return null;
      const qty = Math.ceil(requiredTrackMeters / pieceM);
      return { product: best, system, qty, totalMeters: qty * pieceM };
    }).filter(Boolean) as Array<{ product: FeedCatalogProduct; system: TrackSystemId; qty: number; totalMeters: number }>;
  }, [showCeilingInUi, requiredTrackMeters, trackMountType, products]);

  const hasRecommendations = recommendedTrackProfiles.length > 0 || requiredPointQty > 0;

  /* ─── Lamps / mounts deps ─── */
  const lampOptionsBySocket = useMemo(() => groupLampOptionsBySocket(products), [products]);

  const lampRequiredBySocket = useMemo(() => calcLampRequiredBySocket(cartEntries), [cartEntries]);

  const lampCurrentBySocket = useMemo(
    () => calcLampCurrentBySocket(cartItems, lampOptionsBySocket),
    [cartItems, lampOptionsBySocket]
  );

  const mountRequiredByVendor = useMemo(() => {
    const required: Record<string, number> = {};
    for (const entry of cartEntries) {
      const mountVendor = POINT_TO_MOUNT_VENDOR_CODE[toText(entry.product.vendorCode)];
      if (mountVendor) required[mountVendor] = (required[mountVendor] ?? 0) + entry.qty;
    }
    return required;
  }, [cartEntries]);

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
    () => calcMissingMounts({ cartItems, productIdByVendorCode, productsById }),
    [cartItems, productIdByVendorCode, productsById]
  );

  const hasClarusInCart = useMemo(() => hasClarusInCartFn(cartEntries), [cartEntries]);
  const clarusPsuQty = useMemo(() => calcClarusPsuQty(cartEntries), [cartEntries]);

  /** Варианты БП для CLARUS; пусто — если блок уже выбран или CLARUS нет. */
  const clarusPsuOptions = useMemo(() => {
    if (!hasClarusInCart || clarusPsuQty >= 1) return [];
    return CLARUS_PSU_VENDOR_CODES.map((vendorCode) => {
      const productId = productIdByVendorCode.get(vendorCode);
      const product = productId ? productsById.get(productId) : undefined;
      return productId && product ? { productId, name: toText(product.name) } : null;
    }).filter((option): option is { productId: string; name: string } => option !== null);
  }, [hasClarusInCart, clarusPsuQty, productIdByVendorCode, productsById]);

  /* ─── T-024: трек выключен, но в корзине есть трековые позиции ───
   * Раньше эффект молча вычищал корзину. Если набор собран в каталоге
   * (lighting-first, origin: "page"), удалять нельзя — показываем предупреждение
   * и даём клиенту решить самому. */
  const isLightingFirst = options?.entryMode === "lighting-first";

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
    const ids = new Set(orphanTrackEntries.map((entry) => toText(entry.product.productId)));
    if (ids.size === 0) return;
    setCartItems((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of Object.keys(prev)) {
        if (ids.has(id)) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [orphanTrackEntries, setCartItems]);

  /**
   * N-051: чистим корзину только когда трек действительно «выключили» на
   * Шаге 0. Раньше условием был сам факт `requiredTrackMeters === 0`, и
   * автоочистка съедала позиции, которые клиент добавлял руками, — «+» на
   * трековом светильнике не работал без единого объяснения.
   *
   * Решение принимается внутри эффекта: прошлое значение метража живёт в ref,
   * а читать ref во время рендера нельзя.
   */
  const prevRequiredTrackMetersRef = useRef(requiredTrackMeters);

  useEffect(() => {
    const decision = decideOrphanTrackAction({
      requiredTrackMeters,
      previousRequiredTrackMeters: prevRequiredTrackMetersRef.current,
      orphanCount: orphanTrackCount,
      isLightingFirst,
    });
    prevRequiredTrackMetersRef.current = requiredTrackMeters;
    if (decision === "drop") dropOrphanTrackItems();
  }, [requiredTrackMeters, orphanTrackCount, isLightingFirst, dropOrphanTrackItems]);

  /**
   * Предупреждение показываем всегда, когда трековые позиции есть, а трек не
   * заказан: если их только что удалили автоматически, счётчик обнулится и
   * блок исчезнет сам.
   */
  const showOrphanTrackWarning = orphanTrackCount > 0 && requiredTrackMeters <= 0;

  // T-025: выбранная система трека
  const lastSystemRef = useRef<string>("");
  useEffect(() => {
    if (lastSystemRef.current === trackSystem) return;
    lastSystemRef.current = trackSystem;
    trackLightingSystemSelected({ system: trackSystem });
  }, [trackSystem]);

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
        setCartItems((prev) => ({
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
    setCartItems,
  ]);

  // T-031: единственная реализация — в lib/lighting/kit-rules.ts
  const clearIncompatibleSystem = useCallback(
    (next: CartItems, targetSystem: string) => {
      const cleaned = clearIncompatibleSystem_(next, targetSystem, resolveProduct);
      for (const key of Object.keys(next)) {
        if (!(key in cleaned)) delete next[key];
      }
    },
    [resolveProduct]
  );

  /* ─── setProductQty ─── */
  const setProductQty = useCallback((product: FeedCatalogProduct, nextQtyRaw: number) => {
    const id = toText(product.productId);
    const nextQty = normalizeQty(nextQtyRaw, product.unit);
    const prevQty = toNumber(cartItems[id]);
    if (prevQty !== nextQty) {
      trackLightingCartChanged({
        action: prevQty <= 0 && nextQty > 0 ? "add" : prevQty > 0 && nextQty <= 0 ? "remove" : "change",
        sku: id, productKind: String(product.kind), qty: nextQty, source: String(options?.source ?? "unknown"),
      });
    }
    setCartItems((prev) => {
      const n = { ...prev };
      if (nextQty <= 0) {
        delete n[id];
      } else {
        const system = product.system;
        if (system && isTrackSystemId(system)) {
          clearIncompatibleSystem(n, system);
        }
        const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);
        if (clarusPsuVendorCodes.has(toText(product.vendorCode))) {
          clearIncompatibleSystem(n, "CLARUS_48");
        }
        n[id] = nextQty;
      }
      return n;
    });
  }, [cartItems, options?.source, clearIncompatibleSystem, setCartItems]);

  const clearTrackProductsForSystem = useCallback((system: TrackSystemId | null) => {
    const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);

    setCartItems((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const id of Object.keys(prev)) {
        const product = productsById.get(id);
        if (!product) continue;

        const kind = product.kind;
        const isTrackProduct =
          kind === "TRACK_PROFILE" || kind === "TRACK_FIXTURE" || kind === "TRACK_ACCESSORY";
        const isClarusPsu = clarusPsuVendorCodes.has(toText(product.vendorCode));

        const shouldRemove =
          system === null
            ? isTrackProduct || isClarusPsu
            : (isTrackProduct && product.system !== system) || (isClarusPsu && system !== "CLARUS_48");

        if (shouldRemove) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [productsById, setCartItems]);

  const setTrackProfileQty = useCallback((product: FeedCatalogProduct, nextQtyRaw: number) => {
    const system = isTrackSystemId(product.system) ? product.system : null;
    if (!system) return;

    const id = toText(product.productId);
    const nextQty = normalizeQty(nextQtyRaw, product.unit);
    const prevQty = toNumber(cartItems[id]);

    setWSystem(system);

    if (prevQty !== nextQty) {
      trackLightingCartChanged({
        action: prevQty <= 0 && nextQty > 0 ? "add" : prevQty > 0 && nextQty <= 0 ? "remove" : "change",
        sku: id,
        productKind: String(product.kind),
        qty: nextQty,
        source: String(options?.source ?? "unknown"),
      });
    }

    const clarusPsuVendorCodes = new Set<string>(CLARUS_PSU_VENDOR_CODES);

    setCartItems((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(prev)) {
        const p = productsById.get(key);
        if (!p) continue;

        const isTrackProduct =
          p.kind === "TRACK_PROFILE" || p.kind === "TRACK_FIXTURE" || p.kind === "TRACK_ACCESSORY";
        const isClarusPsu = clarusPsuVendorCodes.has(toText(p.vendorCode));

        if ((isTrackProduct && p.system !== system) || (isClarusPsu && system !== "CLARUS_48")) {
          delete next[key];
        }
      }

      if (nextQty <= 0) delete next[id];
      else next[id] = nextQty;

      return next;
    });
  }, [cartItems, options?.source, productsById, setCartItems, setWSystem]);

  const addMountOneToOne = useCallback((fv: string) => {
    const mv = POINT_TO_MOUNT_VENDOR_CODE[toText(fv)]; if (!mv) return;
    const mid = productIdByVendorCode.get(mv); if (!mid) return;
    const rq = toNumber(mountRequiredByVendor[mv]); if (rq <= 0) return;
    setCartItems((prev) => ({ ...prev, [mid]: rq }));
  }, [mountRequiredByVendor, productIdByVendorCode, setCartItems]);

  const addCheapestLamps = useCallback((socket: LampSocket) => {
    const rq = toNumber(lampRequiredBySocket[socket]); if (rq <= 0) return;
    const c = toNumber(lampCurrentBySocket[socket]); const miss = Math.max(0, rq - c); if (miss <= 0) return;
    const cheapest = lampOptionsBySocket[socket][0]; if (!cheapest) return;
    const id = toText(cheapest.productId); if (!id) return;
    setCartItems((prev) => ({ ...prev, [id]: toNumber(prev[id]) + miss }));
  }, [lampRequiredBySocket, lampCurrentBySocket, lampOptionsBySocket, setCartItems]);

  const setClarusPsu = useCallback((pid: string) => {
    setCartItems((prev) => {
      const n = { ...prev };
      for (const v of CLARUS_PSU_VENDOR_CODES) { const id = productIdByVendorCode.get(v); if (id && id !== pid) delete n[id]; }
      n[pid] = Math.max(1, toNumber(n[pid])); return n;
    });
  }, [productIdByVendorCode, setCartItems]);

  /* ─── Navigation helpers ─── */
  const setCatalogViewAndSync = useCallback((view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  }, [setStep1CatalogView, setCatalogView]);

  /* ─── Selected view ─── */
  const selectedViewItems = useMemo(() =>
    cartEntries.map((e) => ({ product: e.product, item: { sku: toText(e.productId), name: toText(e.product.name), qty: e.qty, priceRub: toNumber(e.product.priceRub) } })),
    [cartEntries]);

  // Пустое «Выбранное» показывать нечем — молча показываем каталог.
  const shownCatalogView: CatalogView =
    catalogView === "selected" && selectedViewItems.length === 0 ? "browse" : catalogView;

  const selectedTotals = useMemo(() => {
    const regular = selectedViewItems.reduce((sum, x) => sum + x.item.qty * x.item.priceRub, 0);
    const standalone = applyLightingOnlyDiscount(regular);
    const withCeiling = applyLightingWithCeilingDiscount(regular);
    const effective = hasCeilingContext ? withCeiling : standalone;
    const effectivePercent = hasCeilingContext
      ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
      : LIGHTING_ONLY_DISCOUNT_PERCENT;
    return {
      regular,
      standalone,
      withCeiling,
      effective,
      effectivePercent,
      effectiveBenefit: Math.max(0, regular - effective),
      withCeilingBenefit: Math.max(0, regular - withCeiling),
    };
  }, [hasCeilingContext, selectedViewItems]);

  const cardDiscountPercent = hasCeilingContext
    ? LIGHTING_WITH_CEILING_DISCOUNT_PERCENT
    : LIGHTING_ONLY_DISCOUNT_PERCENT;

  /* ─── Image zoom state ─── */
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  /* ═══════════════════════════════════════════════════
     WIZARD (Подбор tab) — step-by-step guided flow
     ═══════════════════════════════════════════════════ */
  const rootRef = useRef<HTMLDivElement | null>(null);

  // T-010: стартовый экран пересчитывается резолвером, пока пользователь не тронул подбор.
  const wizardTouchedRef = useRef(false);
  const markWizardTouched = useCallback(() => {
    wizardTouchedRef.current = true;
  }, []);

  const chooseWizardSystem = useCallback((system: TrackSystemId) => {
    wizardTouchedRef.current = true;
    setWSystem(system);
    clearTrackProductsForSystem(system);
    setWStep("trackProfile");
  }, [clearTrackProductsForSystem, setWStep, setWSystem]);

  const chooseNoTrackFlow = useCallback(() => {
    wizardTouchedRef.current = true;
    setWSystem(null);
    clearTrackProductsForSystem(null);
    setWStep(requiredPointQty > 0 ? "points" : "done");
  }, [clearTrackProductsForSystem, requiredPointQty, setWStep, setWSystem]);

  const resolvedInitialStep = useMemo(
    () =>
      resolveInitialLightingStep({
        requiredTrackMeters,
        requiredPointQty,
        cart: {
          hasTrackProfile: cartEntries.some((e) => e.product.kind === "TRACK_PROFILE"),
          hasTrackFixture: cartEntries.some((e) => e.product.kind === "TRACK_FIXTURE"),
          hasPoints: cartEntries.some(
            (e) => e.product.kind === "SPOT_FIXTURE" || isPanelProduct(e.product)
          ),
          hasMissingLamps: missingLamps.length > 0,
          isEmpty: cartEntries.length === 0,
        },
      }),
    [cartEntries, missingLamps.length, requiredPointQty, requiredTrackMeters]
  );

  // Система, вычитанная из корзины: чем пользователь уже начал комплектоваться.
  const cartTrackSystem = useMemo<TrackSystemId | null>(() => {
    const trackEntry = cartEntries.find(
      (e) => e.product.kind === "TRACK_PROFILE" || e.product.kind === "TRACK_FIXTURE"
    );
    const system = trackEntry?.product.system;
    return isTrackSystemId(system ?? "") ? (system as TrackSystemId) : null;
  }, [cartEntries]);

  // Итоговые шаг и система: override пользователя поверх резолвера.
  const wStep: WStep = wOverride?.step ?? resolvedInitialStep;
  const wSystem: TrackSystemId | null =
    requiredTrackMeters > 0 ? (wOverride ? wOverride.system : cartTrackSystem) : null;

  // При смене внутреннего шага/таба пользователь всегда видит начало следующего действия.
  const didMountScrollRef = useRef(false);
  useEffect(() => {
    if (!didMountScrollRef.current) {
      didMountScrollRef.current = true;
      return;
    }

    const parent = getScrollParent(rootRef.current);
    parent?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, shownCatalogView, wStep]);

  useEffect(() => {
    if (!zoomImage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomImage(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomImage]);

  const systemLabel = (id: TrackSystemId) =>
    id === "COLIBRI_220" ? "COLIBRI 220V" : id === "CLARUS_48" ? "CLARUS 48V" : "ART 220V";

  const wizardSystemOptions = useMemo<TrackSystemId[]>(() => {
    if (requiredTrackMeters <= 0) return [];
    if (trackMountType === "built-in") return ["COLIBRI_220", "CLARUS_48"];
    if (trackMountType === "surface") return ["TRACK_220"];
    return ["COLIBRI_220", "CLARUS_48", "TRACK_220"];
  }, [requiredTrackMeters, trackMountType]);

  const selectedTrackSystem = useMemo<TrackSystemId | null>(() => {
    if (wSystem) return wSystem;

    const trackEntry = cartEntries.find((e) =>
      e.product.kind === "TRACK_PROFILE" || e.product.kind === "TRACK_FIXTURE" || e.product.kind === "TRACK_ACCESSORY"
    );

    const system = trackEntry?.product.system ?? "";
    return isTrackSystemId(system) ? system : null;
  }, [cartEntries, wSystem]);



  // Products for each wizard step
  const wTrackProfiles = useMemo(() => {
    const systems: TrackSystemId[] = selectedTrackSystem
      ? [selectedTrackSystem]
      : recommendedTrackProfiles.length > 0
        ? recommendedTrackProfiles.map((r) => r.system)
        : trackMountType === "built-in"
          ? ["COLIBRI_220", "CLARUS_48"]
          : trackMountType === "surface"
            ? ["TRACK_220"]
            : ["COLIBRI_220", "CLARUS_48", "TRACK_220"];

    const uniqueSystems = Array.from(new Set(systems));
    const result: FeedCatalogProduct[] = [];

    for (const sys of uniqueSystems) {
      const base = TRACK_PROFILE_WHITELIST[sys] ?? [];
      const allowed = sys === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
      result.push(
        ...products.filter((p) =>
          p.kind === "TRACK_PROFILE" &&
          p.system === sys &&
          p.priceRub > 0 &&
          allowed.has(toText(p.vendorCode))
        )
      );
    }

    return result.sort((a, b) => {
      const systemDiff = systemLabel(a.system as TrackSystemId).localeCompare(systemLabel(b.system as TrackSystemId), "ru");
      return systemDiff || a.priceRub - b.priceRub;
    });
  }, [products, recommendedTrackProfiles, selectedTrackSystem, trackMountType]);

  /* ─── T-032: автосборка профиля и ориентир по светильникам ─── */

  /** План автосборки под требуемый метраж из профилей выбранной системы. */
  const autoProfilePlan = useMemo(
    () => autoAssembleProfiles(requiredTrackMeters, wTrackProfiles),
    [requiredTrackMeters, wTrackProfiles]
  );

  /** Одним тапом кладём подобранные куски в корзину. */
  const applyAutoProfilePlan = useCallback(() => {
    if (!autoProfilePlan) return;

    markWizardTouched();
    const system = autoProfilePlan.pieces[0]?.product.system;
    if (system && isTrackSystemId(system)) setWSystem(system);

    setCartItems((prev) => {
      const next = { ...prev };
      for (const piece of autoProfilePlan.pieces) {
        next[toText(piece.product.productId)] = piece.qty;
      }
      return next;
    });
  }, [autoProfilePlan, markWizardTouched, setCartItems, setWSystem]);

  /** Товары для экранов T-043. */
  const wChandeliers = useMemo(
    () => products.filter((p) => p.kind === "CHANDELIER"),
    [products]
  );
  const wCorniceLighting = useMemo(
    () => products.filter((p) => p.kind === "LED_STRIP" || p.kind === "PSU" || p.kind === "CONTROL"),
    [products]
  );

  /* ─── T-042: дособирание комплекта (питание, стыки, БП, лампы) ─── */

  /** Чего не хватает выбранному свету, чтобы он заработал. */
  const kitCompletion = useMemo(
    () => completeKit(cartItems, resolveProduct, products),
    [cartItems, products, resolveProduct]
  );

  /** «Добавить всё» — кладём обязательные позиции одним действием. */
  const applyKitCompletion = useCallback(
    (suggestions: readonly { product: FeedCatalogProduct; qty: number }[]) => {
      if (suggestions.length === 0) return;
      markWizardTouched();
      setCartItems((prev) => {
        const next = { ...prev };
        for (const suggestion of suggestions) {
          const id = toText(suggestion.product.productId);
          next[id] = (next[id] ?? 0) + suggestion.qty;
        }
        return next;
      });
    },
    [markWizardTouched, setCartItems]
  );

  /**
   * T-042: CLARUS без блока питания не запустится. Не прячем кнопку совсем —
   * даём явно согласиться на «подберём при звонке», иначе счёт уедет неполным.
   */
  const [psuAcknowledged, setPsuAcknowledged] = useState(false);
  const psuBlocks = kitCompletion.psuMissing && !psuAcknowledged;

  /** Кнопка «К итогу» с учётом блокировки по БП. */
  const finishAction = useCallback(
    (): { label: string; disabled?: boolean; onClick: () => void } =>
      psuBlocks
        ? { label: "Нужен блок питания", disabled: true, onClick: () => undefined }
        : { label: "К итогу →", onClick: () => goToStep(2) },
    [goToStep, psuBlocks]
  );

  /** «Ориентир для 10 м: 8–12 светильников» — вилка ±20 %. */
  const fixturesHint = useMemo(
    () => fixturesHintForMeters(selectedTrackMeters || requiredTrackMeters, pricing.trackSpotsPerMeter),
    [requiredTrackMeters, selectedTrackMeters]
  );

  const wTrackFixtures = useMemo(() => {
    if (!selectedTrackSystem) return [];
    return products.filter((p) => p.kind === "TRACK_FIXTURE" && p.system === selectedTrackSystem && p.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
  }, [selectedTrackSystem, products]);

  const wPointProducts = useMemo(() => {
    return products.filter((p) => matchesPointSubtype(p, wPointTab) && p.priceRub > 0)
      .sort((a, b) => a.priceRub - b.priceRub);
  }, [wPointTab, products]);

  const wLampProducts = useMemo(() => {
    return lampOptionsBySocket; // use as-is, already sorted
  }, [lampOptionsBySocket]);

  // Point fixture progress by subtype
  const pointProgressBySubtype = useMemo(() => {
    const result: Record<PointSubtypeId, { current: number; required: number }> = {
      GX53: { current: 0, required: 0 },
      MR16: { current: 0, required: 0 },
      GU10: { current: 0, required: 0 },
      PANELS: { current: 0, required: 0 },
      OTHER: { current: 0, required: 0 },
    };
    for (const e of cartEntries) {
      if (e.product.kind === "SPOT_FIXTURE") {
        const s = detectSocket(e.product);
        if (s) result[s].current += e.qty;
        else if (!isPanelProduct(e.product)) result.OTHER.current += e.qty;
      }
      if (isPanelProduct(e.product)) result.PANELS.current += e.qty;
    }
    // Общий план по точкам показываем в общей липкой полосе; в табах — только факт выбора.
    if (requiredPointQty > 0) result.GX53.required = requiredPointQty;
    return result;
  }, [cartEntries, requiredPointQty]);

  const goAfterTrackProfile = useCallback(() => {
    if (requiredTrackMeters > 0 && (!selectedTrackSystem || selectedTrackMeters < requiredTrackMeters)) return;

    if (wTrackFixtures.length > 0) {
      setWStep("trackFixtures");
      return;
    }
    if (requiredPointQty > 0 && selectedPointQty < requiredPointQty) {
      setWStep("points");
      return;
    }
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    setWStep("done");
  }, [lampCurrentTotal, lampRequiredTotal, requiredPointQty, requiredTrackMeters, selectedPointQty, selectedTrackMeters, selectedTrackSystem, wTrackFixtures.length, setWStep]);

  const goAfterTrackFixtures = useCallback(() => {
    if (requiredPointQty > 0 && selectedPointQty < requiredPointQty) {
      setWStep("points");
      return;
    }
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    setWStep("done");
  }, [lampCurrentTotal, lampRequiredTotal, requiredPointQty, selectedPointQty, setWStep]);

  /** T-043: следующий экран после ламп — люстры, затем подсветка карниза. */
  const goAfterLamps = useCallback(() => {
    if (needsChandeliers) {
      setWStep("chandeliers");
      setSection("chandeliers");
      return;
    }
    if (needsCorniceLighting) {
      setWStep("corniceLighting");
      setSection("cornice-lighting");
      return;
    }
    setWStep("done");
  }, [needsChandeliers, needsCorniceLighting, setWStep]);

  const goAfterChandeliers = useCallback(() => {
    if (needsCorniceLighting) {
      setWStep("corniceLighting");
      setSection("cornice-lighting");
      return;
    }
    setWStep("done");
  }, [needsCorniceLighting, setWStep]);

  const goAfterPoints = useCallback(() => {
    if (lampRequiredTotal > 0 && lampCurrentTotal < lampRequiredTotal) {
      setWStep("lamps");
      return;
    }
    goAfterLamps();
  }, [goAfterLamps, lampCurrentTotal, lampRequiredTotal, setWStep]);

  const goBackFromLamps = useCallback(() => {
    if (requiredPointQty > 0) {
      setWStep("points");
      return;
    }
    if (selectedTrackSystem) {
      setWStep("trackFixtures");
      return;
    }
    if (requiredTrackMeters > 0) {
      setWStep("trackProfile");
      return;
    }
    setWStep("system");
  }, [requiredPointQty, requiredTrackMeters, selectedTrackSystem, setWStep]);


  const trackComplete = requiredTrackMeters <= 0 || selectedTrackMeters >= requiredTrackMeters;
  const pointsComplete = requiredPointQty <= 0 || selectedPointQty >= requiredPointQty;
  const lampsComplete = lampRequiredTotal <= 0 || lampCurrentTotal >= lampRequiredTotal;
  const requiredSelectionComplete = trackComplete && pointsComplete && lampsComplete;

  const missingTrackMeters = Math.max(0, requiredTrackMeters - selectedTrackMeters);
  const missingPointQty = Math.max(0, requiredPointQty - selectedPointQty);
  const missingLampQty = Math.max(0, lampRequiredTotal - lampCurrentTotal);

  const missingAction = useMemo(() => {
    if (missingTrackMeters > 0) {
      return { label: selectedTrackSystem ? "Добрать профиль →" : "Выбрать систему →", step: selectedTrackSystem ? "trackProfile" : "system" } as const;
    }
    if (missingPointQty > 0) return { label: "Выбрать точки →", step: "points" } as const;
    if (missingLampQty > 0) return { label: "Добавить лампы →", step: "lamps" } as const;
    return null;
  }, [missingLampQty, missingPointQty, missingTrackMeters, selectedTrackSystem]);

  const goToMissingAction = useCallback(() => {
    if (!missingAction) return;
    setActiveTab("recommendations");
    setCatalogViewAndSync("browse");
    setWStep(missingAction.step);
  }, [missingAction, setCatalogViewAndSync, setActiveTab, setWStep]);

  // «Готово» с незакрытыми требованиями — показываем недостающий шаг, а не тупик.
  // T-025: показ экрана мастера освещения (после того, как шаг посчитан).
  const lastWStepRef = useRef<string>("");
  useEffect(() => {
    if (lastWStepRef.current === wStep) return;
    lastWStepRef.current = wStep;
    trackLightingStepView({
      wstep: wStep,
      requiredTrackM: requiredTrackMeters,
      requiredPoints: requiredPointQty,
    });
  }, [wStep, requiredTrackMeters, requiredPointQty]);

  const shownWStep: WStep =
    wStep === "done" && !requiredSelectionComplete && missingAction ? missingAction.step : wStep;

  /**
   * N-050: выбор кнопки футера — чистая функция resolveStep1FooterAction,
   * здесь остаётся только привязка обработчиков к намерению.
   */
  const footerDescriptor = useMemo(
    () =>
      resolveStep1FooterAction({
        activeTab,
        shownWStep,
        hasMissingAction: Boolean(missingAction),
        hasSystemOptions: wizardSystemOptions.length > 0,
        psuBlocks,
        requiredSelectionComplete,
        requiredTrackMeters,
        hasTrackSystem: Boolean(selectedTrackSystem),
        trackComplete,
        pointsComplete,
        lampsComplete,
      }),
    [
      activeTab,
      lampsComplete,
      missingAction,
      pointsComplete,
      psuBlocks,
      requiredSelectionComplete,
      requiredTrackMeters,
      selectedTrackSystem,
      shownWStep,
      trackComplete,
      wizardSystemOptions.length,
    ]
  );

  useEffect(() => {
    const { intent, label, disabled } = footerDescriptor;

    if (intent === "missing") {
      setStep1FooterAction(
        missingAction
          ? { label: missingAction.label, onClick: goToMissingAction }
          : finishAction()
      );
      return () => setStep1FooterAction(null);
    }

    if (intent === "finish") {
      const base = finishAction();
      setStep1FooterAction(disabled === undefined ? base : { ...base, disabled });
      return () => setStep1FooterAction(null);
    }

    const handlers: Record<string, () => void> = {
      pickSystem: () => undefined,
      confirmTrackProfile: goAfterTrackProfile,
      confirmTrackFixtures: goAfterTrackFixtures,
      confirmPoints: goAfterPoints,
      confirmLamps: goAfterLamps,
      confirmChandeliers: goAfterChandeliers,
      confirmCornice: () => setWStep("done"),
    };

    setStep1FooterAction({
      label: label ?? "",
      disabled,
      onClick: handlers[intent] ?? (() => undefined),
    });

    return () => setStep1FooterAction(null);
  }, [
    finishAction,
    footerDescriptor,
    goAfterChandeliers,
    goAfterLamps,
    goAfterPoints,
    goAfterTrackFixtures,
    goAfterTrackProfile,
    goToMissingAction,
    missingAction,
    setStep1FooterAction,
    setWStep,
  ]);

  /* ─── Scoped catalog products ─── */
  const scopedProducts = useMemo(() => {
    let scoped: FeedCatalogProduct[] = [];
    if (shownCatalogView === "selected") { scoped = selectedViewItems.map((i) => i.product); }
    else if (section === "track-systems") {
      if (trackGroup === "TRACK_PROFILE") {
        const base = TRACK_PROFILE_WHITELIST[trackSystem] ?? [];
        const allowed = trackSystem === "TRACK_220" ? new Set([...base, ...ART_TRACK_PROFILE_VENDOR_WHITELIST]) : new Set(base);
        scoped = products.filter((p) => p.system === trackSystem && p.kind === "TRACK_PROFILE" && allowed.has(toText(p.vendorCode)));
      } else { scoped = products.filter((p) => p.system === trackSystem && p.kind === trackGroup); }
    } else if (section === "point-fixtures") { scoped = products.filter((p) => matchesPointSubtype(p, pointSubtype)); }
    else if (section === "chandeliers") { scoped = products.filter((p) => p.kind === "CHANDELIER"); }
    else if (section === "cornice-lighting") {
      // Для подсветки карниза нужны лента, питание и управление ей.
      scoped = products.filter(
        (p) => p.kind === "LED_STRIP" || p.kind === "PSU" || p.kind === "CONTROL"
      );
    }
    else if (section === "lamps") { scoped = products.filter((p) => isLamp(p) && detectSocket(p) === lampSocket); }
    else { scoped = products.filter(isMountsOrGrilles); }
    const q = toText(query).toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) => {
      const h = `${toText(p.name)} ${toText(p.vendorCode)} ${toText(p.categoryPath)} ${pickAttrs(p).map((a) => `${a.label} ${a.value}`).join(" ")}`.toLowerCase();
      return h.includes(q);
    });
  }, [shownCatalogView, lampSocket, pointSubtype, products, query, section, selectedViewItems, trackGroup, trackSystem]);

  // T-025: поиск по каталогу (дебаунс 800 мс внутри обёртки)
  useEffect(() => {
    const q = toText(query).trim();
    if (q.length < 2) return;
    trackLightingSearch({ q, section, results: scopedProducts.length });
  }, [query, section, scopedProducts.length]);

  /* ═══════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════ */
  return (
    <div ref={rootRef} className="space-y-4">

      {/* ─── Compact image preview — not fullscreen ─── */}
      <ImageQuickPreview image={zoomImage} onClose={() => setZoomImage(null)} />

      {/* ─── Tabs ─── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
        <TabBtn active={activeTab === "recommendations"} onClick={() => setActiveTab("recommendations")}>Подбор</TabBtn>
        <TabBtn active={activeTab === "catalog" && shownCatalogView === "browse"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}>Каталог</TabBtn>
        <TabBtn active={activeTab === "catalog" && shownCatalogView === "selected"} onClick={() => { setActiveTab("catalog"); setCatalogViewAndSync("selected"); }}>
          Выбранное ({selectedViewItems.length})
        </TabBtn>
      </div>

      {removedHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          Некоторые позиции удалены из ассортимента и автоматически убраны из выбранного.
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ПОДБОР — Guided Wizard
          ═══════════════════════════════════════════════ */}
      {activeTab === "recommendations" && (
        <div key="rec-tab" className="animate-fade-in space-y-4">

          {/* ─── STEP: Track System ─── */}
          {shownWStep === "none" && (
            <ManualPickScreen
              onOpenCatalog={() => { markWizardTouched(); setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}
              onSkipToSummary={() => goToStep(2)}
            />
          )}

          {shownWStep === "system" && (
            wizardSystemOptions.length > 0 ? (
              <TrackSystemScreen
                systems={wizardSystemOptions}
                trackMountType={trackMountType}
                systemLabel={systemLabel}
                showNoTrackOption={requiredPointQty > 0}
                onChoose={chooseWizardSystem}
                onNoTrack={chooseNoTrackFlow}
                onSkipToSummary={() => goToStep(2)}
              />
            ) : (
              <ManualPickScreen
                onOpenCatalog={() => { markWizardTouched(); setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}
                onSkipToSummary={() => goToStep(2)}
              />
            )
          )}

          {/* ─── STEP: Track Profiles ─── */}
          {shownWStep === "trackProfile" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-semibold text-emerald-950">
                  Профиль трека: {selectedTrackSystem ? systemLabel(selectedTrackSystem) : ""}
                </p>
                <p className="mt-1 text-xs text-emerald-800">Одно нажатие «+» добавляет 1 шт. Можно собрать профиль из разных длин.</p>
              </div>

              {/* T-032: автосборка под требуемый метраж одним тапом */}
              {autoProfilePlan && requiredTrackMeters > 0 && !trackComplete ? (
                <div className="rounded-2xl border border-slate-300 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    Собрать автоматически:{" "}
                    {autoProfilePlan.pieces
                      .map((piece) => `${fmtM(piece.pieceMeters)} м × ${piece.qty}`)
                      .join(" + ")}{" "}
                    = {fmt(autoProfilePlan.totalRub)} ₽
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    С потолком: {fmt(applyLightingWithCeilingDiscount(autoProfilePlan.totalRub))} ₽ · перекроет{" "}
                    {fmtM(autoProfilePlan.totalMeters)} м из {fmtM(requiredTrackMeters)} м
                  </p>
                  <button
                    type="button"
                    onClick={applyAutoProfilePlan}
                    className="mt-3 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Собрать автоматически
                  </button>
                  <p className="mt-2 text-xs text-slate-500">Ниже можно поправить количество вручную.</p>
                </div>
              ) : null}

              {/* T-042: чего не хватает комплекту — с обоснованием каждой строки */}
              {kitCompletion.mandatory.length > 0 ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-950">Комплектующие</p>
                  <p className="mt-1 text-xs text-amber-900">
                    Без этих позиций комплект не соберётся — добавил расчёт, количество можно поправить.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {kitCompletion.mandatory.map((item) => (
                      <li key={toText(item.product.productId)} className="text-xs text-amber-950">
                        <span className="font-semibold">
                          {toText(item.product.name)} × {item.qty}
                        </span>
                        <span className="block text-amber-800">{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => applyKitCompletion(kitCompletion.mandatory)}
                    className="mt-3 min-h-11 w-full rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Добавить всё
                  </button>

                  {kitCompletion.psuMissing ? (
                    <label className="mt-3 flex min-h-11 items-center gap-2 text-xs text-amber-950">
                      <input
                        type="checkbox"
                        checked={psuAcknowledged}
                        onChange={(e) => setPsuAcknowledged(e.target.checked)}
                        className="h-4 w-4 accent-amber-600"
                      />
                      Блок питания подберём при звонке — идти к итогу без него
                    </label>
                  ) : null}
                </div>
              ) : null}

              {kitCompletion.recommended.length > 0 ? (
                <div className="rounded-2xl border border-slate-300 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-950">Может пригодиться</p>
                  <ul className="mt-2 space-y-2">
                    {kitCompletion.recommended.map((item) => (
                      <li key={toText(item.product.productId)} className="text-xs text-slate-700">
                        <span className="font-semibold">
                          {toText(item.product.name)} × {item.qty}
                        </span>
                        <span className="block text-slate-600">{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => applyKitCompletion(kitCompletion.recommended)}
                    className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-900 hover:border-slate-500"
                  >
                    Добавить всё
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {wTrackProfiles.map((p) => {
                  const id = toText(p.productId);
                  const qty = toNumber(cartItems[id]);
                  return (
                    <ProductCard key={id} product={p} qty={qty}
                      onInc={() => setTrackProfileQty(p, qty + 1)}
                      onDec={() => setTrackProfileQty(p, qty - 1)}
                      onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setWStep("system")}
                  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  ← Система
                </button>
                <button
                  type="button"
                  onClick={goAfterTrackProfile}
                  disabled={requiredTrackMeters > 0 && (!selectedTrackSystem || !trackComplete)}
                  className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
                >
                  Подтвердить →
                </button>
              </div>
            </div>
          )}

          {/* T-043: экраны включаются ответами Шага 0 и идут после точечных */}
          {shownWStep === "chandeliers" && (
            <ProductPickerScreen
              title="Люстры"
              hint={`По расчёту нужно ${fmt(toNumber(snapshot?.derivedInputs?.chandeliersQty))} шт. Установка уже посчитана на Шаге 0 — здесь выбираем сами светильники.`}
              products={wChandeliers}
              cartItems={cartItems}
              onQtyChange={setProductQty}
              onZoom={setZoomImage}
              discountPercent={cardDiscountPercent}
              emptyText="Люстры сейчас не найдены в каталоге. Подберу вариант при звонке."
            />
          )}

          {shownWStep === "corniceLighting" && (
            <ProductPickerScreen
              title="Подсветка карниза"
              hint={`${fmtM(toNumber(snapshot?.derivedInputs?.corniceLightingMeters))} м по расчёту. Нужны лента, блок питания и управление.`}
              products={wCorniceLighting}
              cartItems={cartItems}
              onQtyChange={setProductQty}
              onZoom={setZoomImage}
              discountPercent={cardDiscountPercent}
              emptyText="Комплектующие для подсветки подберу при звонке."
            />
          )}

          {/* ─── STEP: Track Fixtures (spots for track) ─── */}
          {shownWStep === "trackFixtures" && (
            <ProductPickerScreen
              tone="accent"
              title={`Светильники для трека: ${selectedTrackSystem ? systemLabel(selectedTrackSystem) : ""}`}
              hint="Показываем все светильники выбранной системы."
              extraHint={
                fixturesHint
                  ? `Ориентир для ${fmtM(selectedTrackMeters || requiredTrackMeters)} м: ${fixturesHint.min}–${fixturesHint.max} светильников`
                  : undefined
              }
              products={wTrackFixtures}
              cartItems={cartItems}
              onQtyChange={setProductQty}
              onZoom={setZoomImage}
              discountPercent={cardDiscountPercent}
              emptyText="Нет светильников для этой системы."
              footer={
                <WizardFooter onBack={() => setWStep("trackProfile")} onNext={goAfterTrackFixtures} />
              }
            />
          )}

          {/* ─── STEP: Point Fixtures ─── */}
          {shownWStep === "points" && (
            <ProductPickerScreen
              tone="accent"
              title="Точечные светильники"
              hint="Выберите GX53, MR16 или панели."
              products={wPointProducts}
              cartItems={cartItems}
              onQtyChange={setProductQty}
              onZoom={setZoomImage}
              discountPercent={cardDiscountPercent}
              emptyText="Точечные светильники сейчас не найдены в каталоге. Подберу вариант при звонке."
              beforeGrid={
                <div className="flex gap-2">
                  {POINT_SUBTYPES.map((st) => (
                    <button key={st.id} type="button" onClick={() => setWPointTab(st.id)}
                      className={["rounded-xl px-3 py-1.5 text-xs font-medium",
                        wPointTab === st.id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"].join(" ")}>
                      {st.label}
                      {pointProgressBySubtype[st.id].current > 0 && (
                        <span className="ml-1 text-[10px] opacity-70">{pointProgressBySubtype[st.id].current} шт.</span>
                      )}
                    </button>
                  ))}
                </div>
              }
              footer={
                <WizardFooter
                  onBack={() => setWStep(selectedTrackSystem ? "trackFixtures" : requiredTrackMeters > 0 ? "trackProfile" : "system")}
                  onNext={goAfterPoints}
                  nextDisabled={!pointsComplete}
                />
              }
            />
          )}

          {/* ─── STEP: Lamps ─── */}
          {shownWStep === "lamps" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-950">Лампы к светильникам</p>
              </div>

              {lampSocketsToShow.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  Для выбранных светильников отдельные лампы не требуются.
                </div>
              ) : null}

              {lampSocketsToShow.map((socket) => {
                const required = toNumber(lampRequiredBySocket[socket]);
                const current = toNumber(lampCurrentBySocket[socket]);
                const missing = Math.max(0, required - current);

                return (
                  <div key={socket} className="space-y-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">Лампы {socket}</p>
                          <p className="text-xs text-slate-600">Нужно {fmt(required)} шт., выбрано {fmt(current)} шт.</p>
                        </div>
                        {missing > 0 ? (
                          <button
                            type="button"
                            onClick={() => addCheapestLamps(socket)}
                            className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            +{fmt(missing)} шт. доступных
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Готово</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <ThinProgress current={current} required={required} unit="шт." />
                      </div>
                    </div>

                    <ProductGrid
                      products={wLampProducts[socket] ?? []}
                      cartItems={cartItems}
                      onQtyChange={setProductQty}
                      onZoom={setZoomImage}
                      discountPercent={cardDiscountPercent}
                      emptyText="Подходящие лампы сейчас не найдены в каталоге. Я уточню вариант при звонке."
                    />
                  </div>
                );
              })}

              <WizardFooter onBack={goBackFromLamps} onNext={goAfterLamps} nextDisabled={!lampsComplete} />
            </div>
          )}

          {/* ─── STEP: Done ─── */}
          {shownWStep === "done" && requiredSelectionComplete && (
            <KitDoneScreen
              itemsCount={lightingDraft?.items?.length ?? 0}
              regularTotal={lightingRegularTotal}
              effectiveTotal={lightingEffectiveTotal}
              missingMounts={missingMounts}
              clarusPsuOptions={clarusPsuOptions}
              onAddMount={addMountOneToOne}
              onPickClarusPsu={setClarusPsu}
              onEditInCatalog={() => { setActiveTab("catalog"); setCatalogViewAndSync("browse"); }}
              onGoToSummary={() => goToStep(2)}
            />
          )}

          {shownWStep === "done" && !requiredSelectionComplete && missingAction ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Нужно ещё уточнить комплект</p>
              <p className="mt-1 text-amber-900/80">
                По параметрам потолка нужно добрать позиции. Верну к следующему действию автоматически.
              </p>
              <button
                type="button"
                onClick={goToMissingAction}
                className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
              >
                {missingAction.label}
              </button>
            </div>
          ) : null}

          {hasRecommendations && shownWStep !== "done" ? (
            <div className="text-center max-sm:hidden">
              <button type="button" onClick={() => setActiveTab("catalog")}
                className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800">
                Или выберите в каталоге →
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          КАТАЛОГ tab
          ═══════════════════════════════════════════════ */}
      {activeTab === "catalog" && (
        <div key="catalog-tab" className="animate-fade-in space-y-4">
          {/* Lamp reminder */}
          {missingLamps.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Не хватает ламп</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {missingLamps.map((m) => (
                  <button key={m.socket} type="button" onClick={() => addCheapestLamps(m.socket)}
                    className="rounded-xl bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800">
                    +{m.requiredQty - m.currentQty} ламп {m.socket}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showOrphanTrackWarning ? (
            <OrphanTrackNotice
              meters={orphanTrackMeters}
              isLightingFirst={isLightingFirst}
              onDrop={dropOrphanTrackItems}
            />
          ) : null}

          {shownCatalogView === "selected" && accessorySuggestions.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-950">Комплектующие</p>
              <p className="mt-1 text-xs text-amber-900">
                Это предложения — можно не добавлять или удалить позже.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {accessorySuggestions.map((suggestion) => (
                  <button
                    key={suggestion.key}
                    type="button"
                    onClick={() => { markWizardTouched(); suggestion.apply(); }}
                    className="min-h-11 rounded-2xl border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    {suggestion.title} ({fmt(suggestion.priceRub)} ₽)
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {shownCatalogView === "selected" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {selectedViewItems.length === 0 ? (
                <p className="text-sm text-slate-600">Пока ничего не выбрано.</p>
              ) : (
                <>
                  <ul className="space-y-3">
                    {selectedViewItems.map(({ item, product }) => {
                      const regular = item.priceRub;
                      const discounted = getDiscountedPrice(regular, selectedTotals.effectivePercent);
                      const productId = toText(product.productId);
                      return (
                        <li key={toText(item.sku)} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                            <ProductImage
                              productId={toText(product.productId)}
                              kind={toText(product.kind)}
                              src={toText(product.coverImage)}
                              alt={toText(product.name)}
                            />
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold text-slate-950">{toText(item.name)}</p>
                              <p className="mt-2 text-xs text-slate-700">
                                {item.qty} шт. · {fmt(regular)} ₽/шт · со скидкой −{selectedTotals.effectivePercent}%: {fmt(discounted)} ₽/шт
                              </p>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setProductQty(product, item.qty - (product.unit === "m" ? 0.5 : 1))}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                                  aria-label={`Уменьшить ${item.name}`}
                                >
                                  −
                                </button>
                                <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-950">
                                  {product.unit === "m" ? Number(item.qty.toFixed(1)) : item.qty} {product.unit === "m" ? "м" : "шт."}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setProductQty(product, item.qty + (product.unit === "m" ? 0.5 : 1))}
                                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                                  aria-label={`Увеличить ${item.name}`}
                                >
                                  +
                                </button>
                                <button type="button" onClick={() => setCartItems((prev) => { const n = { ...prev }; delete n[productId]; return n; })}
                                  aria-label={`Удалить ${item.name}`}
                                  className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">Удалить</button>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                    <p>Итого: <span className="line-through text-slate-400">{fmt(selectedTotals.regular)} ₽</span></p>
                    <p className="text-emerald-700">
                      Сейчас: {fmt(selectedTotals.effective)} ₽ · −{selectedTotals.effectivePercent}% (−{fmt(selectedTotals.effectiveBenefit)} ₽)
                    </p>
                    {lightingDiscountMode !== "with-ceiling" ? (
                      <p className="text-slate-500">
                        С потолком: {fmt(selectedTotals.withCeiling)} ₽ · −25% (−{fmt(selectedTotals.withCeilingBenefit)} ₽)
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      disabled={!requiredSelectionComplete}
                      className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700 max-sm:hidden"
                    >
                      К итогу →
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
                {shownCatalogSections.map((item) => (
                  <button key={item.id} type="button" onClick={() => { setSection(item.id); setQuery(""); }}
                    className={["whitespace-nowrap rounded-xl border border-slate-200 px-3 py-2 text-sm max-sm:px-2.5 max-sm:py-1.5 max-sm:text-xs",
                      section === item.id ? "bg-slate-950 text-white" : "bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>
                    {item.label}
                  </button>
                ))}
              </div>

              {section === "track-systems" && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
                  {TRACK_SYSTEMS.map((sys) => {
                    const isActive = trackSystem === sys.id;
                    const isRec = sys.id === "COLIBRI_220";
                    return (
                      <button key={sys.id} type="button" onClick={() => { setTrackSystem(sys.id); setQuery(""); }}
                        className={["whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs transition-colors max-sm:px-2.5",
                          isActive ? (isRec ? "bg-blue-600 text-white border-blue-600" : "bg-slate-900 text-white border-slate-900")
                          : (isRec ? "border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")].join(" ")}>
                        {sys.label}{isRec && !isActive ? <span className="ml-1 text-[10px] opacity-70">● рек.</span> : null}
                      </button>
                    );
                  })}
                  {TRACK_GROUPS.map((g) => (
                    <button key={g.id} type="button" onClick={() => { setTrackGroup(g.id); setQuery(""); }}
                      className={["whitespace-nowrap rounded-xl border border-slate-200 px-3 py-1.5 text-xs max-sm:px-2.5",
                        trackGroup === g.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {g.label}
                    </button>
                  ))}
                </div>
              )}

              {section === "point-fixtures" && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
                  {POINT_SUBTYPES.map((st) => (
                    <button key={st.id} type="button" onClick={() => { setPointSubtype(st.id); setQuery(""); }}
                      className={["whitespace-nowrap rounded-xl border border-slate-200 px-3 py-1.5 text-xs max-sm:px-2.5",
                        pointSubtype === st.id ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {st.label}
                    </button>
                  ))}
                </div>
              )}

              {section === "lamps" && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar max-sm:-mx-5 max-sm:px-5">
                  {(LAMP_SOCKETS).map((s) => (
                    <button key={s} type="button" onClick={() => { setLampSocket(s); setQuery(""); }}
                      className={["whitespace-nowrap rounded-xl border border-slate-200 px-3 py-1.5 text-xs max-sm:px-2.5",
                        lampSocket === s ? "bg-slate-900 text-white" : "bg-white text-slate-700"].join(" ")}>
                      {s} {lampCurrentBySocket[s] > 0 ? `(${lampCurrentBySocket[s]}/${lampRequiredBySocket[s]})` : ""}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                    <circle cx="9" cy="9" r="5.5" />
                    <path d="M13.5 13.5L17 17" strokeLinecap="round" />
                  </svg>
                </span>
                <input value={query} onChange={(e) => setQuery(e.target.value ?? "")}
                  placeholder="Поиск в текущем разделе"
                  className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" />
              </div>

              {/* T-044: режим скидки объявляем один раз над сеткой, а не в каждой карточке */}
              <div
                className={[
                  "rounded-2xl border px-4 py-3 text-sm font-semibold",
                  hasCeilingContext
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-slate-50 text-slate-800",
                ].join(" ")}
              >
                {hasCeilingContext
                  ? `Цены со скидкой −${LIGHTING_WITH_CEILING_DISCOUNT_PERCENT} % при заказе потолка`
                  : `Цены со скидкой −${LIGHTING_ONLY_DISCOUNT_PERCENT} % — только свет`}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {scopedProducts.map((p) => {
                  const id = toText(p.productId);
                  const qty = toNumber(cartItems[id]);
                  const step = p.unit === "m" ? 0.5 : 1;
                  return (
                    <ProductCard key={id} product={p} qty={qty}
                      onInc={() => setProductQty(p, qty + step)} onDec={() => setProductQty(p, qty - step)}
                      onImageClick={() => setZoomImage({ src: toText(p.coverImage), alt: toText(p.name) })}
                      discountPercent={cardDiscountPercent} />
                  );
                })}
              </div>

              {scopedProducts.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Ничего не найдено</div>
              )}
            </>
          )}
        </div>
      )}

    </div>
  );
}
