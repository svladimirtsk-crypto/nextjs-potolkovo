// components/calculator-modal/calculator-modal.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { WizardStep } from "@/lib/calculator-modal-types";
import { isSnapshotValid } from "@/lib/calculator-snapshot-guard";
import {
  trackWizardStepView,
  trackWizardConfirm,
} from "@/lib/analytics";
// ← NEW
import {
  calcRequiredWorksFromLighting,
} from "@/lib/lighting-formulas";

import { useCalculatorModal } from "./calculator-modal-context";
import { usePriceCalculatorBridge } from "@/components/home/price-calculator-context";
import { scrollToAnchorTarget } from "@/lib/scroll-to-anchor";
import { PriceStrip } from "./price-strip";
import { WizardStep0Calculator } from "./wizard-step0-calculator";
import { WizardStep1Lighting } from "./wizard-step1-lighting";
import { WizardStep2Summary } from "./wizard-step2-summary";

// ... getFocusableElements не меняем ...

export function CalculatorModal() {
  const {
    isOpen,
    currentStep,
    closeCalculator,
    goToStep,
    options,
    lightingDraft,
    lightingDiscountedTotal,
  } = useCalculatorModal();

  const { snapshot, setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  // ... refs и useState не меняем ...

  // ← NEW: wizard_step_view событие
  useEffect(() => {
    if (!isOpen) return;
    trackWizardStepView(currentStep, options?.source);
  }, [isOpen, currentStep]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  const shouldApplyPreset =
    options?.preset && (!snapshot || options.forcePreset === true);
  const activePreset = shouldApplyPreset ? options?.preset : undefined;

  const snapshotValid  = isSnapshotValid(snapshot);
  const isNextDisabled = currentStep < 2 && !snapshotValid;

  const stepTitle = useMemo(() => {
    if (currentStep === 1) {
      const hasLight =
        lightingDraft &&
        lightingDraft.mode !== "none" &&
        (lightingDraft.items?.length ?? 0) > 0;
      return hasLight ? "Освещение ✓" : "Освещение";
    }
    const titles: Record<WizardStep, string> = {
      0: "Параметры потолка",
      1: "Освещение",
      2: "Итог расчёта",
    };
    return titles[currentStep];
  }, [currentStep, lightingDraft]);

  // ... useEffect для overflow, focus, keydown не меняем ...

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) closeCalculator();
    },
    [closeCalculator]
  );

  // ← ОБНОВЛЕННЫЙ handleConfirm с reconcile логикой
  const handleConfirm = useCallback(() => {
    if (snapshot) {
      const computedGrandTotal = snapshot.total + (lightingDiscountedTotal ?? 0);

      // ── Reconcile: проверяем требуемые работы ──────────────────────
      const { requiredLightsCount, requiredTrackLength } =
        calcRequiredWorksFromLighting(lightingDraft?.items);

      // ──決定: автоматически синхронизируем работы ──────────────────
      let updatedSnapshot = { ...snapshot };

      if (requiredLightsCount !== null && requiredLightsCount !== snapshot.lightsCount) {
        // Обновляем lightsCount и пересчитываем lightsTotal
        updatedSnapshot.lightsCount = requiredLightsCount;
        updatedSnapshot.lightsTotal = requiredLightsCount * snapshot.lightsRatePerUnit;
        console.log(
          `[Reconcile] lightsCount: ${snapshot.lightsCount} → ${requiredLightsCount}`
        );
      }

      // Если был трек-профиль в товарах, но trackLength = 0 (не заполнен),
      // можем предложить стандартное значение (опционально)
      // Пока оставляем как есть — trackLength не меняем

      // ── Пересчитываем итоговую сумму с учётом обновленных работ ──
      const updatedTotal =
        updatedSnapshot.ceilingBaseTotal +
        updatedSnapshot.ceilingExtraTotal +
        updatedSnapshot.lightLinesTotal +
        updatedSnapshot.corniceTotal +
        updatedSnapshot.trackTotal +
        updatedSnapshot.lightsTotal; // ← может измениться

      updatedSnapshot.total = updatedTotal;
      const updatedGrandTotal = updatedTotal + (lightingDiscountedTotal ?? 0);

      setSnapshot({
        ...updatedSnapshot,
        lighting:   lightingDraft ?? undefined,
        grandTotal: updatedGrandTotal,
        leadSource: snapshot.leadSource,
      });
    }

    setHasInteracted(true);

    // ← NEW: wizard_confirm событие
    trackWizardConfirm(options?.source ?? snapshot?.leadSource);

    closeCalculator();
    requestAnimationFrame(() => {
      scrollToAnchorTarget("#action", { focus: true, highlight: true });
    });
  }, [
    snapshot,
    lightingDraft,
    lightingDiscountedTotal,
    setSnapshot,
    setHasInteracted,
    closeCalculator,
    options?.source,
  ]);

  if (!mounted || !isOpen) return null;

  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const transitionClass = reducedMotion ? "" : "transition-all duration-200";

  return createPortal(
    <>
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className={`fixed inset-0 z-50 bg-black/50 ${transitionClass} ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="calc-modal-title"
          className={`
            pointer-events-auto w-full
            md:max-w-3xl
            bg-white md:rounded-2xl rounded-t-2xl shadow-2xl
            max-h-[90dvh] md:max-h-[88dvh]
            flex flex-col
            ${transitionClass}
            ${visible ? "opacity-100 translate-y-0 md:scale-100" : "opacity-0 translate-y-4 md:scale-95"}
          `}
        >
          {/* Header, Body, Footer — без изменений */}
          {/* ... существующий JSX ... */}
        </div>
      </div>
    </>,
    document.body
  );
}
