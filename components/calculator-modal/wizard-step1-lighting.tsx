"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  trackLightingSearch,
  trackLightingStepView,
  trackLightingSystemSelected,
} from "@/lib/analytics";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { applyLightingWithCeilingDiscount } from "@/lib/lighting-formulas";
import { detectSocket } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { type WizardStep } from "@/lib/lighting/resolve-initial-step";
import { pricing } from "@/content/pricing";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";
import {
  autoAssembleProfiles,
  completeKit,
  fixturesHintForMeters,
  isTrackSystemId,
} from "@/lib/lighting/kit-rules";

import {
  visibleCatalogSections,
  REMOVED_COLIBRI_VENDOR_CODES,
  type PointSubtypeId,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";

import { isPanelProduct } from "@/lib/lighting/product-predicates";
import { decideOrphanTrackAction } from "@/lib/lighting/orphan-track";
import { Step1CatalogTab } from "@/components/lighting/Step1CatalogTab";
// PT-018: чистые селекторы Шага 1 (B-F104) — правила выдачи каталога,
// профили/светильники/системы и итоги «Выбранного» вынесены из компонента.
import {
  buildTrackProfileRecommendations,
  calcSelectedTotals,
  cardDiscountPercentFor,
  scopeCatalogProducts,
  selectChandeliers,
  selectCorniceLighting,
  selectPointProducts,
  systemLabelOf,
} from "@/lib/lighting/step1-selectors";
import { RecommendationsTab } from "@/components/lighting/RecommendationsTab";
import { pointProgressBySocket, type PointKindId } from "@/lib/lighting/popular-points";
import { useCalculatorModal } from "./calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";

/* ─── helpers ─── */

type Tab = "recommendations" | "catalog";
type CatalogView = "selected" | "browse";

function fmt(v: number): string { return new Intl.NumberFormat("ru-RU").format(Math.round(v)); }
function fmtM(v: number): string { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(v); }








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

import { ImageQuickPreview, TabBtn } from "@/components/lighting/CatalogPieces";
import { buildStep1FooterAction, resolveStep1FooterAction } from "@/lib/lighting/step1-footer-action";
import { useStep1Cart } from "@/lib/lighting/use-step1-cart";
import { useStep1Wizard } from "@/lib/lighting/use-step1-wizard";
import { useCatalogFilters } from "@/lib/lighting/use-catalog-filters";
import { useCatalogIndex } from "@/lib/lighting/use-catalog-index";


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
  /**
   * N-051: фильтры каталога — тот же хук, что и на странице каталога.
   * Раньше здесь стояли шесть собственных useState, и правила сброса запроса
   * успели разойтись с оригиналом.
   */
  const catalogFilters = useCatalogFilters();
  const { section, trackSystem, trackGroup, pointSubtype, lampSocket, query } = catalogFilters;

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

  /* ─── Cart state (T-031: общая корзина со страницей каталога) ─── */

  /* ─── Products index ─── */
  // T-029: каталог приезжает отдельным чанком, а не из фида в бандле.
  const { products: catalogProductsFromIndex } = useCatalogProducts();
  const products = catalogProductsFromIndex;

  /**
   * N-051: индексы каталога — общий хук со страницей. Резолв понимает и
   * productId, и артикул: форматы в фиде разные, и черновик мог прийти
   * оттуда, где ключом был артикул.
   */
  const { byProductId: productsById, productIdByVendorCode, resolveProduct } =
    useCatalogIndex(products);

  /**
   * T-031: единственный источник корзины — `lightingDraft` через общий хук.
   * Локального состояния и эффектов рехидратации/синхронизации больше нет:
   * позиции, добавленные на странице каталога, здесь уже на месте.
   */
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
  /** N-021: выбранный тип светильника (вид, а не цоколь). */
  const [pointKind, setPointKind] = useState<PointKindId>("recessed");
  /** N-021: ручной выбор по цоколю свёрнут, пока человек не попросил. */
  const [manualPointsOpen, setManualPointsOpen] = useState(false);

  /* ─── Корзина Шага 1: факты и действия (PT-018: `lib/lighting/use-step1-cart`) ───
   * Правила — в `cart-derived`, `kit-rules` и `orphan-track`; хук их только
   * собирает. Источник корзины один: `lightingDraft` через `useLightingCart`. */
  const {
    cartEntries, selectedTrackMeters, selectedPointQty, selectedViewItems,
    lampOptionsBySocket, lampRequiredBySocket, lampCurrentBySocket, lampSocketsToShow,
    lampRequiredTotal, lampCurrentTotal, missingLamps, missingMounts, clarusPsuOptions,
    accessorySuggestions, orphanTrackMeters, orphanTrackCount, showOrphanTrackWarning,
    dropOrphanTrackItems, setProductQty, setTrackProfileQty, clearTrackProductsForSystem,
    addMountOneToOne, addCheapestLamps, setClarusPsu,
  } = useStep1Cart({
    cart: cartItems,
    updateCart: setCartItems,
    resolveProduct,
    productsById,
    productIdByVendorCode,
    products,
    source: options?.source,
    requiredTrackMeters,
    onTrackSystemPicked: setWSystem,
  });

  /* ─── Recommendations ─── */
  const recommendedTrackProfiles = useMemo(
    () =>
      buildTrackProfileRecommendations({
        showCeiling: showCeilingInUi,
        requiredTrackMeters,
        trackMountType,
        products,
      }),
    [showCeilingInUi, requiredTrackMeters, trackMountType, products]
  );

  const hasRecommendations = recommendedTrackProfiles.length > 0 || requiredPointQty > 0;

  /* ─── T-024: трек выключен, но в корзине есть трековые позиции ───
   * Раньше эффект молча вычищал корзину. Если набор собран в каталоге
   * (lighting-first, origin: "page"), удалять нельзя — показываем предупреждение
   * и даём клиенту решить самому. */
  const isLightingFirst = options?.entryMode === "lighting-first";

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

  // T-025: выбранная система трека
  const lastSystemRef = useRef<string>("");
  useEffect(() => {
    if (lastSystemRef.current === trackSystem) return;
    lastSystemRef.current = trackSystem;
    trackLightingSystemSelected({ system: trackSystem });
  }, [trackSystem]);

  /* ─── Navigation helpers ─── */
  const setCatalogViewAndSync = useCallback((view: CatalogView) => {
    setCatalogView(view);
    setStep1CatalogView(view);
  }, [setStep1CatalogView, setCatalogView]);

  /* ─── Мастер Шага 1: экран, переходы, прогресс (PT-018: `use-step1-wizard`) ───
   * Состояние оверрайда (`wOverride`) остаётся здесь: его сеттер нужен и
   * корзине — профиль выбирает систему. Правила переходов — `step1-progress`,
   * правила выдачи — `step1-selectors`. */
  const openRecommendations = useCallback(() => {
    setActiveTab("recommendations");
    setCatalogViewAndSync("browse");
  }, [setActiveTab, setCatalogViewAndSync]);

  const {
    wStep, shownWStep, selectedTrackSystem, wizardSystemOptions,
    trackProfiles: wTrackProfiles, trackFixtures: wTrackFixtures,
    trackComplete, pointsComplete, lampsComplete, requiredSelectionComplete,
    missingAction, chooseWizardSystem, chooseNoTrackFlow, goAfterTrackProfile,
    goAfterTrackFixtures, goAfterLamps, goAfterChandeliers, goAfterPoints,
    goBackFromLamps, goToMissingAction,
  } = useStep1Wizard({
    requiredTrackMeters,
    requiredPointQty,
    trackMountType,
    needsChandeliers,
    needsCorniceLighting,
    cartEntries,
    missingLampsCount: missingLamps.length,
    selectedTrackMeters,
    selectedPointQty,
    lampRequiredTotal,
    lampCurrentTotal,
    products,
    recommendedTrackProfiles,
    wOverride,
    setWStep,
    setWSystem,
    clearTrackProductsForSystem,
    onSelectCatalogSection: catalogFilters.selectSection,
    onOpenRecommendations: openRecommendations,
  });

  /* ─── Selected view ─── */
  // Пустое «Выбранное» показывать нечем — молча показываем каталог.
  const shownCatalogView: CatalogView =
    catalogView === "selected" && selectedViewItems.length === 0 ? "browse" : catalogView;

  const selectedTotals = useMemo(
    () => calcSelectedTotals(selectedViewItems, hasCeilingContext),
    [hasCeilingContext, selectedViewItems]
  );

  const cardDiscountPercent = cardDiscountPercentFor(hasCeilingContext);

  /* ─── Image zoom state ─── */
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  /* ═══════════════════════════════════════════════════
     WIZARD (Подбор tab) — step-by-step guided flow
     ═══════════════════════════════════════════════════ */
  const rootRef = useRef<HTMLDivElement | null>(null);

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




  /* ─── T-032: автосборка профиля и ориентир по светильникам ─── */

  /** План автосборки под требуемый метраж из профилей выбранной системы. */
  const autoProfilePlan = useMemo(
    () => autoAssembleProfiles(requiredTrackMeters, wTrackProfiles),
    [requiredTrackMeters, wTrackProfiles]
  );

  /** Одним тапом кладём подобранные куски в корзину. */
  const applyAutoProfilePlan = useCallback(() => {
    if (!autoProfilePlan) return;

    const system = autoProfilePlan.pieces[0]?.product.system;
    if (system && isTrackSystemId(system)) setWSystem(system);

    setCartItems((prev) => {
      const next = { ...prev };
      for (const piece of autoProfilePlan.pieces) {
        next[toText(piece.product.productId)] = piece.qty;
      }
      return next;
    });
  }, [autoProfilePlan, setCartItems, setWSystem]);

  /** Товары для экранов T-043. */
  const wChandeliers = useMemo(() => selectChandeliers(products), [products]);
  const wCorniceLighting = useMemo(() => selectCorniceLighting(products), [products]);

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
      setCartItems((prev) => {
        const next = { ...prev };
        for (const suggestion of suggestions) {
          const id = toText(suggestion.product.productId);
          next[id] = (next[id] ?? 0) + suggestion.qty;
        }
        return next;
      });
    },
    [setCartItems]
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


  /**
   * N-021: сетка следует за выбранным типом. Цоколь сужает её дальше, но
   * только когда человек сам открыл ручной выбор — иначе тип и цоколь
   * противоречили бы друг другу (панели не имеют цоколя вовсе).
   */
  const wPointProducts = useMemo(
    () =>
      selectPointProducts({
        products,
        manualOpen: manualPointsOpen,
        socketTab: wPointTab,
        pointKind,
      }),
    [manualPointsOpen, wPointTab, pointKind, products]
  );

  const wLampProducts = useMemo(() => {
    return lampOptionsBySocket; // use as-is, already sorted
  }, [lampOptionsBySocket]);

  const pointProgressBySubtype = useMemo(
    () => pointProgressBySocket(cartEntries, requiredPointQty, isPanelProduct, detectSocket),
    [cartEntries, requiredPointQty]
  );

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

  /**
   * N-050 · Публикация футера Шага 1 — в useLayoutEffect, как на Шаге 0.
   *
   * С useEffect подпись доставлялась после отрисовки, и один кадр экран с
   * кнопкой не совпадали. Отдельно важен убранный cleanup: React вызывает его
   * перед КАЖДЫМ повторным запуском эффекта, поэтому `setStep1FooterAction(null)`
   * успевал обнулить футер между шагами мастера — кнопка мигала и клик мог
   * промахнуться. Сброс теперь один, при размонтировании.
   */
  useLayoutEffect(() => {
    setStep1FooterAction(
      buildStep1FooterAction(footerDescriptor, {
        missingAction,
        goToMissingAction,
        finishAction,
        handlers: {
          pickSystem: () => undefined,
          confirmTrackProfile: goAfterTrackProfile,
          confirmTrackFixtures: goAfterTrackFixtures,
          confirmPoints: goAfterPoints,
          confirmLamps: goAfterLamps,
          confirmChandeliers: goAfterChandeliers,
          confirmCornice: () => setWStep("done"),
        },
      })
    );
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

  /** Шаг 1 ушёл с экрана — его кнопка не должна остаться в футере. */
  useEffect(() => () => setStep1FooterAction(null), [setStep1FooterAction]);

  /* ─── Scoped catalog products ─── */
  const scopedProducts = useMemo(
    () =>
      scopeCatalogProducts({
        products,
        selectedMode: shownCatalogView === "selected",
        selectedProducts: selectedViewItems.map((i) => i.product),
        section,
        trackSystem,
        trackGroup,
        pointSubtype,
        lampSocket,
        query,
      }),
    [shownCatalogView, lampSocket, pointSubtype, products, query, section, selectedViewItems, trackGroup, trackSystem]
  );

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
        <RecommendationsTab
          step={shownWStep}
          cart={{
            items: cartItems,
            onQtyChange: setProductQty,
            onZoom: setZoomImage,
            discountPercent: cardDiscountPercent,
          }}
          products={{
            all: products,
            trackProfiles: wTrackProfiles,
            trackFixtures: wTrackFixtures,
            chandeliers: wChandeliers,
            corniceLighting: wCorniceLighting,
            points: wPointProducts,
            lampsBySocket: wLampProducts,
          }}
          track={{
            systemOptions: wizardSystemOptions,
            mountType: trackMountType,
            selectedSystem: selectedTrackSystem,
            systemLabel: systemLabelOf,
            requiredMeters: requiredTrackMeters,
            selectedMeters: selectedTrackMeters,
            complete: trackComplete,
            fixturesHint,
            autoPlan:
              autoProfilePlan && requiredTrackMeters > 0 && !trackComplete
                ? {
                    pieces: autoProfilePlan.pieces,
                    totalRub: autoProfilePlan.totalRub,
                    discountedTotalRub: applyLightingWithCeilingDiscount(autoProfilePlan.totalRub),
                    totalMeters: autoProfilePlan.totalMeters,
                  }
                : null,
            onApplyAutoPlan: applyAutoProfilePlan,
            onChooseSystem: chooseWizardSystem,
            onNoTrack: chooseNoTrackFlow,
            onProfileQtyChange: setTrackProfileQty,
            onConfirmProfile: goAfterTrackProfile,
            onConfirmFixtures: goAfterTrackFixtures,
          }}
          completion={{
            mandatory: kitCompletion.mandatory,
            recommended: kitCompletion.recommended,
            psuMissing: kitCompletion.psuMissing,
            psuAcknowledged,
            onPsuAcknowledgedChange: setPsuAcknowledged,
            onAddMandatory: () => applyKitCompletion(kitCompletion.mandatory),
            onAddRecommended: () => applyKitCompletion(kitCompletion.recommended),
          }}
          points={{
            required: requiredPointQty,
            selected: selectedPointQty,
            activeKind: pointKind,
            onKindChange: (kind) => {
              setPointKind(kind);
              setManualPointsOpen(false);
            },
            manualOpen: manualPointsOpen,
            onManualOpen: () => setManualPointsOpen(true),
            socketTab: wPointTab,
            onSocketTabChange: setWPointTab,
            socketProgress: pointProgressBySubtype,
            complete: pointsComplete,
            onBack: () =>
              setWStep(
                selectedTrackSystem
                  ? "trackFixtures"
                  : requiredTrackMeters > 0
                    ? "trackProfile"
                    : "system"
              ),
            onConfirm: goAfterPoints,
          }}
          lamps={{
            sockets: lampSocketsToShow,
            requiredBySocket: lampRequiredBySocket,
            currentBySocket: lampCurrentBySocket,
            complete: lampsComplete,
            onAddCheapest: addCheapestLamps,
            onBack: goBackFromLamps,
            onConfirm: goAfterLamps,
          }}
          done={{
            itemsCount: lightingDraft?.items?.length ?? 0,
            regularTotal: lightingRegularTotal,
            effectiveTotal: lightingEffectiveTotal,
            missingMounts,
            clarusPsuOptions,
            onAddMount: addMountOneToOne,
            onPickClarusPsu: setClarusPsu,
            selectionComplete: requiredSelectionComplete,
            missingAction,
            onGoToMissingAction: goToMissingAction,
          }}
          nav={{
            chandeliersQty: toNumber(snapshot?.derivedInputs?.chandeliersQty),
            corniceMeters: toNumber(snapshot?.derivedInputs?.corniceLightingMeters),
            hasRecommendations,
            onOpenCatalog: () => {
              setActiveTab("catalog");
              setCatalogViewAndSync("browse");
            },
            onGoToSummary: () => goToStep(2),
            onBackToSystem: () => setWStep("system"),
            onBackToTrackProfile: () => setWStep("trackProfile"),
          }}
          fmt={fmt}
          fmtMeters={fmtM}
        />
      )}

      {/* ═══════════════════════════════════════════════
          КАТАЛОГ tab
          ═══════════════════════════════════════════════ */}
      {activeTab === "catalog" && (
        <Step1CatalogTab
          view={shownCatalogView}
          sections={shownCatalogSections}
          filters={catalogFilters}
          products={scopedProducts}
          cartItems={cartItems}
          hasCeilingContext={hasCeilingContext}
          cardDiscountPercent={cardDiscountPercent}
          fmt={fmt}
          onQtyChange={setProductQty}
          onRemoveProduct={lightingCart.remove}
          onZoom={setZoomImage}
          lamps={{
            missing: missingLamps,
            requiredBySocket: lampRequiredBySocket,
            currentBySocket: lampCurrentBySocket,
            onAddCheapest: addCheapestLamps,
          }}
          orphan={{
            show: showOrphanTrackWarning,
            meters: orphanTrackMeters,
            isLightingFirst,
            onDrop: dropOrphanTrackItems,
          }}
          suggestions={accessorySuggestions}
          selected={{
            items: selectedViewItems,
            totals: selectedTotals,
            showWithCeilingHint: lightingDiscountMode !== "with-ceiling",
            onGoToSummary: () => goToStep(2),
            goToSummaryDisabled: !requiredSelectionComplete,
          }}
        />
      )}

    </div>
  );
}
