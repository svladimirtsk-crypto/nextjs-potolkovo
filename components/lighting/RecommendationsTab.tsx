"use client";

/**
 * N-051 · Вкладка «Подбор» Шага 1.
 *
 * Девять экранов мастера, переключаемых по `step`. Каждый экран уже вынесен
 * в свой компонент — здесь остался только диспетчер: какой экран показать и
 * что ему передать.
 *
 * Пропы сгруппированы по смыслу (`cart`, `track`, `points`, `lamps`, `nav`),
 * а не свалены плоским списком: у плоского варианта их было бы под сорок, и
 * при вызове невозможно было бы понять, что к чему относится.
 */
import type { ReactNode } from "react";

import { ProductPickerScreen, WizardFooter } from "@/components/lighting/ProductPickerScreen";
import { PointsScreen } from "@/components/lighting/PointKindPicker";
import { TrackProfileStep, type KitCompletionItem } from "@/components/lighting/TrackProfileStep";
import {
  KitDoneScreen,
  LampsScreen,
  ManualPickScreen,
  TrackSystemScreen,
} from "@/components/lighting/Step1Screens";
import type { LampSocket, PointSubtypeId, TrackSystemId } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { AutoProfilePiece } from "@/lib/lighting/kit-rules";

/** Шаги мастера в порядке прохождения. */
export type WizardStepId =
  | "none"
  | "system"
  | "trackProfile"
  | "chandeliers"
  | "corniceLighting"
  | "trackFixtures"
  | "points"
  | "lamps"
  | "done";

export type RecommendationsTabProps = {
  step: WizardStepId;

  /** Общая корзина и оформление карточек. */
  cart: {
    items: Record<string, number>;
    onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
    onZoom: (image: { src: string; alt: string }) => void;
    discountPercent: number;
  };

  /** Каталог, разложенный по экранам. */
  products: {
    all: readonly FeedCatalogProduct[];
    trackProfiles: readonly FeedCatalogProduct[];
    trackFixtures: readonly FeedCatalogProduct[];
    chandeliers: readonly FeedCatalogProduct[];
    corniceLighting: readonly FeedCatalogProduct[];
    points: readonly FeedCatalogProduct[];
    lampsBySocket: Record<LampSocket, FeedCatalogProduct[]>;
  };

  track: {
    systemOptions: TrackSystemId[];
    mountType: "built-in" | "surface" | "none";
    selectedSystem: TrackSystemId | null;
    systemLabel: (id: TrackSystemId) => string;
    requiredMeters: number;
    selectedMeters: number;
    complete: boolean;
    fixturesHint: { min: number; max: number } | null;
    autoPlan: {
      pieces: AutoProfilePiece[];
      totalRub: number;
      discountedTotalRub: number;
      totalMeters: number;
    } | null;
    onApplyAutoPlan: () => void;
    onChooseSystem: (id: TrackSystemId) => void;
    onNoTrack: () => void;
    onProfileQtyChange: (product: FeedCatalogProduct, qty: number) => void;
    onConfirmProfile: () => void;
    onConfirmFixtures: () => void;
  };

  /** T-042: чего не хватает комплекту. */
  completion: {
    mandatory: KitCompletionItem[];
    recommended: KitCompletionItem[];
    psuMissing: boolean;
    psuAcknowledged: boolean;
    onPsuAcknowledgedChange: (value: boolean) => void;
    onAddMandatory: () => void;
    onAddRecommended: () => void;
  };

  points: {
    required: number;
    selected: number;
    activeKind: Parameters<typeof PointsScreen>[0]["activeKind"];
    onKindChange: Parameters<typeof PointsScreen>[0]["onKindChange"];
    manualOpen: boolean;
    onManualOpen: () => void;
    socketTab: PointSubtypeId;
    onSocketTabChange: (tab: PointSubtypeId) => void;
    socketProgress: Parameters<typeof PointsScreen>[0]["socketProgress"];
    complete: boolean;
    onBack: () => void;
    onConfirm: () => void;
  };

  lamps: {
    sockets: LampSocket[];
    requiredBySocket: Record<LampSocket, number>;
    currentBySocket: Record<LampSocket, number>;
    complete: boolean;
    onAddCheapest: (socket: LampSocket) => void;
    onBack: () => void;
    onConfirm: () => void;
  };

  /** Экран «готово» и его подсказки. */
  done: {
    itemsCount: number;
    regularTotal: number;
    effectiveTotal: number;
    missingMounts: Parameters<typeof KitDoneScreen>[0]["missingMounts"];
    clarusPsuOptions: Parameters<typeof KitDoneScreen>[0]["clarusPsuOptions"];
    onAddMount: Parameters<typeof KitDoneScreen>[0]["onAddMount"];
    onPickClarusPsu: (productId: string) => void;
    selectionComplete: boolean;
    missingAction: { label: string } | null;
    onGoToMissingAction: () => void;
  };

  nav: {
    chandeliersQty: number;
    corniceMeters: number;
    hasRecommendations: boolean;
    onOpenCatalog: () => void;
    onOpenCatalogTouched: () => void;
    onGoToSummary: () => void;
    onBackToSystem: () => void;
    onBackToTrackProfile: () => void;
  };

  /** Форматирование чисел задаёт оркестратор — оно общее с остальным Шагом 1. */
  fmt: (value: number) => string;
  fmtMeters: (value: number) => string;
};

export function RecommendationsTab({
  step,
  cart,
  products,
  track,
  completion,
  points,
  lamps,
  done,
  nav,
  fmt,
  fmtMeters,
}: RecommendationsTabProps) {
  const manualPick: ReactNode = (
    <ManualPickScreen
      onOpenCatalog={nav.onOpenCatalogTouched}
      onSkipToSummary={nav.onGoToSummary}
    />
  );

  return (
    <div key="rec-tab" className="animate-fade-in space-y-4">
      {step === "none" ? manualPick : null}

      {step === "system"
        ? track.systemOptions.length > 0
          ? (
              <TrackSystemScreen
                systems={track.systemOptions}
                trackMountType={track.mountType}
                systemLabel={track.systemLabel}
                showNoTrackOption={points.required > 0}
                onChoose={track.onChooseSystem}
                onNoTrack={track.onNoTrack}
                onSkipToSummary={nav.onGoToSummary}
              />
            )
          : manualPick
        : null}

      {step === "trackProfile" ? (
        <TrackProfileStep
          systemLabel={track.selectedSystem ? track.systemLabel(track.selectedSystem) : ""}
          products={products.trackProfiles}
          cartItems={cart.items}
          onQtyChange={track.onProfileQtyChange}
          onZoom={cart.onZoom}
          discountPercent={cart.discountPercent}
          autoPlan={track.autoPlan}
          requiredMeters={track.requiredMeters}
          onApplyAutoPlan={track.onApplyAutoPlan}
          mandatory={completion.mandatory}
          recommended={completion.recommended}
          psuMissing={completion.psuMissing}
          psuAcknowledged={completion.psuAcknowledged}
          onPsuAcknowledgedChange={completion.onPsuAcknowledgedChange}
          onAddMandatory={completion.onAddMandatory}
          onAddRecommended={completion.onAddRecommended}
          onBack={nav.onBackToSystem}
          onNext={track.onConfirmProfile}
          nextDisabled={track.requiredMeters > 0 && (!track.selectedSystem || !track.complete)}
        />
      ) : null}

      {step === "chandeliers" ? (
        <ProductPickerScreen
          title="Люстры"
          hint={`По расчёту нужно ${fmt(nav.chandeliersQty)} шт. Установка уже посчитана на Шаге 0 — здесь выбираем сами светильники.`}
          products={products.chandeliers}
          cartItems={cart.items}
          onQtyChange={cart.onQtyChange}
          onZoom={cart.onZoom}
          discountPercent={cart.discountPercent}
          emptyText="Люстры сейчас не найдены в каталоге. Подберу вариант при звонке."
        />
      ) : null}

      {step === "corniceLighting" ? (
        <ProductPickerScreen
          title="Подсветка карниза"
          hint={`${fmtMeters(nav.corniceMeters)} м по расчёту. Нужны лента, блок питания и управление.`}
          products={products.corniceLighting}
          cartItems={cart.items}
          onQtyChange={cart.onQtyChange}
          onZoom={cart.onZoom}
          discountPercent={cart.discountPercent}
          emptyText="Комплектующие для подсветки подберу при звонке."
        />
      ) : null}

      {step === "trackFixtures" ? (
        <ProductPickerScreen
          tone="accent"
          title={`Светильники для трека: ${track.selectedSystem ? track.systemLabel(track.selectedSystem) : ""}`}
          hint="Показываем все светильники выбранной системы."
          extraHint={
            track.fixturesHint
              ? `Ориентир для ${fmtMeters(track.selectedMeters || track.requiredMeters)} м: ${track.fixturesHint.min}–${track.fixturesHint.max} светильников`
              : undefined
          }
          products={products.trackFixtures}
          cartItems={cart.items}
          onQtyChange={cart.onQtyChange}
          onZoom={cart.onZoom}
          discountPercent={cart.discountPercent}
          emptyText="Нет светильников для этой системы."
          footer={
            <WizardFooter onBack={nav.onBackToTrackProfile} onNext={track.onConfirmFixtures} />
          }
        />
      ) : null}

      {step === "points" ? (
        <PointsScreen
          products={products.all}
          gridProducts={products.points}
          required={points.required}
          current={points.selected}
          cartItems={cart.items}
          onQtyChange={cart.onQtyChange}
          onZoom={cart.onZoom}
          discountPercent={cart.discountPercent}
          activeKind={points.activeKind}
          onKindChange={points.onKindChange}
          manualOpen={points.manualOpen}
          onManualOpen={points.onManualOpen}
          socketTab={points.socketTab}
          onSocketTabChange={points.onSocketTabChange}
          socketProgress={points.socketProgress}
          footer={
            <WizardFooter
              onBack={points.onBack}
              onNext={points.onConfirm}
              nextDisabled={!points.complete}
            />
          }
        />
      ) : null}

      {step === "lamps" ? (
        <LampsScreen
          sockets={lamps.sockets}
          requiredBySocket={lamps.requiredBySocket}
          currentBySocket={lamps.currentBySocket}
          productsBySocket={products.lampsBySocket}
          cartItems={cart.items}
          discountPercent={cart.discountPercent}
          onAddCheapest={lamps.onAddCheapest}
          onQtyChange={cart.onQtyChange}
          onZoom={cart.onZoom}
          footer={
            <WizardFooter
              onBack={lamps.onBack}
              onNext={lamps.onConfirm}
              nextDisabled={!lamps.complete}
            />
          }
        />
      ) : null}

      {step === "done" && done.selectionComplete ? (
        <KitDoneScreen
          itemsCount={done.itemsCount}
          regularTotal={done.regularTotal}
          effectiveTotal={done.effectiveTotal}
          missingMounts={done.missingMounts}
          clarusPsuOptions={done.clarusPsuOptions}
          onAddMount={done.onAddMount}
          onPickClarusPsu={done.onPickClarusPsu}
          onEditInCatalog={nav.onOpenCatalog}
          onGoToSummary={nav.onGoToSummary}
        />
      ) : null}

      {step === "done" && !done.selectionComplete && done.missingAction ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Нужно ещё уточнить комплект</p>
          <p className="mt-1 text-amber-900/80">
            По параметрам потолка нужно добрать позиции. Верну к следующему действию автоматически.
          </p>
          <button
            type="button"
            onClick={done.onGoToMissingAction}
            className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            {done.missingAction.label}
          </button>
        </div>
      ) : null}

      {nav.hasRecommendations && step !== "done" ? (
        <div className="text-center max-sm:hidden">
          <button
            type="button"
            onClick={nav.onOpenCatalog}
            className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
          >
            Или выберите в каталоге →
          </button>
        </div>
      ) : null}
    </div>
  );
}
