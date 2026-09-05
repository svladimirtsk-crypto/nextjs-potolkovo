"use client";

import { pricing } from "@/content/pricing";
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
  getLightingKitLabel,
  type DerivedInputs,
  type LightingDiscountMode,
  type LightingSnapshot,
  type SolutionScenario,
} from "@/lib/calculator-modal-types";

export type CalculatorRoomBreakdown = {
  id: string;
  label: string;
  area: number;
  totalRub: number;
  ceilingTypeLabel: string;
  shadowLength?: number | null;
  floatingLength?: number | null;
  lightLinesLength?: number | null;
  corniceLabel?: string | null;
  corniceLength?: number | null;
  corniceLightingLength?: number | null;
  trackLabel?: string | null;
  trackLength?: number | null;
  lightsCount?: number | null;
  chandeliersCount?: number | null;
};

export type CalculatorLeadSnapshot = {
  area: number;
  calculationScope?: "room" | "object";
  roomBreakdown?: CalculatorRoomBreakdown[];
  solutionScenario?: SolutionScenario;

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
  corniceLightingEnabled?: boolean;
  corniceLightingLabel?: string | null;
  corniceLightingLength?: number | null;
  corniceLightingRatePerMeter?: number | null;
  corniceLightingPowerSupplies?: number | null;
  corniceLightingPowerSupplyRate?: number | null;
  corniceLightingTotal?: number;

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
  /** T-004: сумма до применения минимального заказа. */
  totalRawRub?: number;
  /** T-004: сработал минимальный заказ. */
  minimumOrderApplied?: boolean;
  /** @deprecated T-008: не использовать, считать через селекторы контекста модалки. */
  grandTotal?: number;
  /** T-008: досчёт монтажа света, если он есть. */
  extraInstallRub?: number;
  extraInstallLines?: string[];

  derivedInputs: DerivedInputs;

  lighting?: LightingSnapshot;
  leadSource?: string;

  _reconciled?: boolean;

  // аналитика по скидке на свет
  lightingDiscountApplied?: boolean;
  lightingDiscountPercentApplied?: number;
  lightingDiscountMode?: LightingDiscountMode;
  lightingDiscountAmountRub?: number;
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

  const scenarioLabel =
    snapshot.solutionScenario === "advanced"
      ? "Продвинутый — интерес к SMART-свету и управлению, обсудить лично"
      : snapshot.solutionScenario === "modern"
        ? "Современный"
        : snapshot.solutionScenario === "standard"
          ? "Стандартный"
          : null;

  // T-022: при нескольких помещениях ставка первой комнаты не описывает объект,
  // поэтому «Полотно» и «Тип потолка» показываем по комнатам, а не одной строкой.
  const isMultiRoom = (snapshot.roomBreakdown?.length ?? 0) > 1;

  const lines: string[] = [
    "Расчёт потолка:",
    ...(scenarioLabel ? [`Сценарий решения: ${scenarioLabel}`] : []),
    `Формат расчёта: ${snapshot.calculationScope === "object" ? "весь объект" : "отдельное помещение"}`,
    `Площадь: ${snapshot.area} м²`,
    ...(isMultiRoom
      ? ["Тип потолка и полотно — по помещениям (см. ниже)"]
      : [
          `Тип потолка: ${snapshot.ceilingTypeLabel}`,
          `Полотно: ${snapshot.area} м² × ${formatCurrency(snapshot.ceilingBaseRate)} ₽ = ${formatCurrency(snapshot.ceilingBaseTotal)} ₽`,
        ]),
  ];

  if (snapshot.roomBreakdown?.length) {
    lines.push("", "Помещения в расчёте:");
    snapshot.roomBreakdown.forEach((room) => {
      const details: string[] = [];
      if (room.shadowLength) details.push(`теневой ${room.shadowLength} м.п.`);
      if (room.floatingLength) details.push(`парящий ${room.floatingLength} м.п.`);
      if (room.lightLinesLength) details.push(`линии ${room.lightLinesLength} м.п.`);
      if (room.corniceLength && room.corniceLabel) details.push(`${room.corniceLabel.toLowerCase()} ${room.corniceLength} м.п.`);
      if (room.corniceLightingLength) details.push(`подсветка карниза ${room.corniceLightingLength} м.п.`);
      if (room.trackLength && room.trackLabel) details.push(`${room.trackLabel.toLowerCase()} ${room.trackLength} м.п.`);
      if (room.lightsCount) details.push(`точки ${room.lightsCount} шт.`);
      if (room.chandeliersCount) details.push(`люстры ${room.chandeliersCount} шт.`);

      lines.push(
        `${room.label}: ${room.area} м² · ${room.ceilingTypeLabel} · ${details.join(" · ") || "без доп. узлов"} · ${formatCurrency(room.totalRub)} ₽`
      );
    });
  }

  // Старое единое поле оставляем как fallback для одиночного спецпрофиля.
  if (
    !snapshot.shadowEnabled &&
    !snapshot.floatingEnabled &&
    snapshot.ceilingExtraTotal > 0 &&
    snapshot.ceilingExtraLabel &&
    snapshot.ceilingLength &&
    snapshot.ceilingExtraRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.ceilingExtraLabel}: ${snapshot.ceilingLength} м.п. × ${formatCurrency(
        snapshot.ceilingExtraRatePerMeter
      )} ₽ = ${formatCurrency(snapshot.ceilingExtraTotal)} ₽`
    );
  }

  // Shadow + Floating separate lines
  if (snapshot.shadowEnabled && snapshot.shadowLength != null) {
    const shadowTotal = toNumber(snapshot.shadowExtraTotal);
    const shadowRate = shadowTotal / (snapshot.shadowLength || 1);
    lines.push(
      `Теневой профиль: ${snapshot.shadowLength} м.п. × ${formatCurrency(shadowRate)} ₽ = ${formatCurrency(shadowTotal)} ₽`
    );
  }
  if (snapshot.floatingEnabled && snapshot.floatingLength != null) {
    const floatingTotal = toNumber(snapshot.floatingExtraTotal);
    const floatingRate = floatingTotal / (snapshot.floatingLength || 1);
    lines.push(
      `Парящий профиль: ${snapshot.floatingLength} м.п. × ${formatCurrency(floatingRate)} ₽ = ${formatCurrency(floatingTotal)} ₽`
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
      `${snapshot.lightLinesLabel}: ${snapshot.lightLinesLength} м.п. × ${formatCurrency(
        snapshot.lightLinesRatePerMeter
      )} ₽ = ${formatCurrency(snapshot.lightLinesTotal)} ₽`
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
      )} ₽ = ${formatCurrency(snapshot.corniceTotal)} ₽`
    );
  }

  if (
    snapshot.corniceLightingEnabled &&
    toNumber(snapshot.corniceLightingTotal) > 0 &&
    snapshot.corniceLightingLabel &&
    snapshot.corniceLightingLength &&
    snapshot.corniceLightingRatePerMeter !== null
  ) {
    lines.push(
      `${snapshot.corniceLightingLabel}: ${snapshot.corniceLightingLength} м.п. × ${formatCurrency(
        toNumber(snapshot.corniceLightingRatePerMeter)
      )} ₽ = ${formatCurrency(toNumber(snapshot.corniceLightingLength) * toNumber(snapshot.corniceLightingRatePerMeter))} ₽`
    );

    if (
      snapshot.corniceLightingPowerSupplies &&
      snapshot.corniceLightingPowerSupplyRate !== null &&
      toNumber(snapshot.corniceLightingPowerSupplies) > 0
    ) {
      lines.push(
        `Блок питания подсветки: ${snapshot.corniceLightingPowerSupplies} шт. × ${formatCurrency(
          toNumber(snapshot.corniceLightingPowerSupplyRate)
        )} ₽ = ${formatCurrency(toNumber(snapshot.corniceLightingPowerSupplies) * toNumber(snapshot.corniceLightingPowerSupplyRate))} ₽`
      );
    }
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
      )} ₽ = ${formatCurrency(snapshot.trackTotal)} ₽`
    );
  }

  const chandeliersEnabled = Boolean(snapshot.chandeliersEnabled);
  const chandeliersTotal = toNumber(snapshot.chandeliersTotal);
  const chandeliersCount = snapshot.chandeliersCount ?? null;
  const chandeliersRate = toNumber(snapshot.chandeliersRatePerUnit);

  if (chandeliersEnabled && chandeliersTotal > 0 && chandeliersCount !== null) {
    lines.push(
      `Установка люстр: ${chandeliersCount} шт. × ${formatCurrency(chandeliersRate)} ₽ = ${formatCurrency(chandeliersTotal)} ₽`
    );
  }

  if (snapshot.lightsEnabled && snapshot.lightsTotal > 0 && snapshot.lightsCount !== null) {
    lines.push(
      `Установка точечных светильников: ${snapshot.lightsCount} шт. × ${formatCurrency(
        snapshot.lightsRatePerUnit
      )} ₽ = ${formatCurrency(snapshot.lightsTotal)} ₽`
    );
  }

  const baseTotal = toNumber(snapshot.total);
  lines.push(`Итого потолок / работы: ${formatCurrency(baseTotal)} ₽`);

  // T-008: печатаем досчёт монтажа только если он пришёл явно
  const extraInstall = toNumber(snapshot.extraInstallRub);
  if (extraInstall > 0.5) {
    const detail = snapshot.extraInstallLines ?? [];
    if (detail.length > 0) {
      for (const line of detail) lines.push(line);
    } else {
      lines.push(`Досчёт монтажа света: ${formatCurrency(extraInstall)} ₽`);
    }
    lines.push(
      `Итого потолок с досчётом монтажа: ${formatCurrency(baseTotal + extraInstall)} ₽`
    );
  }

  return lines;
}

export function getLightingSummaryLines(
  snapshot: CalculatorLeadSnapshot | null
): string[] {
  const lighting = snapshot?.lighting;
  if (!lighting || lighting.mode === "none") return [];

  const lines: string[] = [];

  const discountMode = snapshot?.lightingDiscountMode ?? lighting.discountMode ?? "none";
  const discountPercent =
    snapshot?.lightingDiscountPercentApplied ??
    lighting.discountPercentApplied ??
    (discountMode === "with-ceiling"
      ? pricing.lightingDiscount.withCeilingPct
      : discountMode === "lighting-only"
        ? pricing.lightingDiscount.lightingOnlyPct
        : 0);

  const total = toNumber(lighting.totalRub);
  const discounted = lighting.discountedTotalRub != null ? toNumber(lighting.discountedTotalRub) : total;
  const benefit = Math.max(0, total - discounted);
  const withCeilingTotal = lighting.withCeilingDiscountedTotalRub != null
    ? toNumber(lighting.withCeilingDiscountedTotalRub)
    : Math.round(total * 0.75);
  const withCeilingBenefit = Math.max(0, total - withCeilingTotal);

  const orderType =
    discountMode === "with-ceiling"
      ? "Тип заявки: освещение + потолок"
      : discountMode === "lighting-only"
        ? "Тип заявки: только освещение"
        : "Тип заявки: освещение";
  lines.push(orderType);

  const displayName = getLightingKitLabel(lighting);
  lines.push(displayName ? `Освещение - ${displayName}:` : "Освещение (из каталога):");

  for (const item of lighting.items ?? []) {
    const qty = toNumber(item.qty);
    const price = toNumber(item.priceRub);
    lines.push(` - ${item.name} × ${qty} × ${formatCurrency(price)} ₽ = ${formatCurrency(qty * price)} ₽`);
  }

  if (total > 0) lines.push(` Свет без скидки: ${formatCurrency(total)} ₽`);

  if (discountMode !== "none" && discounted > 0) {
    lines.push(` Скидка на свет: ${formatCurrency(total)} ₽ −${discountPercent}% (−${formatCurrency(benefit)} ₽)`);
    lines.push(` Итого свет: ${formatCurrency(discounted)} ₽`);
  }

  if (discountMode !== "with-ceiling" && total > 0) {
    const extraBenefit = Math.max(0, discounted - withCeilingTotal);
    lines.push(` Если добавить потолок: ${formatCurrency(total)} ₽ −25% (−${formatCurrency(withCeilingBenefit)} ₽)`);
    lines.push(` Свет с потолком: ${formatCurrency(withCeilingTotal)} ₽`);
    if (extraBenefit > 0) lines.push(` Дополнительная выгода с потолком: ${formatCurrency(extraBenefit)} ₽`);
  }

  return lines;
}
