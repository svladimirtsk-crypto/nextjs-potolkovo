"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  trackLightingSearch,
  trackLightingStepView,
  trackLightingSystemSelected,
} from "@/lib/analytics";

import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { type WizardStep } from "@/lib/lighting/resolve-initial-step";
import { useCatalogProducts } from "@/lib/lighting/use-catalog-products";
import { useLightingCart } from "@/lib/lighting/use-lighting-cart";

import {
  visibleCatalogSections,
  REMOVED_COLIBRI_VENDOR_CODES,
  type TrackSystemId,
} from "@/lib/catalog-ui-config";

import { decideOrphanTrackAction } from "@/lib/lighting/orphan-track";
import { Step1CatalogTab } from "@/components/lighting/Step1CatalogTab";
// PT-018: чистые селекторы Шага 1 (B-F104) — правила выдачи каталога,
// профили/светильники/системы и итоги «Выбранного» вынесены из компонента.
import {
  buildTrackProfileRecommendations,
  calcSelectedTotals,
  cardDiscountPercentFor,
  scopeCatalogProducts,
} from "@/lib/lighting/step1-selectors";
import { Step1Recommendations } from "@/components/lighting/Step1Recommendations";
import { useCalculatorModal } from "./calculator-modal-context";
import { useCalculatorStore } from "@/lib/calculator/store";

/* ─── helpers ─── */


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
import { buildStep1FooterAction, resolveStep1FooterFromProgress } from "@/lib/lighting/step1-footer-action";
import { useStep1Cart } from "@/lib/lighting/use-step1-cart";
import { useStep1Wizard } from "@/lib/lighting/use-step1-wizard";
import { useStep1Screens } from "@/lib/lighting/use-step1-screens";
import { shownCatalogViewOf, useStep1Tabs } from "@/lib/lighting/use-step1-tabs";
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
   * T-031: вкладка и режим каталога не синхронизируются эффектами. Базис
   * выводится из `options` и `step1CatalogView` (общий контекст), ручной выбор
   * живёт оверрайдом и сбрасывается вместе с базисом — правила в
   * `lib/lighting/use-step1-tabs` (PT-018).
   */
  const { activeTab, catalogView, setActiveTab, setCatalogViewAndSync } = useStep1Tabs({
    step1CatalogView,
    setStep1CatalogView,
    initialLightingTab: options?.initialLightingTab,
    initialLightingView: options?.initialLightingView,
    entryMode: options?.entryMode,
  });

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

  /* ─── Корзина Шага 1: факты и действия (PT-018: `lib/lighting/use-step1-cart`) ───
   * Правила — в `cart-derived`, `kit-rules` и `orphan-track`; хук их только
   * собирает. Источник корзины один: `lightingDraft` через `useLightingCart`. */
  const step1Cart = useStep1Cart({
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
  const {
    cartEntries, selectedTrackMeters, selectedPointQty, selectedViewItems,
    lampRequiredBySocket, lampCurrentBySocket,
    lampRequiredTotal, lampCurrentTotal, missingLamps,
    accessorySuggestions, orphanTrackMeters, orphanTrackCount, showOrphanTrackWarning,
    dropOrphanTrackItems, setProductQty, clearTrackProductsForSystem, addCheapestLamps,
  } = step1Cart;

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

  /* ─── Мастер Шага 1: экран, переходы, прогресс (PT-018: `use-step1-wizard`) ───
   * Состояние оверрайда (`wOverride`) остаётся здесь: его сеттер нужен и
   * корзине — профиль выбирает систему. Правила переходов — `step1-progress`,
   * правила выдачи — `step1-selectors`. */
  const openRecommendations = useCallback(() => {
    setActiveTab("recommendations");
    setCatalogViewAndSync("browse");
  }, [setActiveTab, setCatalogViewAndSync]);

  /** Кнопки вкладки «Подбор»: открыть каталог и уйти на Шаг 2. */
  const openCatalogBrowse = useCallback(() => {
    setActiveTab("catalog");
    setCatalogViewAndSync("browse");
  }, [setActiveTab, setCatalogViewAndSync]);
  const goToSummary = useCallback(() => goToStep(2), [goToStep]);

  const wizard = useStep1Wizard({
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
  const {
    wStep, shownWStep, selectedTrackSystem, wizardSystemOptions,
    trackProfiles: wTrackProfiles, progress: step1Progress, footerHandlers,
    missingAction, requiredSelectionComplete, goToMissingAction,
  } = wizard;

  /* ─── Экраны подбора: товары и комплекты (PT-018: `use-step1-screens`) ─── */
  const screens = useStep1Screens({
    products,
    cartItems,
    updateCart: setCartItems,
    resolveProduct,
    cartEntries,
    requiredTrackMeters,
    requiredPointQty,
    selectedTrackMeters,
    trackProfiles: wTrackProfiles,
    setWSystem,
    goToStep,
  });
  const { psuBlocks, finishAction } = screens;

  /* ─── Selected view ─── */
  // Пустое «Выбранное» показывать нечем — молча показываем каталог.
  const shownCatalogView = shownCatalogViewOf(catalogView, selectedViewItems.length);

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
      resolveStep1FooterFromProgress({
        activeTab,
        shownWStep,
        missingAction,
        hasSystemOptions: wizardSystemOptions.length > 0,
        psuBlocks,
        requiredTrackMeters,
        hasTrackSystem: Boolean(selectedTrackSystem),
        progress: step1Progress,
      }),
    [activeTab, missingAction, psuBlocks, requiredTrackMeters, selectedTrackSystem,
      shownWStep, step1Progress, wizardSystemOptions.length]
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
        handlers: footerHandlers,
      })
    );
  }, [finishAction, footerDescriptor, footerHandlers, goToMissingAction, missingAction,
    setStep1FooterAction]);

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
        <Step1Recommendations
          cart={step1Cart}
          wizard={wizard}
          screens={screens}
          cartItems={cartItems}
          products={products}
          trackMountType={trackMountType}
          requiredTrackMeters={requiredTrackMeters}
          requiredPointQty={requiredPointQty}
          chandeliersQty={toNumber(snapshot?.derivedInputs?.chandeliersQty)}
          corniceMeters={toNumber(snapshot?.derivedInputs?.corniceLightingMeters)}
          hasRecommendations={hasRecommendations}
          draftItemsCount={lightingDraft?.items?.length ?? 0}
          regularTotal={lightingRegularTotal}
          effectiveTotal={lightingEffectiveTotal}
          cardDiscountPercent={cardDiscountPercent}
          onZoomImage={setZoomImage}
          onOpenCatalog={openCatalogBrowse}
          onGoToSummary={goToSummary}
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
