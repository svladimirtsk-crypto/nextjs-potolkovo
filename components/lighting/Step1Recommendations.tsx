"use client";

/**
 * PT-018 (B-F104) · Проводка вкладки «Подбор» Шага 1 «Свет».
 *
 * `RecommendationsTab` принимает сорок с лишним значений, сгруппированных в
 * восемь блоков (`cart`, `products`, `track`, `completion`, `points`, `lamps`,
 * `done`, `nav`). Собирать их прямо в оркестраторе значило держать там сто
 * строк чистого перекладывания пропсов — ровно то, что мешает увидеть в файле
 * сам Шаг 1.
 *
 * Здесь нет ни состояния, ни эффектов, ни правил: компонент берёт готовые
 * объекты трёх хуков (`useStep1Cart`, `useStep1Wizard`, `useStep1Screens`) и
 * раскладывает их по блокам пропсов. Правила — в `lib/lighting/*`, разметка
 * экранов — в `RecommendationsTab`.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { applyLightingWithCeilingDiscount } from "@/lib/lighting-formulas";
import { systemLabelOf } from "@/lib/lighting/step1-selectors";
import type { useStep1Cart } from "@/lib/lighting/use-step1-cart";
import type { useStep1Screens } from "@/lib/lighting/use-step1-screens";
import type { useStep1Wizard } from "@/lib/lighting/use-step1-wizard";

import { RecommendationsTab } from "@/components/lighting/RecommendationsTab";

export type Step1RecommendationsProps = {
  /** Факты корзины и действия над ней (`lib/lighting/use-step1-cart`). */
  cart: ReturnType<typeof useStep1Cart>;
  /** Экран мастера, переходы и прогресс (`lib/lighting/use-step1-wizard`). */
  wizard: ReturnType<typeof useStep1Wizard>;
  /** Товары экранов и комплекты (`lib/lighting/use-step1-screens`). */
  screens: ReturnType<typeof useStep1Screens>;

  /** Корзина как есть: `Record<productId, qty>`. */
  cartItems: Record<string, number>;
  /** Весь каталог — экраны выбирают из него сами. */
  products: readonly FeedCatalogProduct[];

  /* Требования Шага 0 и производные от черновика суммы. */
  trackMountType: "built-in" | "surface" | "none";
  requiredTrackMeters: number;
  requiredPointQty: number;
  chandeliersQty: number;
  corniceMeters: number;
  hasRecommendations: boolean;
  draftItemsCount: number;
  regularTotal: number;
  effectiveTotal: number;
  cardDiscountPercent: number;

  onZoomImage: (image: { src: string; alt: string }) => void;
  onOpenCatalog: () => void;
  onGoToSummary: () => void;
  fmt: (value: number) => string;
  fmtMeters: (value: number) => string;
};

export function Step1Recommendations(props: Step1RecommendationsProps) {
  const {
    cart, wizard, screens, cartItems, products,
    trackMountType, requiredTrackMeters, requiredPointQty,
    chandeliersQty, corniceMeters, hasRecommendations, draftItemsCount,
    regularTotal, effectiveTotal, cardDiscountPercent,
    onZoomImage, onOpenCatalog, onGoToSummary, fmt, fmtMeters,
  } = props;

  const {
    shownWStep, selectedTrackSystem, wizardSystemOptions,
    trackProfiles: wTrackProfiles, trackFixtures: wTrackFixtures,
    trackComplete, pointsComplete, lampsComplete, requiredSelectionComplete,
    missingAction, chooseWizardSystem, chooseNoTrackFlow,
    goAfterTrackProfile, goAfterTrackFixtures, goAfterPoints, goAfterLamps,
    goBackFromLamps, goBackFromPoints, goToMissingAction, goToSystem, goToTrackProfile,
  } = wizard;

  const {
    pointKind, choosePointKind, manualPointsOpen, openManualPoints,
    pointTab: wPointTab, setPointTab: setWPointTab,
    pointProducts: wPointProducts, pointProgressBySubtype,
    autoProfilePlan, applyAutoProfilePlan, fixturesHint,
    kitCompletion, applyKitCompletion, psuAcknowledged, setPsuAcknowledged,
    chandeliers: wChandeliers, corniceLighting: wCorniceLighting,
  } = screens;

  const {
    selectedTrackMeters, selectedPointQty, lampOptionsBySocket,
    lampRequiredBySocket, lampCurrentBySocket, lampSocketsToShow,
    missingMounts, clarusPsuOptions, setProductQty, setTrackProfileQty,
    addMountOneToOne, addCheapestLamps, setClarusPsu,
  } = cart;

  return (
      <RecommendationsTab
        step={shownWStep}
        cart={{
          items: cartItems,
          onQtyChange: setProductQty,
          onZoom: onZoomImage,
          discountPercent: cardDiscountPercent,
        }}
        products={{
          all: products,
          trackProfiles: wTrackProfiles,
          trackFixtures: wTrackFixtures,
          chandeliers: wChandeliers,
          corniceLighting: wCorniceLighting,
          points: wPointProducts,
          lampsBySocket: lampOptionsBySocket,
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
          onKindChange: choosePointKind,
          manualOpen: manualPointsOpen,
          onManualOpen: openManualPoints,
          socketTab: wPointTab,
          onSocketTabChange: setWPointTab,
          socketProgress: pointProgressBySubtype,
          complete: pointsComplete,
          onBack: goBackFromPoints,
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
          itemsCount: draftItemsCount,
          regularTotal,
          effectiveTotal,
          missingMounts,
          clarusPsuOptions,
          onAddMount: addMountOneToOne,
          onPickClarusPsu: setClarusPsu,
          selectionComplete: requiredSelectionComplete,
          missingAction,
          onGoToMissingAction: goToMissingAction,
        }}
        nav={{
          chandeliersQty,
          corniceMeters,
          hasRecommendations,
          onOpenCatalog,
          onGoToSummary,
          onBackToSystem: goToSystem,
          onBackToTrackProfile: goToTrackProfile,
        }}
        fmt={fmt}
        fmtMeters={fmtMeters}
      />
  );
}
