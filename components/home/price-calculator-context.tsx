"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import {
  getKitDisplayName,
  type DerivedInputs,
  type LightingSnapshot,
} from "@/lib/calculator-modal-types";

export type CalculatorLeadSnapshot = {
  area: number;

  ceilingTypeLabel: string;
  ceilingBaseRate: number;
  ceilingBaseTotal: number;

  ceilingExtraLabel: string | null;
  ceilingLength: number | null;
  ceilingExtraRatePerMeter: number | null;
  ceilingExtraTotal: number;

  shadowEnabled?: boolean;
  shadowLength?: number | null;
  shadowExtraTotal?: number;
  floatingEnabled?: boolean;
  floatingLength?: number | null;
  floatingExtraTotal?: number;

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

  // NEW: Установка люстр
  chandeliersEnabled?: boolean;
  chandeliersCount?: number | null;
  chandeliersRatePerUnit?: number;
  chandeliersTotal?: number;

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

  // аналитика по скидке на свет
  lightingDiscountApplied?: boolean;
  lightingDiscountPercentApplied?: number; // например 15
};

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

export function serializeCalculatorSnapshot(snapshot: CalculatorLeadSnapshot | null) {
  return snapshot ? JSON.stringify(snapshot) : "";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

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
      `${snapshot.ceilingExtraLabel}: ${snapshot.ceilingLength} м.п. × ${formatCurrency(
        snapshot.ceilingExtraRatePerMeter
      )} ₽`
    );
  }

  // Shadow + Floating separate lines
  if (snapshot.shadowEnabled && snapshot.shadowLength != null) {
    const shadowTotal = toNumber(snapshot.shadowExtraTotal);
    lines.push(`Теневой профиль: ${snapshot.shadowLength} м.п. × ${formatCurrency(shadowTotal / (snapshot.shadowLength || 1))} ₽`);
  }
  if (snapshot.floatingEnabled && snapshot.floatingLength != null) {
    const floatingTotal = toNumber(snapshot.floatingExtraTotal);
    lines.push(`Парящий профиль: ${snapshot.floatingLength} м.п. × ${formatCurrency(floatingTotal / (snapshot.floatingLength || 1))} ₽`);
  }

  if (
    snapshot.lightLinesEnabled &&
    snapshot.lightLinesTotal > 0 &&
    snapshot.lightLinesLabel &&
    snapshot.lightLinesLength &&
    snapshot.lightLinesRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.lightLinesLabel}: ${snapshot.lightLinesLength} м.п. × ${formatCurrency(
        snapshot.lightLinesRatePerMeter
      )} ₽`
    );
  }

  if (
    snapshot.corniceTotal > 0 &&
    snapshot.corniceLabel &&
    snapshot.corniceLength &&
    snapshot.corniceRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.corniceLabel}: ${snapshot.corniceLength} м.п. × ${formatCurrency(
        snapshot.corniceRatePerMeter
      )} ₽`
    );
  }

  if (
    snapshot.trackTotal > 0 &&
    snapshot.trackLabel &&
    snapshot.trackLength &&
    snapshot.trackRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.trackLabel}: ${snapshot.trackLength} м.п. × ${formatCurrency(
        snapshot.trackRatePerMeter
      )} ₽`
    );
  }

  const chandeliersEnabled = Boolean(snapshot.chandeliersEnabled);
  const chandeliersTotal = toNumber(snapshot.chandeliersTotal);
  const chandeliersCount = snapshot.chandeliersCount ?? null;
  const chandeliersRate = toNumber(snapshot.chandeliersRatePerUnit);

  if (chandeliersEnabled && chandeliersTotal > 0 && chandeliersCount !== null) {
    lines.push(
      `Установка люстр: ${chandeliersCount} шт. × ${formatCurrency(chandeliersRate)} ₽`
    );
  }

  if (snapshot.lightsEnabled && snapshot.lightsTotal > 0 && snapshot.lightsCount !== null) {
    lines.push(
      `Светильники: ${snapshot.lightsCount} шт. × ${formatCurrency(
        snapshot.lightsRatePerUnit
      )} ₽`
    );
  }

  const baseTotal = toNumber(snapshot.total);
  lines.push(`Потолок (работы): ${formatCurrency(baseTotal)} ₽`);

  const grand = toNumber(snapshot.grandTotal);
  if (grand > baseTotal + 0.5) {
    const extra = Math.max(0, grand - baseTotal);
    lines.push(`Досчёт монтажа по свету: ${formatCurrency(extra)} ₽`);
  }

  return lines;
}

export function getLightingSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
): string[] {
  const lighting = snapshot?.lighting;
  if (!lighting || lighting.mode === "none") return [];

  const lines: string[] = [];

  const displayName = getKitDisplayName(lighting);
  lines.push(displayName ? `Освещение - ${displayName}:` : "Освещение (из каталога):");

  for (const item of lighting.items ?? []) {
    lines.push(` - ${item.name} × ${item.qty} × ${formatCurrency(item.priceRub)} ₽`);
  }

  const total = lighting.totalRub;
  const discounted = lighting.discountedTotalRub;

  if (total != null) lines.push(` Оборудование: ${formatCurrency(total)} ₽`);

  const percent = snapshot?.lightingDiscountPercentApplied ?? 15;
  const discountApplied = Boolean(snapshot?.lightingDiscountApplied);

  const hasPotentialDiscount =
    total != null &&
    discounted != null &&
    Math.abs(Number(total) - Number(discounted)) >= 1;

  if (discountApplied) {
    if (discounted != null) {
      lines.push(` Со скидкой ${percent}%: ${formatCurrency(discounted)} ₽`);
    }
  } else if (hasPotentialDiscount) {
    // важно: не выдаём это как применённую скидку — это “при условии потолка”
    lines.push(` Если с потолком (−${percent}%): ${formatCurrency(discounted!)} ₽`);
  }

  return lines;
}
