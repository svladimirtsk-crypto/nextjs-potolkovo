"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from "react";

import type { DerivedInputs, LightingSnapshot } from "@/lib/calculator-modal-types";

// ─── Snapshot ────────────────────────────────────────────────────────────────

export type CalculatorLeadSnapshot = {
  area: number;
  ceilingTypeLabel: string;
  ceilingBaseRate: number;
  ceilingBaseTotal: number;

  ceilingExtraLabel: string | null;
  ceilingLength: number | null;
  ceilingExtraRatePerMeter: number | null;
  ceilingExtraTotal: number;

  lightLinesEnabled: boolean;
  lightLinesLabel: string | null;
  lightLinesLength: number | null;
  lightLinesRatePerMeter: number | null;
  lightLinesTotal: number;

  corniceLabel: string | null;
  corniceLength: number | null;
  corniceRatePerMeter: number | null;
  corniceTotal: number;

  trackLabel: string | null;
  trackLength: number | null;
  trackRatePerMeter: number | null;
  trackTotal: number;

  lightsEnabled: boolean;
  lightsCount: number | null;
  lightsRatePerUnit: number;
  lightsTotal: number;

  /** Итог только по потолку (работы) */
  total: number;

  /**
   * Итог с освещением (потолок + оборудование со скидкой).
   * Записывается при подтверждении wizard.
   * Если освещение не выбрано — равно total.
   */
  grandTotal?: number;

  /** Производные параметры для рекомендаций освещения */
  derivedInputs: DerivedInputs;

  /** Выбранное освещение (заполняется из модалки) */
  lighting?: LightingSnapshot;
};

// ─── Context ─────────────────────────────────────────────────────────────────

type PriceCalculatorContextValue = {
  snapshot: CalculatorLeadSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<CalculatorLeadSnapshot | null>>;
  hasInteracted: boolean;
  setHasInteracted: Dispatch<SetStateAction<boolean>>;
};

const PriceCalculatorContext = createContext<PriceCalculatorContextValue | null>(
  null
);

export function PriceCalculatorProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CalculatorLeadSnapshot | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const value = useMemo(
    () => ({ snapshot, setSnapshot, hasInteracted, setHasInteracted }),
    [snapshot, hasInteracted]
  );

  return (
    <PriceCalculatorContext.Provider value={value}>
      {children}
    </PriceCalculatorContext.Provider>
  );
}

export function usePriceCalculatorBridge() {
  const context = useContext(PriceCalculatorContext);
  if (!context) {
    throw new Error(
      "usePriceCalculatorBridge must be used inside PriceCalculatorProvider."
    );
  }
  return context;
}

// ─── Serialization ───────────────────────────────────────────────────────────

export function serializeCalculatorSnapshot(
  snapshot: CalculatorLeadSnapshot | null
) {
  return snapshot ? JSON.stringify(snapshot) : "";
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

// ─── Summary lines (потолок) ─────────────────────────────────────────────────

export function getCalculatorSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
): string[] {
  if (!snapshot) return [];

  const lines: string[] = [
    `Площадь: ${snapshot.area} м²`,
    `Тип потолка: ${snapshot.ceilingTypeLabel}`,
    `Полотно: ${snapshot.area} м² × ${formatCurrency(snapshot.ceilingBaseRate)} ₽`,
  ];

  if (
    snapshot.ceilingExtraTotal > 0 &&
    snapshot.ceilingExtraLabel &&
    snapshot.ceilingLength &&
    snapshot.ceilingExtraRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.ceilingExtraLabel}: ${snapshot.ceilingLength} м.п. × ${formatCurrency(snapshot.ceilingExtraRatePerMeter)} ₽`
    );
  }

  if (
    snapshot.lightLinesEnabled &&
    snapshot.lightLinesTotal > 0 &&
    snapshot.lightLinesLabel &&
    snapshot.lightLinesLength &&
    snapshot.lightLinesRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.lightLinesLabel}: ${snapshot.lightLinesLength} м.п. × ${formatCurrency(snapshot.lightLinesRatePerMeter)} ₽`
    );
  }

  if (
    snapshot.corniceTotal > 0 &&
    snapshot.corniceLabel &&
    snapshot.corniceLength &&
    snapshot.corniceRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.corniceLabel}: ${snapshot.corniceLength} м.п. × ${formatCurrency(snapshot.corniceRatePerMeter)} ₽`
    );
  }

  if (
    snapshot.trackTotal > 0 &&
    snapshot.trackLabel &&
    snapshot.trackLength &&
    snapshot.trackRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.trackLabel}: ${snapshot.trackLength} м.п. × ${formatCurrency(snapshot.trackRatePerMeter)} ₽`
    );
  }

  if (snapshot.lightsEnabled && snapshot.lightsTotal > 0 && snapshot.lightsCount !== null) {
    lines.push(
      `Светильники: ${snapshot.lightsCount} шт. × ${formatCurrency(snapshot.lightsRatePerUnit)} ₽`
    );
  }

  // Потолок итого — всегда
  lines.push(`Потолок (работы): ${formatCurrency(snapshot.total)} ₽`);

  return lines;
}

// ─── Summary lines (освещение) ───────────────────────────────────────────────

export function getLightingSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
): string[] {
  const lighting = snapshot?.lighting;
  if (!lighting || lighting.mode === "none") return [];

  const lines: string[] = [];

  if ((lighting.mode === "kit" || lighting.mode === "catalog") && lighting.items?.length) {
    if (lighting.kitName) {
      lines.push(`Освещение — ${lighting.kitName}:`);
    } else {
      lines.push("Освещение (из каталога):");
    }
    for (const item of lighting.items) {
      lines.push(
        `  — ${item.name} × ${item.qty} шт. × ${formatCurrency(item.priceRub)} ₽`
      );
    }
    if (lighting.totalRub != null) {
      lines.push(`  Оборудование: ${formatCurrency(lighting.totalRub)} ₽`);
    }
    if (lighting.discountedTotalRub != null) {
      lines.push(
        `  Со скидкой 15%: ${formatCurrency(lighting.discountedTotalRub)} ₽`
      );
    }
  }

  return lines;
}

/**
 * Итоговые строки для заявки — структурированный блок.
 * Используется в action-form.tsx и buildLeadMessage.
 * Всегда выводит: Потолок / Освещение (если есть) / Итого.
 */
export function getTotalSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
): string[] {
  if (!snapshot) return [];

  const lighting   = snapshot.lighting;
  const hasLighting =
    lighting &&
    lighting.mode !== "none" &&
    (lighting.items?.length ?? 0) > 0 &&
    (lighting.discountedTotalRub ?? 0) > 0;

  const lines: string[] = [];

  lines.push(`Потолок: ${formatCurrency(snapshot.total)} ₽`);

  if (hasLighting && lighting!.discountedTotalRub != null) {
    lines.push(
      `Освещение (со скидкой 15%): ${formatCurrency(lighting!.discountedTotalRub)} ₽`
    );
    const grand = snapshot.grandTotal ?? (snapshot.total + lighting!.discountedTotalRub);
    lines.push(`Итого: ~${formatCurrency(grand)} ₽`);
  }

  return lines;
}
