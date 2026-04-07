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

export type CalculatorLeadSnapshot = {
  area: number;
  ceilingTypeLabel: string;
  ceilingBaseRate: number;
  ceilingBaseTotal: number;

  ceilingExtraLabel: string | null;
  ceilingLength: number | null;
  ceilingExtraRatePerMeter: number | null;
  ceilingExtraTotal: number;

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

export function PriceCalculatorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<CalculatorLeadSnapshot | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const value = useMemo(
    () => ({
      snapshot,
      setSnapshot,
      hasInteracted,
      setHasInteracted,
    }),
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

export function serializeCalculatorSnapshot(
  snapshot: CalculatorLeadSnapshot | null
) {
  return snapshot ? JSON.stringify(snapshot) : "";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export function getCalculatorSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
) {
  if (!snapshot) {
    return [];
  }

  const lines = [
    `Площадь: ${snapshot.area} м²`,
    `Тип потолка: ${snapshot.ceilingTypeLabel}`,
    `Полотно: ${snapshot.area} м² × ${formatCurrency(
      snapshot.ceilingBaseRate
    )} ₽`,
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

  if (
    snapshot.lightsEnabled &&
    snapshot.lightsTotal > 0 &&
    snapshot.lightsCount !== null
  ) {
    lines.push(
      `Светильники: ${snapshot.lightsCount} шт. × ${formatCurrency(
        snapshot.lightsRatePerUnit
      )} ₽`
    );
  }

  lines.push(`Итого: ${formatCurrency(snapshot.total)} ₽`);

  return lines;
}
