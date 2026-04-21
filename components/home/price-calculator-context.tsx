"use client";

import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { getKitDisplayName, type DerivedInputs, type LightingSnapshot } from "@/lib/calculator-modal-types";

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

  total: number;
  grandTotal?: number;

  derivedInputs: DerivedInputs;
  lighting?: LightingSnapshot;
  leadSource?: string;
  _reconciled?: boolean;
};

type PriceCalculatorContextValue = {
  snapshot: CalculatorLeadSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<CalculatorLeadSnapshot | null>>;
  hasInteracted: boolean;
  setHasInteracted: Dispatch<SetStateAction<boolean>>;
};

const PriceCalculatorContext = createContext<PriceCalculatorContextValue | null>(null);

export function PriceCalculatorProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CalculatorLeadSnapshot | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const value = useMemo(
    () => ({ snapshot, setSnapshot, hasInteracted, setHasInteracted }),
    [snapshot, hasInteracted]
  );

  return <PriceCalculatorContext.Provider value={value}>{children}</PriceCalculatorContext.Provider>;
}

export function usePriceCalculatorBridge() {
  const context = useContext(PriceCalculatorContext);
  if (!context) {
    throw new Error("usePriceCalculatorBridge must be used inside PriceCalculatorProvider.");
  }
  return context;
}

export function serializeCalculatorSnapshot(snapshot: CalculatorLeadSnapshot | null) {
  return snapshot ? JSON.stringify(snapshot) : "";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

export function getCalculatorSummaryLines(snapshot: CalculatorLeadSnapshot | null): string[] {
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
    lines.push(`Светильники: ${snapshot.lightsCount} шт. × ${formatCurrency(snapshot.lightsRatePerUnit)} ₽`);
  }

  lines.push(`Потолок (работы): ${formatCurrency(snapshot.total)} ₽`);
  return lines;
}

export function getLightingSummaryLines(snapshot: CalculatorLeadSnapshot | null): string[] {
  const lighting = snapshot?.lighting;
  if (!lighting || lighting.mode === "none") return [];

  const lines: string[] = [];
  const displayName = lighting.mode === "kit" ? getKitDisplayName(lighting) : null;

  lines.push(displayName ? `Освещение - ${displayName}:` : "Освещение (из каталога):");

  for (const item of lighting.items ?? []) {
    lines.push(`  - ${item.name} × ${item.qty} × ${formatCurrency(item.priceRub)} ₽`);
  }

  if (lighting.totalRub != null) {
    lines.push(`  Оборудование: ${formatCurrency(lighting.totalRub)} ₽`);
  }

  if (lighting.discountedTotalRub != null) {
    lines.push(`  Со скидкой 15%: ${formatCurrency(lighting.discountedTotalRub)} ₽`);
  }

  return lines;
}
