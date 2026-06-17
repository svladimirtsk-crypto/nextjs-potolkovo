"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { homepage } from "@/content/homepage";
import type { ServiceCalculatorPreset } from "@/content/services";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CalculatorLeadSnapshot,
  usePriceCalculatorBridge,
} from "./price-calculator-context";

import { calcRecommendedTrackSpots } from "@/lib/lighting-formulas";
import type { DerivedInputs } from "@/lib/calculator-modal-types";

const calculator = homepage.price.calculator;

const CHANDELIERS_INSTALL_RATE_PER_UNIT = 1000;

type CeilingType = (typeof calculator.ceilingTypes)[number]["slug"] | "shadow-floating";
type CorniceType = (typeof calculator.cornices)[number]["slug"];
type TrackType = (typeof calculator.tracks)[number]["slug"];
type CalculationScope = "room" | "object";

type PerimeterSuggestion = { recommended: number };

type CompactStepId =
  | "area"
  | "ceiling"
  | "shadowProfile"
  | "floatingProfile"
  | "lightLines"
  | "cornice"
  | "track"
  | "chandeliers"
  | "lights";

type RoomConfig = {
  id: string;
  label: string;
  area: number;
  ceilingType: CeilingType;
  shadowEnabled: boolean;
  shadowLength: number;
  shadowLengthAuto: boolean;
  floatingEnabled: boolean;
  floatingLength: number;
  floatingLengthAuto: boolean;
  lightLinesEnabled: boolean;
  lightLinesLength: number;
  corniceType: CorniceType;
  corniceLength: number;
  corniceLightingEnabled: boolean;
  corniceLightingLength: number;
  corniceLightingPowerSupplies: number;
  trackType: TrackType;
  trackLength: number;
  chandeliersEnabled: boolean;
  chandeliersCount: number;
  lightsEnabled: boolean;
  lightsCount: number;
};

const ROOM_TYPE_OPTIONS = [
  "Кухня",
  "Гостиная",
  "Спальня",
  "Детская",
  "Кабинет",
  "Санузел",
  "Коридор",
  "Прихожая",
  "Другое",
] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number) {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

function buildCeilingTypeLabel(room: Pick<RoomConfig, "shadowEnabled" | "floatingEnabled">) {
  if (!room.shadowEnabled && !room.floatingEnabled) return "Простой потолок";
  return `${room.shadowEnabled ? "Теневой" : ""}${room.shadowEnabled && room.floatingEnabled ? " + " : ""}${room.floatingEnabled ? "Парящий" : ""}`;
}

function calcRoomSnapshot(room: RoomConfig): CalculatorLeadSnapshot {
  const shadowCeiling = calculator.ceilingTypes.find((item) => item.slug === "shadow") ?? calculator.ceilingTypes[0];
  const floatingCeiling = calculator.ceilingTypes.find((item) => item.slug === "floating") ?? calculator.ceilingTypes[0];
  const selectedCeiling =
    calculator.ceilingTypes.find((item) => item.slug === room.ceilingType) ?? calculator.ceilingTypes[0];
  const selectedCornice =
    calculator.cornices.find((item) => item.slug === room.corniceType) ?? calculator.cornices[0];
  const selectedTrack = calculator.tracks.find((item) => item.slug === room.trackType) ?? calculator.tracks[0];

  const hasSpecialCeiling = room.shadowEnabled || room.floatingEnabled;
  const ceilingBaseRate = hasSpecialCeiling ? shadowCeiling.baseRatePerSqm : selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = room.area * ceilingBaseRate;
  const shadowExtraTotal = room.shadowEnabled ? room.shadowLength * shadowCeiling.extraRatePerMeter : 0;
  const floatingExtraTotal = room.floatingEnabled ? room.floatingLength * floatingCeiling.extraRatePerMeter : 0;
  const ceilingExtraTotal = shadowExtraTotal + floatingExtraTotal;
  const lightLinesTotal = room.lightLinesEnabled ? room.lightLinesLength * calculator.lightLines.ratePerMeter : 0;
  const corniceTotal = selectedCornice.ratePerMeter > 0 ? room.corniceLength * selectedCornice.ratePerMeter : 0;
  const corniceLightingMetersTotal = room.corniceLightingEnabled
    ? room.corniceLightingLength * calculator.corniceLighting.ratePerMeter
    : 0;
  const corniceLightingPowerSupplyTotal = room.corniceLightingEnabled
    ? room.corniceLightingPowerSupplies * calculator.corniceLighting.powerSupplyRate
    : 0;
  const corniceLightingTotal = corniceLightingMetersTotal + corniceLightingPowerSupplyTotal;
  const trackTotal = selectedTrack.ratePerMeter > 0 ? room.trackLength * selectedTrack.ratePerMeter : 0;
  const chandeliersTotal = room.chandeliersEnabled ? room.chandeliersCount * CHANDELIERS_INSTALL_RATE_PER_UNIT : 0;
  const lightsTotal = room.lightsEnabled ? room.lightsCount * calculator.lights.ratePerUnit : 0;
  const total =
    ceilingBaseTotal +
    ceilingExtraTotal +
    lightLinesTotal +
    corniceTotal +
    corniceLightingTotal +
    trackTotal +
    chandeliersTotal +
    lightsTotal;

  const derivedTrackMountType: DerivedInputs["trackMountType"] =
    room.trackType === "built-in"
      ? "built-in"
      : room.trackType === "surface"
        ? "surface"
        : "none";
  const derivedTrackLength = room.trackType !== "none" ? room.trackLength : 0;

  return {
    area: room.area,
    calculationScope: "room",
    ceilingTypeLabel: buildCeilingTypeLabel(room),
    ceilingBaseRate,
    ceilingBaseTotal,
    ceilingExtraLabel: hasSpecialCeiling
      ? room.shadowEnabled && room.floatingEnabled
        ? "Теневой + парящий профиль"
        : room.shadowEnabled
          ? shadowCeiling.extraLabel ?? null
          : floatingCeiling.extraLabel ?? null
      : null,
    ceilingLength: hasSpecialCeiling ? null : null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal,
    shadowEnabled: room.shadowEnabled,
    shadowLength: room.shadowEnabled ? room.shadowLength : null,
    shadowExtraTotal,
    floatingEnabled: room.floatingEnabled,
    floatingLength: room.floatingEnabled ? room.floatingLength : null,
    floatingExtraTotal,
    lightLinesEnabled: room.lightLinesEnabled,
    lightLinesLabel: room.lightLinesEnabled ? calculator.lightLines.label : null,
    lightLinesLength: room.lightLinesEnabled ? room.lightLinesLength : null,
    lightLinesRatePerMeter: room.lightLinesEnabled ? calculator.lightLines.ratePerMeter : null,
    lightLinesTotal,
    corniceLabel: selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
    corniceLength: selectedCornice.ratePerMeter > 0 ? room.corniceLength : null,
    corniceRatePerMeter: selectedCornice.ratePerMeter > 0 ? selectedCornice.ratePerMeter : null,
    corniceTotal,
    corniceLightingEnabled: room.corniceLightingEnabled,
    corniceLightingLabel: room.corniceLightingEnabled ? calculator.corniceLighting.label : null,
    corniceLightingLength: room.corniceLightingEnabled ? room.corniceLightingLength : null,
    corniceLightingRatePerMeter: room.corniceLightingEnabled ? calculator.corniceLighting.ratePerMeter : null,
    corniceLightingPowerSupplies: room.corniceLightingEnabled ? room.corniceLightingPowerSupplies : null,
    corniceLightingPowerSupplyRate: room.corniceLightingEnabled ? calculator.corniceLighting.powerSupplyRate : null,
    corniceLightingTotal,
    trackLabel: selectedTrack.ratePerMeter > 0 ? selectedTrack.label : null,
    trackLength: selectedTrack.ratePerMeter > 0 ? room.trackLength : null,
    trackRatePerMeter: selectedTrack.ratePerMeter > 0 ? selectedTrack.ratePerMeter : null,
    trackTotal,
    chandeliersEnabled: room.chandeliersEnabled,
    chandeliersCount: room.chandeliersEnabled ? room.chandeliersCount : null,
    chandeliersRatePerUnit: CHANDELIERS_INSTALL_RATE_PER_UNIT,
    chandeliersTotal,
    lightsEnabled: room.lightsEnabled,
    lightsCount: room.lightsEnabled ? room.lightsCount : null,
    lightsRatePerUnit: calculator.lights.ratePerUnit,
    lightsTotal,
    total,
    derivedInputs: {
      pointSpotsQty: room.lightsEnabled ? room.lightsCount : 0,
      trackMountType: derivedTrackMountType,
      trackLengthMeters: derivedTrackLength,
      recommendedTrackSpotsQty: calcRecommendedTrackSpots(derivedTrackLength),
    },
  };
}

/** ТЗ: периметр теневого/парящего = 1:1 к площади */
function getPerimeterSuggestion(area: number): PerimeterSuggestion {
  const recommended = clamp(
    roundToStep(area, calculator.specialMeters.step),
    calculator.specialMeters.min,
    calculator.specialMeters.max
  );
  return { recommended };
}

// ---- scroll helpers (чтобы шаг не прятался под шапкой модалки) ----

function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  if (!node) return null;

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

function scrollIntoViewWithOffset(
  el: HTMLElement,
  offsetPx: number,
  behavior: ScrollBehavior
) {
  const parent = getScrollParent(el);
  if (!parent) {
    el.scrollIntoView({ behavior, block: "start" });
    return;
  }

  const parentRect = parent.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetTop = elRect.top - parentRect.top + parent.scrollTop - offsetPx;

  parent.scrollTo({ top: targetTop, behavior });
}

// ---- small UI building blocks ----

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5 max-sm:rounded-2xl max-sm:p-3">
      <div className="mb-4 max-sm:mb-3">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600 max-sm:text-[13px] max-sm:leading-5">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CompactBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
      {children}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 max-sm:px-3 max-sm:py-2.5">
      <p className="flex items-center gap-2 text-sm text-slate-700">
        <CompactBadge>✓</CompactBadge>
        <span>
          {label}: <span className="font-semibold text-slate-950">{value}</span>
        </span>
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-950 max-sm:px-2.5 max-sm:py-1"
      >
        Изменить
      </button>
    </div>
  );
}

function CollapsedStep({
  title,
  subtitle,
  enabled,
  onOpen,
}: {
  title: string;
  subtitle: string;
  enabled: boolean;
  onOpen: () => void;
}) {
  return (
    <SectionCard title={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 max-sm:px-3 max-sm:py-2.5">
        <p className="text-sm text-slate-700">{subtitle}</p>
        <Button type="button" variant="secondary" onClick={onOpen} disabled={!enabled}>
          Открыть
        </Button>
      </div>
    </SectionCard>
  );
}

function OptionCard({
  active,
  title,
  meta,
  onClick,
}: {
  active: boolean;
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-2xl border p-4 text-left transition-all max-sm:p-3",
        "flex h-full flex-col",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5 max-sm:text-[13px]">{title}</p>
          <p
            className={[
              "mt-1 line-clamp-2 text-xs leading-5 max-sm:text-[11px] max-sm:leading-4",
              active ? "text-white/75" : "text-slate-500",
            ].join(" ")}
          >
            {meta}
          </p>
        </div>

        <span
          className={[
            "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
            active ? "border-white bg-white" : "border-slate-300 bg-transparent",
          ].join(" ")}
        />
      </div>
    </button>
  );
}

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  showSlider = true,
  quickValues,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
  showSlider?: boolean;
  quickValues?: number[];
}) {
  const [manual, setManual] = useState<string>(String(value));
  useEffect(() => {
    const frame = requestAnimationFrame(() => setManual(String(value)));
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const normalize = (num: number) => clamp(roundToStep(num, step), min, max);

  const parseManual = (raw: string) => {
    const normalizedRaw = raw.replace(",", ".").trim();
    if (!normalizedRaw) return null;
    const parsed = Number(normalizedRaw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const commitWhileTyping = (raw: string) => {
    const parsed = parseManual(raw);
    if (parsed === null) return;
    if (parsed < min || parsed > max) return;
    onChange(normalize(parsed));
  };

  const isIntegerStep = Number.isInteger(step);

  const dec = () => onChange(normalize(value - step));
  const inc = () => onChange(normalize(value + step));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 max-sm:items-start max-sm:gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 max-sm:max-w-[8rem] max-sm:text-[13px] max-sm:leading-5">
          {label}
        </label>

        <div className="flex shrink-0 items-center gap-2 max-sm:gap-1.5">
          <button
            type="button"
            onClick={dec}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 max-sm:h-7 max-sm:w-7"
            aria-label="Уменьшить"
          >
            −
          </button>

          <input
            id={id}
            value={manual}
            onChange={(e) => {
              const next = e.target.value;
              setManual(next);
              commitWhileTyping(next);
            }}
            onBlur={() => {
              const parsed = parseManual(manual);
              if (parsed === null) {
                setManual(String(value));
                return;
              }
              const clamped = normalize(parsed);
              setManual(String(clamped));
              if (clamped !== value) onChange(clamped);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            }}
            inputMode={isIntegerStep ? "numeric" : "decimal"}
            className="w-20 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-24 max-sm:w-16 max-sm:px-2 max-sm:text-center"
          />

          <span className="text-sm font-semibold text-slate-950 max-sm:text-xs">{unit}</span>

          <button
            type="button"
            onClick={inc}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 max-sm:h-7 max-sm:w-7"
            aria-label="Увеличить"
          >
            +
          </button>
        </div>
      </div>

      {quickValues && quickValues.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 max-sm:flex-nowrap max-sm:gap-1.5 max-sm:overflow-x-auto max-sm:pb-1 no-scrollbar">
          {quickValues.map((q) => {
            const active = Math.abs(value - q) < 0.0001;
            return (
              <button
                key={q}
                type="button"
                onClick={() => onChange(normalize(q))}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors max-sm:shrink-0 max-sm:px-2.5 max-sm:py-1 max-sm:text-[11px]",
                  active
                    ? "bg-slate-950 text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
                ].join(" ")}
              >
                {q} {unit}
              </button>
            );
          })}
        </div>
      ) : null}

      {showSlider ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="pc-range mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-950"
          />
          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>
              {min} {unit}
            </span>
            <span>
              {max} {unit}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PerimeterHint({
  area,
  recommended,
  onApply,
  isAuto,
}: {
  area: number;
  recommended: number;
  onApply: () => void;
  isAuto: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4 max-sm:mt-3 max-sm:p-3">
      <p className="text-sm leading-6 text-slate-600 max-sm:text-xs max-sm:leading-5">
        Если профиль идёт по всей комнате, ориентир для площади <span className="font-semibold text-slate-950">{area} м²</span>{" "}
        — <span className="font-semibold text-slate-950">{recommended} м.п.</span>. Если профиль нужен только частично, введите фактические метры вручную.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3 max-sm:gap-2">
        <button
          type="button"
          onClick={onApply}
          className="text-sm font-semibold text-slate-950 underline underline-offset-4 hover:text-slate-700 max-sm:text-xs"
        >
          Подставить 1:1
        </button>

        <span className="text-xs text-slate-500">
          Авто: {isAuto ? "включено" : "выключено"}
        </span>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4",
        strong
          ? "text-sm font-semibold text-slate-950"
          : "text-sm text-slate-600",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

type PriceCalculatorClientProps = {
  preset?: ServiceCalculatorPreset;
  compactSections?: boolean;

  // NEW: prefill из выбранного освещения (используется в модалке Step0)
  prefillFromLighting?: {
    trackProfileMeters: number;
    pointSpotsQty: number;
    preferredTrackType?: TrackType | null;
  } | null;
  prefillFromLightingTrigger?: number;

  // P0.1: callback for the dark card CTA button
  onPrimaryCtaClick?: () => void;

  // V-3: Mobile sticky bottom bar — disabled in modal context
  showMobileStickyBar?: boolean;
};

export function PriceCalculatorClient({
  preset,
  compactSections = false,
  prefillFromLighting = null,
  prefillFromLightingTrigger = 0,
  onPrimaryCtaClick,
  showMobileStickyBar = true,
}: PriceCalculatorClientProps) {
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const resolvedAreaDefault = preset?.areaDefault ?? calculator.areaDefault;
  const resolvedCalculationScope = (preset?.calculationScopeDefault ?? "room") as CalculationScope;
  const resolvedCeilingType = (preset?.ceilingType ?? "standard") as CeilingType;
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount =
    preset?.lightsCount ?? calculator.lights.countDefault;

  const [calculationScope, setCalculationScope] = useState<CalculationScope>(resolvedCalculationScope);
  const [area, setArea] = useState<number>(resolvedAreaDefault);
  const [ceilingType, setCeilingType] =
    useState<CeilingType>(resolvedCeilingType);

  // Support for combined shadow + floating
  const [shadowEnabled, setShadowEnabled] = useState<boolean>(
    resolvedCeilingType === "shadow" || resolvedCeilingType === "shadow-floating"
  );
  const [floatingEnabled, setFloatingEnabled] = useState<boolean>(
    resolvedCeilingType === "floating" || resolvedCeilingType === "shadow-floating"
  );

  const [ceilingLength, setCeilingLength] = useState<number>(
    () => getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [ceilingLengthAuto, setCeilingLengthAuto] = useState<boolean>(true);

  const [shadowLength, setShadowLength] = useState<number>(
    () => preset?.shadowLengthDefault ?? getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [shadowLengthAuto, setShadowLengthAuto] = useState<boolean>(preset?.shadowLengthDefault == null);
  const [floatingLength, setFloatingLength] = useState<number>(
    () => preset?.floatingLengthDefault ?? getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [floatingLengthAuto, setFloatingLengthAuto] = useState<boolean>(preset?.floatingLengthDefault == null);

  const [lightLinesEnabled, setLightLinesEnabled] = useState<boolean>(preset?.lightLinesEnabled ?? false);
  const [lightLinesLength, setLightLinesLength] = useState<number>(
    preset?.lightLinesLengthDefault ?? calculator.lightLineMeters.default
  );

  const [corniceType, setCorniceType] =
    useState<CorniceType>(resolvedCorniceType);
  const [corniceLength, setCorniceLength] = useState<number>(
    preset?.corniceLengthDefault ?? calculator.corniceMeters.default
  );
  const [corniceLightingEnabled, setCorniceLightingEnabled] = useState<boolean>(
    preset?.corniceLightingEnabled ?? false
  );
  const [corniceLightingLength, setCorniceLightingLength] = useState<number>(
    preset?.corniceLightingLengthDefault ?? preset?.corniceLengthDefault ?? calculator.corniceMeters.default
  );
  const [corniceLightingPowerSupplies, setCorniceLightingPowerSupplies] = useState<number>(
    preset?.corniceLightingPowerSuppliesDefault ?? calculator.corniceLighting.powerSupplyDefault
  );

  const [trackType, setTrackType] = useState<TrackType>(resolvedTrackType);
  const [trackLength, setTrackLength] = useState<number>(
    preset?.trackLengthDefault ?? calculator.trackMeters.default
  );

  // NEW: Установка люстр
  const [chandeliersEnabled, setChandeliersEnabled] = useState<boolean>(false);
  const [chandeliersCount, setChandeliersCount] = useState<number>(1);

  const [lightsEnabled, setLightsEnabled] =
    useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount] = useState<number>(resolvedLightsCount);
  const [roomLabel, setRoomLabel] = useState<string>(preset?.roomLabelDefault ?? "Помещение 1");
  const roomSequenceRef = useRef(2);
  const roomApplyLockRef = useRef(false);
  const [rooms, setRooms] = useState<RoomConfig[]>(() =>
    resolvedCalculationScope === "room" && compactSections
      ? [
          {
            id: "room-1",
            label: preset?.roomLabelDefault ?? "Помещение 1",
            area: resolvedAreaDefault,
            ceilingType: resolvedCeilingType,
            shadowEnabled: resolvedCeilingType === "shadow" || resolvedCeilingType === "shadow-floating",
            shadowLength: preset?.shadowLengthDefault ?? getPerimeterSuggestion(resolvedAreaDefault).recommended,
            shadowLengthAuto: preset?.shadowLengthDefault == null,
            floatingEnabled: resolvedCeilingType === "floating" || resolvedCeilingType === "shadow-floating",
            floatingLength: preset?.floatingLengthDefault ?? getPerimeterSuggestion(resolvedAreaDefault).recommended,
            floatingLengthAuto: preset?.floatingLengthDefault == null,
            lightLinesEnabled: preset?.lightLinesEnabled ?? false,
            lightLinesLength: preset?.lightLinesLengthDefault ?? calculator.lightLineMeters.default,
            corniceType: resolvedCorniceType,
            corniceLength: preset?.corniceLengthDefault ?? calculator.corniceMeters.default,
            corniceLightingEnabled: preset?.corniceLightingEnabled ?? false,
            corniceLightingLength:
              preset?.corniceLightingLengthDefault ??
              preset?.corniceLengthDefault ??
              calculator.corniceMeters.default,
            corniceLightingPowerSupplies:
              preset?.corniceLightingPowerSuppliesDefault ?? calculator.corniceLighting.powerSupplyDefault,
            trackType: resolvedTrackType,
            trackLength: preset?.trackLengthDefault ?? calculator.trackMeters.default,
            chandeliersEnabled: false,
            chandeliersCount: 1,
            lightsEnabled: resolvedLightsEnabled,
            lightsCount: resolvedLightsCount,
          },
        ]
      : []
  );
  const [activeRoomId, setActiveRoomId] = useState<string | null>(
    resolvedCalculationScope === "room" && compactSections ? "room-1" : null
  );

  // чтобы prefill не перетирал ручные правки
  const [trackTypeTouched, setTrackTypeTouched] = useState(false);
  const [trackLengthTouched, setTrackLengthTouched] = useState(false);
  const [chandeliersTouched, setChandeliersTouched] = useState(false);
  const [lightsTouched, setLightsTouched] = useState(false);

  useEffect(() => {
    if (!compactSections) return;
    if (!prefillFromLighting) return;
    if (!prefillFromLightingTrigger) return;

    const frame = requestAnimationFrame(() => {
      // ВАЖНО: prefill — это не “взаимодействие пользователя”
      // setHasInteracted(true) здесь не ставим.

      const points = Math.max(
        0,
        Math.round(Number(prefillFromLighting.pointSpotsQty ?? 0))
      );

      // синк “в обе стороны”:
      // - если есть точки → подставим и включим
      // - если точек нет → выключим (если пользователь сам не трогал это поле)
      if (!lightsTouched) {
        if (points > 0) {
          setLightsEnabled(true);
          setLightsCount(points);
        } else {
          setLightsEnabled(false);
        }
      }

      const metersRaw = Number(prefillFromLighting.trackProfileMeters ?? 0);
      if (Number.isFinite(metersRaw) && metersRaw > 0 && !trackLengthTouched) {
        const normalized = clamp(
          roundToStep(metersRaw, calculator.trackMeters.step),
          calculator.trackMeters.min,
          calculator.trackMeters.max
        );

        setTrackLength(normalized);
      }

      const preferred = (prefillFromLighting.preferredTrackType ?? null) as TrackType | null;
      if (preferred && !trackTypeTouched) {
        setTrackType(preferred);
      } else if (!trackTypeTouched && metersRaw > 0) {
        setTrackType((prev) => (prev === "none" ? ("built-in" as TrackType) : prev));
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [
    compactSections,
    prefillFromLighting,
    prefillFromLightingTrigger,
    lightsTouched,
    trackLengthTouched,
    trackTypeTouched,
  ]);

  const effectiveCeilingType = useMemo<CeilingType>(() => {
    if (shadowEnabled && floatingEnabled) return "shadow-floating";
    if (shadowEnabled) return "shadow";
    if (floatingEnabled) return "floating";
    return "standard";
  }, [shadowEnabled, floatingEnabled]);

  const selectedCeiling = useMemo(
    () =>
      calculator.ceilingTypes.find((c) => c.slug === ceilingType) ??
      calculator.ceilingTypes[0],
    [ceilingType]
  );

  const shadowCeiling = useMemo(
    () => calculator.ceilingTypes.find((c) => c.slug === "shadow") ?? calculator.ceilingTypes[0],
    []
  );

  const floatingCeiling = useMemo(
    () => calculator.ceilingTypes.find((c) => c.slug === "floating") ?? calculator.ceilingTypes[0],
    []
  );

  const selectedCornice = useMemo(
    () =>
      calculator.cornices.find((c) => c.slug === corniceType) ??
      calculator.cornices[0],
    [corniceType]
  );

  const selectedTrack = useMemo(
    () =>
      calculator.tracks.find((t) => t.slug === trackType) ??
      calculator.tracks[0],
    [trackType]
  );

  const hasSpecialCeiling = shadowEnabled || floatingEnabled;
  const perimeterSuggestion = useMemo(
    () => getPerimeterSuggestion(area),
    [area]
  );

  const markInteracted = () => setHasInteracted(true);

  const handleAreaChange = (v: number) => {
    markInteracted();
    setArea(v);

    if (shadowEnabled && shadowLengthAuto) {
      setShadowLength(getPerimeterSuggestion(v).recommended);
    }
    if (floatingEnabled && floatingLengthAuto) {
      setFloatingLength(getPerimeterSuggestion(v).recommended);
    }
    if (hasSpecialCeiling && ceilingLengthAuto) {
      setCeilingLength(getPerimeterSuggestion(v).recommended);
    }
  };

  const handleCeilingTypeChange = (slug: CeilingType) => {
    markInteracted();
    setCeilingType(slug);

    if (slug !== "standard") {
      setCeilingLengthAuto(true);
      setCeilingLength(getPerimeterSuggestion(area).recommended);
    }
  };

  const toggleShadow = () => {
    markInteracted();
    setShadowEnabled((prev) => {
      const next = !prev;
      if (next) {
        setShadowLengthAuto(true);
        setShadowLength(getPerimeterSuggestion(area).recommended);
      }
      return next;
    });
  };

  const toggleFloating = () => {
    markInteracted();
    setFloatingEnabled((prev) => {
      const next = !prev;
      if (next) {
        setFloatingLengthAuto(true);
        setFloatingLength(getPerimeterSuggestion(area).recommended);
      }
      return next;
    });
  };

  const handleShadowLengthChange = (v: number) => {
    markInteracted();
    setShadowLengthAuto(false);
    setShadowLength(v);
  };

  const handleFloatingLengthChange = (v: number) => {
    markInteracted();
    setFloatingLengthAuto(false);
    setFloatingLength(v);
  };

  const handleCeilingLengthChange = (v: number) => {
    markInteracted();
    setCeilingLengthAuto(false);
    setCeilingLength(v);
  };

  const applyPerimeterSuggestion = () => {
    markInteracted();
    setCeilingLengthAuto(true);
    setCeilingLength(perimeterSuggestion.recommended);
  };

  // ---- totals ----
  const ceilingBaseRate = hasSpecialCeiling ? shadowCeiling.baseRatePerSqm : selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = area * ceilingBaseRate;

  const shadowExtraTotal = shadowEnabled
    ? shadowLength * shadowCeiling.extraRatePerMeter
    : 0;

  const floatingExtraTotal = floatingEnabled
    ? floatingLength * floatingCeiling.extraRatePerMeter
    : 0;

  const ceilingExtraTotal = hasSpecialCeiling
    ? shadowExtraTotal + floatingExtraTotal
    : 0;

  const lightLinesTotal = lightLinesEnabled
    ? lightLinesLength * calculator.lightLines.ratePerMeter
    : 0;

  const corniceTotal =
    selectedCornice.ratePerMeter > 0
      ? corniceLength * selectedCornice.ratePerMeter
      : 0;

  const corniceLightingMetersTotal = corniceLightingEnabled
    ? corniceLightingLength * calculator.corniceLighting.ratePerMeter
    : 0;
  const corniceLightingPowerSupplyTotal = corniceLightingEnabled
    ? corniceLightingPowerSupplies * calculator.corniceLighting.powerSupplyRate
    : 0;
  const corniceLightingTotal = corniceLightingMetersTotal + corniceLightingPowerSupplyTotal;

  const trackTotal =
    selectedTrack.ratePerMeter > 0
      ? trackLength * selectedTrack.ratePerMeter
      : 0;

  const chandeliersTotal = chandeliersEnabled
    ? chandeliersCount * CHANDELIERS_INSTALL_RATE_PER_UNIT
    : 0;

  const lightsTotal = lightsEnabled
    ? lightsCount * calculator.lights.ratePerUnit
    : 0;

  const total =
    ceilingBaseTotal +
    ceilingExtraTotal +
    lightLinesTotal +
    corniceTotal +
    corniceLightingTotal +
    trackTotal +
    chandeliersTotal +
    lightsTotal;

  // derived inputs
  const derivedTrackMountType: DerivedInputs["trackMountType"] =
    trackType === "built-in"
      ? "built-in"
      : trackType === "surface"
        ? "surface"
        : "none";

  const derivedTrackLength = trackType !== "none" ? trackLength : 0;

  const derivedInputs = useMemo<DerivedInputs>(
    () => ({
      pointSpotsQty: lightsEnabled ? lightsCount : 0,
      trackMountType: derivedTrackMountType,
      trackLengthMeters: derivedTrackLength,
      recommendedTrackSpotsQty: calcRecommendedTrackSpots(derivedTrackLength),
    }),
    [lightsEnabled, lightsCount, derivedTrackMountType, derivedTrackLength]
  );

  const currentRoomConfig = useMemo<RoomConfig>(
    () => ({
      id: activeRoomId ?? "room-current",
      label: roomLabel,
      area,
      ceilingType,
      shadowEnabled,
      shadowLength,
      shadowLengthAuto,
      floatingEnabled,
      floatingLength,
      floatingLengthAuto,
      lightLinesEnabled,
      lightLinesLength,
      corniceType,
      corniceLength,
      corniceLightingEnabled,
      corniceLightingLength,
      corniceLightingPowerSupplies,
      trackType,
      trackLength,
      chandeliersEnabled,
      chandeliersCount,
      lightsEnabled,
      lightsCount,
    }),
    [
      activeRoomId,
      roomLabel,
      area,
      ceilingType,
      shadowEnabled,
      shadowLength,
      shadowLengthAuto,
      floatingEnabled,
      floatingLength,
      floatingLengthAuto,
      lightLinesEnabled,
      lightLinesLength,
      corniceType,
      corniceLength,
      corniceLightingEnabled,
      corniceLightingLength,
      corniceLightingPowerSupplies,
      trackType,
      trackLength,
      chandeliersEnabled,
      chandeliersCount,
      lightsEnabled,
      lightsCount,
    ]
  );

  useEffect(() => {
    if (!compactSections || calculationScope !== "room" || !activeRoomId) return;
    if (roomApplyLockRef.current) return;

    setRooms((prev) => {
      const hasRoom = prev.some((room) => room.id === activeRoomId);
      if (!hasRoom) return prev;
      return prev.map((room) => (room.id === activeRoomId ? { ...currentRoomConfig } : room));
    });
  }, [activeRoomId, calculationScope, compactSections, currentRoomConfig]);

  useEffect(() => {
    if (!compactSections) return;

    setRooms((prev) => {
      if (calculationScope === "room") {
        if (prev.length > 0) return prev;
        return [{ ...currentRoomConfig, id: "room-1", label: roomLabel || "Помещение 1" }];
      }
      return prev;
    });

    if (calculationScope === "room" && !activeRoomId) {
      setActiveRoomId("room-1");
    }
  }, [activeRoomId, calculationScope, compactSections, currentRoomConfig, roomLabel]);

  const applyRoomConfig = (room: RoomConfig) => {
    roomApplyLockRef.current = true;
    setRoomLabel(room.label);
    setArea(room.area);
    setCeilingType(room.ceilingType);
    setShadowEnabled(room.shadowEnabled);
    setShadowLength(room.shadowLength);
    setShadowLengthAuto(room.shadowLengthAuto);
    setFloatingEnabled(room.floatingEnabled);
    setFloatingLength(room.floatingLength);
    setFloatingLengthAuto(room.floatingLengthAuto);
    setLightLinesEnabled(room.lightLinesEnabled);
    setLightLinesLength(room.lightLinesLength);
    setCorniceType(room.corniceType);
    setCorniceLength(room.corniceLength);
    setCorniceLightingEnabled(room.corniceLightingEnabled);
    setCorniceLightingLength(room.corniceLightingLength);
    setCorniceLightingPowerSupplies(room.corniceLightingPowerSupplies);
    setTrackType(room.trackType);
    setTrackLength(room.trackLength);
    setChandeliersEnabled(room.chandeliersEnabled);
    setChandeliersCount(room.chandeliersCount);
    setLightsEnabled(room.lightsEnabled);
    setLightsCount(room.lightsCount);

    requestAnimationFrame(() => {
      roomApplyLockRef.current = false;
    });
  };

  useEffect(() => {
    if (!compactSections || calculationScope !== "room" || !activeRoomId) return;
    const room = rooms.find((item) => item.id === activeRoomId);
    if (!room) return;
    if (roomApplyLockRef.current) return;

    const isSame = JSON.stringify(room) === JSON.stringify(currentRoomConfig);
    if (isSame) return;

    applyRoomConfig(room);
  }, [activeRoomId, calculationScope, compactSections, rooms]);

  const currentSnapshot = useMemo<CalculatorLeadSnapshot>(
    () => ({
      area,
      calculationScope,
      ceilingTypeLabel: !shadowEnabled && !floatingEnabled
        ? "Простой потолок"
        : `${shadowEnabled ? "Теневой" : ""}${shadowEnabled && floatingEnabled ? " + " : ""}${floatingEnabled ? "Парящий" : ""}`,
      ceilingBaseRate,
      ceilingBaseTotal,

      ceilingExtraLabel: hasSpecialCeiling
        ? (shadowEnabled && floatingEnabled
            ? "Теневой + парящий профиль"
            : shadowEnabled
              ? shadowCeiling.extraLabel ?? null
              : floatingCeiling.extraLabel ?? null)
        : null,
      ceilingLength: hasSpecialCeiling ? ceilingLength : null,
      ceilingExtraRatePerMeter: hasSpecialCeiling
        ? (shadowEnabled && floatingEnabled
            ? null
            : shadowEnabled
              ? shadowCeiling.extraRatePerMeter
              : floatingCeiling.extraRatePerMeter)
        : null,
      ceilingExtraTotal,

      shadowEnabled,
      shadowLength: shadowEnabled ? shadowLength : null,
      shadowExtraTotal,
      floatingEnabled,
      floatingLength: floatingEnabled ? floatingLength : null,
      floatingExtraTotal,

      lightLinesEnabled,
      lightLinesLabel: lightLinesEnabled ? calculator.lightLines.label : null,
      lightLinesLength: lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled
        ? calculator.lightLines.ratePerMeter
        : null,
      lightLinesTotal,

      corniceLabel:
        selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
      corniceLength:
        selectedCornice.ratePerMeter > 0 ? corniceLength : null,
      corniceRatePerMeter:
        selectedCornice.ratePerMeter > 0 ? selectedCornice.ratePerMeter : null,
      corniceTotal,
      corniceLightingEnabled,
      corniceLightingLabel: corniceLightingEnabled ? calculator.corniceLighting.label : null,
      corniceLightingLength: corniceLightingEnabled ? corniceLightingLength : null,
      corniceLightingRatePerMeter: corniceLightingEnabled
        ? calculator.corniceLighting.ratePerMeter
        : null,
      corniceLightingPowerSupplies: corniceLightingEnabled ? corniceLightingPowerSupplies : null,
      corniceLightingPowerSupplyRate: corniceLightingEnabled
        ? calculator.corniceLighting.powerSupplyRate
        : null,
      corniceLightingTotal,

      trackLabel:
        selectedTrack.ratePerMeter > 0 ? selectedTrack.label : null,
      trackLength: selectedTrack.ratePerMeter > 0 ? trackLength : null,
      trackRatePerMeter:
        selectedTrack.ratePerMeter > 0 ? selectedTrack.ratePerMeter : null,
      trackTotal,

      chandeliersEnabled,
      chandeliersCount: chandeliersEnabled ? chandeliersCount : null,
      chandeliersRatePerUnit: CHANDELIERS_INSTALL_RATE_PER_UNIT,
      chandeliersTotal,

      lightsEnabled,
      lightsCount: lightsEnabled ? lightsCount : null,
      lightsRatePerUnit: calculator.lights.ratePerUnit,
      lightsTotal,

      total,
      derivedInputs,
    }),
    [
      area,
      calculationScope,
      selectedCeiling,
      ceilingBaseRate,
      ceilingBaseTotal,
      hasSpecialCeiling,
      ceilingLength,
      shadowCeiling,
      shadowEnabled,
      shadowLength,
      shadowExtraTotal,
      floatingCeiling,
      floatingEnabled,
      floatingLength,
      floatingExtraTotal,
      ceilingExtraTotal,
      lightLinesEnabled,
      lightLinesLength,
      lightLinesTotal,
      selectedCornice,
      corniceLength,
      corniceTotal,
      corniceLightingEnabled,
      corniceLightingLength,
      corniceLightingPowerSupplies,
      corniceLightingTotal,
      selectedTrack,
      trackLength,
      trackTotal,
      chandeliersEnabled,
      chandeliersCount,
      chandeliersTotal,
      lightsEnabled,
      lightsCount,
      lightsTotal,
      total,
      derivedInputs,
    ]
  );

  const effectiveRooms = useMemo(() => {
    if (!compactSections || calculationScope !== "room") return [] as RoomConfig[];
    if (!activeRoomId) return rooms;

    return rooms.map((room) => (room.id === activeRoomId ? currentRoomConfig : room));
  }, [activeRoomId, calculationScope, compactSections, currentRoomConfig, rooms]);

  const effectiveSnapshot = useMemo<CalculatorLeadSnapshot>(() => {
    if (!compactSections || calculationScope !== "room" || effectiveRooms.length === 0) {
      return currentSnapshot;
    }

    const roomSnapshots = effectiveRooms.map((room) => ({
      room,
      snapshot: calcRoomSnapshot(room),
    }));

    const totalArea = roomSnapshots.reduce((sum, item) => sum + item.snapshot.area, 0);
    const totalCeilingBase = roomSnapshots.reduce((sum, item) => sum + item.snapshot.ceilingBaseTotal, 0);
    const totalCeilingExtra = roomSnapshots.reduce((sum, item) => sum + item.snapshot.ceilingExtraTotal, 0);
    const totalLightLines = roomSnapshots.reduce((sum, item) => sum + item.snapshot.lightLinesTotal, 0);
    const totalCornice = roomSnapshots.reduce((sum, item) => sum + item.snapshot.corniceTotal, 0);
    const totalCorniceLighting = roomSnapshots.reduce(
      (sum, item) => sum + toNumber(item.snapshot.corniceLightingTotal),
      0
    );
    const totalTrack = roomSnapshots.reduce((sum, item) => sum + item.snapshot.trackTotal, 0);
    const totalChandeliers = roomSnapshots.reduce(
      (sum, item) => sum + toNumber(item.snapshot.chandeliersTotal),
      0
    );
    const totalLights = roomSnapshots.reduce((sum, item) => sum + item.snapshot.lightsTotal, 0);
    const overallTotal = roomSnapshots.reduce((sum, item) => sum + item.snapshot.total, 0);
    const totalShadow = roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.shadowLength), 0);
    const totalFloating = roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.floatingLength), 0);
    const totalTrackMeters = roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.trackLength), 0);
    const totalPointQty = roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.lightsCount), 0);

    const hasBuiltInTrack = roomSnapshots.some((item) => item.snapshot.derivedInputs.trackMountType === "built-in");
    const hasSurfaceTrack = roomSnapshots.some((item) => item.snapshot.derivedInputs.trackMountType === "surface");
    const aggregateTrackMountType: DerivedInputs["trackMountType"] = hasBuiltInTrack && !hasSurfaceTrack
      ? "built-in"
      : !hasBuiltInTrack && hasSurfaceTrack
        ? "surface"
        : "none";

    return {
      ...currentSnapshot,
      area: totalArea,
      calculationScope: "room",
      roomBreakdown: roomSnapshots.map(({ room, snapshot }) => ({
        id: room.id,
        label: room.label,
        area: snapshot.area,
        totalRub: snapshot.total,
        ceilingTypeLabel: snapshot.ceilingTypeLabel,
        shadowLength: snapshot.shadowLength,
        floatingLength: snapshot.floatingLength,
        lightLinesLength: snapshot.lightLinesLength,
        corniceLabel: snapshot.corniceLabel,
        corniceLength: snapshot.corniceLength,
        corniceLightingLength: snapshot.corniceLightingLength,
        trackLabel: snapshot.trackLabel,
        trackLength: snapshot.trackLength,
        lightsCount: snapshot.lightsCount,
        chandeliersCount: snapshot.chandeliersCount,
      })),
      ceilingTypeLabel: `Конфигурация по помещениям (${roomSnapshots.length})`,
      ceilingBaseTotal: totalCeilingBase,
      ceilingExtraLabel: totalShadow > 0 && totalFloating > 0
        ? "Теневой + парящий профиль"
        : totalShadow > 0
          ? shadowCeiling.extraLabel ?? null
          : totalFloating > 0
            ? floatingCeiling.extraLabel ?? null
            : null,
      ceilingExtraTotal: totalCeilingExtra,
      shadowEnabled: totalShadow > 0,
      shadowLength: totalShadow > 0 ? totalShadow : null,
      shadowExtraTotal: roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.shadowExtraTotal), 0),
      floatingEnabled: totalFloating > 0,
      floatingLength: totalFloating > 0 ? totalFloating : null,
      floatingExtraTotal: roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.floatingExtraTotal), 0),
      lightLinesEnabled: totalLightLines > 0,
      lightLinesLength: totalLightLines > 0 ? roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.lightLinesLength), 0) : null,
      lightLinesTotal: totalLightLines,
      corniceTotal: totalCornice,
      corniceLightingEnabled: totalCorniceLighting > 0,
      corniceLightingLength: totalCorniceLighting > 0
        ? roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.corniceLightingLength), 0)
        : null,
      corniceLightingPowerSupplies: totalCorniceLighting > 0
        ? roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.corniceLightingPowerSupplies), 0)
        : null,
      corniceLightingTotal: totalCorniceLighting,
      trackTotal: totalTrack,
      trackLength: totalTrack > 0 ? totalTrackMeters : null,
      chandeliersEnabled: totalChandeliers > 0,
      chandeliersCount: totalChandeliers > 0
        ? roomSnapshots.reduce((sum, item) => sum + toNumber(item.snapshot.chandeliersCount), 0)
        : null,
      chandeliersTotal: totalChandeliers,
      lightsEnabled: totalLights > 0,
      lightsCount: totalLights > 0 ? totalPointQty : null,
      lightsTotal: totalLights,
      total: overallTotal,
      derivedInputs: {
        pointSpotsQty: totalPointQty,
        trackMountType: aggregateTrackMountType,
        trackLengthMeters: totalTrackMeters,
        recommendedTrackSpotsQty: calcRecommendedTrackSpots(totalTrackMeters),
      },
    };
  }, [
    calculationScope,
    compactSections,
    currentSnapshot,
    currentRoomConfig,
    effectiveRooms,
    floatingCeiling.extraLabel,
    shadowCeiling.extraLabel,
  ]);

  useEffect(() => {
    setSnapshot((prev) => {
      if (prev == null) return effectiveSnapshot;

      return {
        ...effectiveSnapshot,
        leadSource: prev.leadSource ?? effectiveSnapshot.leadSource,
        lighting: prev.lighting,
        grandTotal: prev.grandTotal,
        _reconciled: prev._reconciled,
      };
    });
  }, [effectiveSnapshot, setSnapshot]);

  const isRoomScopeMulti = compactSections && calculationScope === "room";
  const displayTotal = isRoomScopeMulti ? effectiveSnapshot.total : total;
  const showSlider = !compactSections;

  // ===== compact guided flow: один шаг открыт, остальные закрыты =====
  const compactSteps: CompactStepId[] = useMemo(() => {
    const steps: CompactStepId[] = ["area", "ceiling"];
    if (shadowEnabled) steps.push("shadowProfile");
    if (floatingEnabled) steps.push("floatingProfile");
    steps.push("lightLines", "cornice", "track", "chandeliers", "lights");
    return steps;
  }, [shadowEnabled, floatingEnabled]);

  const [activeStep, setActiveStep] = useState<CompactStepId>("area");
  const [resumeStep, setResumeStep] = useState<CompactStepId | null>(null);

  const [confirmed, setConfirmed] = useState<Record<CompactStepId, boolean>>({
    area: !compactSections,
    ceiling: !compactSections,
    shadowProfile: !compactSections,
    floatingProfile: !compactSections,
    lightLines: !compactSections,
    cornice: !compactSections,
    track: !compactSections,
    chandeliers: !compactSections,
    lights: !compactSections,
  });
  const [roomConfirmedMap, setRoomConfirmedMap] = useState<Record<string, Record<CompactStepId, boolean>>>({});

  const currentRoomConfirmedState = activeRoomId ? roomConfirmedMap[activeRoomId] : null;
  const isCurrentRoomComplete = Boolean(
    currentRoomConfirmedState && compactSteps.every((step) => currentRoomConfirmedState[step])
  );
  const completedRoomsCount = effectiveRooms.filter((room) => {
    const state = roomConfirmedMap[room.id];
    return state ? compactSteps.every((step) => state[step]) : false;
  }).length;
  const nextIncompleteRoom =
    effectiveRooms.find((room) => {
      if (room.id === activeRoomId) return false;
      const state = roomConfirmedMap[room.id];
      return !(state && compactSteps.every((step) => state[step]));
    }) ?? null;

  const getConfirmedStateForBlankRoom = (): Record<CompactStepId, boolean> => ({
    area: false,
    ceiling: false,
    shadowProfile: false,
    floatingProfile: false,
    lightLines: false,
    cornice: false,
    track: false,
    chandeliers: false,
    lights: false,
  });

  const getConfirmedStateForFilledRoom = (): Record<CompactStepId, boolean> => ({
    area: true,
    ceiling: true,
    shadowProfile: true,
    floatingProfile: true,
    lightLines: true,
    cornice: true,
    track: true,
    chandeliers: true,
    lights: true,
  });

  useEffect(() => {
    if (!compactSections || calculationScope !== "room") return;
    setRoomConfirmedMap((prev) => {
      if (prev["room-1"]) return prev;
      return { ...prev, "room-1": getConfirmedStateForBlankRoom() };
    });
  }, [calculationScope, compactSections]);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const ceilingRef = useRef<HTMLDivElement | null>(null);
  const shadowProfileRef = useRef<HTMLDivElement | null>(null);
  const floatingProfileRef = useRef<HTMLDivElement | null>(null);
  const lightLinesRef = useRef<HTMLDivElement | null>(null);
  const corniceRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const chandeliersRef = useRef<HTMLDivElement | null>(null);
  const lightsRef = useRef<HTMLDivElement | null>(null);

  const getRef = (id: CompactStepId) => {
    switch (id) {
      case "area":
        return areaRef;
      case "ceiling":
        return ceilingRef;
      case "shadowProfile":
        return shadowProfileRef;
      case "floatingProfile":
        return floatingProfileRef;
      case "lightLines":
        return lightLinesRef;
      case "cornice":
        return corniceRef;
      case "track":
        return trackRef;
      case "chandeliers":
        return chandeliersRef;
      case "lights":
        return lightsRef;
    }
  };

  useEffect(() => {
    if (!compactSections || calculationScope !== "room" || !activeRoomId) return;
    setRoomConfirmedMap((prev) => ({
      ...prev,
      [activeRoomId]: confirmed,
    }));
  }, [activeRoomId, calculationScope, compactSections, confirmed]);

  const stepIndex = (id: CompactStepId) => compactSteps.indexOf(id);

  const isStepEnabled = (id: CompactStepId) => {
    const idx = stepIndex(id);
    if (idx <= 0) return true;
    const prevId = compactSteps[idx - 1];
    return Boolean(confirmed[prevId]);
  };

  const scrollToStep = (id: CompactStepId, behavior: ScrollBehavior = "smooth") => {
    const el = getRef(id).current;
    if (!el) return;
    const OFFSET = 92;
    scrollIntoViewWithOffset(el, OFFSET, behavior);
  };

  const nextUnconfirmedAfter = (id: CompactStepId) => {
    const idx = stepIndex(id);
    if (idx < 0) return null;

    for (let i = idx + 1; i < compactSteps.length; i++) {
      const step = compactSteps[i];
      if (!confirmed[step]) return step;
    }
    return null;
  };

  const openStep = (id: CompactStepId) => {
    if (!isStepEnabled(id)) return;

    setActiveStep(id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToStep(id, "smooth"));
    });
  };

  const switchToRoom = (roomId: string) => {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    setActiveRoomId(roomId);
    setConfirmed(roomConfirmedMap[roomId] ?? getConfirmedStateForFilledRoom());
    setActiveStep("area");
    setResumeStep(null);
    applyRoomConfig(room);
  };

  const addRoom = (label?: string) => {
    const nextLabel = label && label !== "Другое" ? label : `Помещение ${roomSequenceRef.current}`;
    const nextRoom: RoomConfig = {
      id: `room-${roomSequenceRef.current}`,
      label: nextLabel,
      area: calculator.areaDefault,
      ceilingType: "standard",
      shadowEnabled: false,
      shadowLength: getPerimeterSuggestion(calculator.areaDefault).recommended,
      shadowLengthAuto: true,
      floatingEnabled: false,
      floatingLength: getPerimeterSuggestion(calculator.areaDefault).recommended,
      floatingLengthAuto: true,
      lightLinesEnabled: false,
      lightLinesLength: calculator.lightLineMeters.default,
      corniceType: "none",
      corniceLength: calculator.corniceMeters.default,
      corniceLightingEnabled: false,
      corniceLightingLength: calculator.corniceMeters.default,
      corniceLightingPowerSupplies: calculator.corniceLighting.powerSupplyDefault,
      trackType: "none",
      trackLength: calculator.trackMeters.default,
      chandeliersEnabled: false,
      chandeliersCount: 1,
      lightsEnabled: false,
      lightsCount: calculator.lights.countDefault,
    };

    roomSequenceRef.current += 1;
    setRooms((prev) => [...prev, nextRoom]);
    setRoomConfirmedMap((prev) => ({
      ...prev,
      [nextRoom.id]: getConfirmedStateForBlankRoom(),
    }));
    setActiveRoomId(nextRoom.id);
    setConfirmed(getConfirmedStateForBlankRoom());
    setResumeStep(null);
    setActiveStep("area");
    applyRoomConfig(nextRoom);
  };

  const removeRoom = (roomId: string) => {
    if (rooms.length <= 1) return;

    const currentIndex = rooms.findIndex((room) => room.id === roomId);
    const filtered = rooms.filter((room) => room.id !== roomId);
    setRooms(filtered);
    setRoomConfirmedMap((prev) => {
      const next = { ...prev };
      delete next[roomId];
      return next;
    });

    const nextRoom = filtered[Math.max(0, currentIndex - 1)] ?? filtered[0] ?? null;
    if (nextRoom) {
      setActiveRoomId(nextRoom.id);
      setConfirmed(roomConfirmedMap[nextRoom.id] ?? getConfirmedStateForFilledRoom());
      setResumeStep(null);
      applyRoomConfig(nextRoom);
    }
  };

  const beginEdit = (id: CompactStepId) => {
    setResumeStep((prev) => prev ?? activeStep);
    setConfirmed((prev) => ({ ...prev, [id]: false }));
    openStep(id);
  };

  const confirmAndNavigate = (id: CompactStepId) => {
    setConfirmed((prev) => ({ ...prev, [id]: true }));

    const maybeResume =
      resumeStep && compactSteps.includes(resumeStep) ? resumeStep : null;
    const fallbackNext = nextUnconfirmedAfter(id);

    const nextTarget =
      maybeResume && maybeResume !== id ? maybeResume : fallbackNext;

    if (maybeResume) setResumeStep(null);
    if (!nextTarget) return;

    setTimeout(() => {
      scrollToStep(nextTarget, "smooth");

      requestAnimationFrame(() => {
        setActiveStep(nextTarget);
        requestAnimationFrame(() => scrollToStep(nextTarget, "auto"));
      });
    }, 0);
  };

  useEffect(() => {
    if (!compactSections) return;

    const frame = requestAnimationFrame(() => {
      setConfirmed((prev) => {
        const next = { ...prev };
        next.shadowProfile = shadowEnabled ? false : true;
        next.floatingProfile = floatingEnabled ? false : true;
        return next;
      });

      setActiveStep((prev) => {
        if (prev === "shadowProfile" && !shadowEnabled) return "lightLines";
        if (prev === "floatingProfile" && !floatingEnabled) return "lightLines";
        return prev;
      });
    });

    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowEnabled, floatingEnabled, compactSections]);

  if (compactSections) {
    // V-5: step numbers removed — titles hardcoded without numbers

    const scrollToAction = () => {
      if (typeof document !== "undefined") {
        const el = document.getElementById("action");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const ceilingMeta =
      ceilingType === "standard"
        ? `от ${formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м²`
        : `${formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м² + ${formatCurrency(selectedCeiling.extraRatePerMeter)} ₽ / м.п.`;

    const corniceValue =
      selectedCornice.ratePerMeter > 0
        ? `${selectedCornice.label}, ${corniceLength} м.п.${corniceLightingEnabled ? ` · подсветка ${corniceLightingLength} м.п. · БП ${corniceLightingPowerSupplies} шт.` : ""}`
        : "не нужен";

    const trackValue =
      selectedTrack.ratePerMeter > 0
        ? `${selectedTrack.label}, ${trackLength} м.п.`
        : "не нужен";

    const chandeliersValue = chandeliersEnabled ? `${chandeliersCount} шт.` : "не нужна";
    const lightsValue = lightsEnabled ? `${lightsCount} шт.` : "не нужны";
    const lightLinesValue = lightLinesEnabled ? `${lightLinesLength} м.п.` : "не нужны";

    return (
      <>
      <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8 max-sm:gap-3 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
        {/* LEFT */}
        <div className="min-w-0 space-y-5 max-sm:space-y-3">
          {isRoomScopeMulti ? (
            <SectionCard
              title="Помещения в расчёте"
              description="Считайте комнаты по очереди: у каждой помещения своя конфигурация, а справа и внизу сразу виден общий итог по объекту."
            >
              <div className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Сейчас редактируете</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{roomLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Помещений</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{effectiveRooms.length}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Готово</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{completedRoomsCount}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Общий ориентир</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(displayTotal)} ₽</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {effectiveRooms.map((room) => {
                  const isActive = room.id === activeRoomId;
                  const roomSnapshot = calcRoomSnapshot(room);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => switchToRoom(room.id)}
                      className={[
                        "rounded-2xl border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold">{room.label}</p>
                        {roomConfirmedMap[room.id] && compactSteps.every((step) => roomConfirmedMap[room.id][step]) ? (
                          <span className={isActive ? "rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white" : "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"}>
                            Готово
                          </span>
                        ) : (
                          <span className={isActive ? "rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white/80" : "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"}>
                            В работе
                          </span>
                        )}
                      </div>
                      <p className={isActive ? "mt-1 text-xs text-white/70" : "mt-1 text-xs text-slate-500"}>
                        {room.area} м² · {formatCurrency(roomSnapshot.total)} ₽
                      </p>
                      {isActive ? (
                        <p className="mt-1 text-[11px] font-medium text-white/60">Сейчас редактируется</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Добавить помещение</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ROOM_TYPE_OPTIONS.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => addRoom(label)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      + {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Добавьте все нужные комнаты — итог по объекту будет суммироваться автоматически.
                </p>
              </div>

              {rooms.length > 1 ? (
                <button
                  type="button"
                  onClick={() => activeRoomId && removeRoom(activeRoomId)}
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  Удалить текущее помещение
                </button>
              ) : null}

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">
                  {isCurrentRoomComplete ? "Помещение заполнено" : "Продолжайте заполнять текущее помещение"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {isCurrentRoomComplete
                    ? nextIncompleteRoom
                      ? `Комната «${roomLabel}» готова. Можно перейти к следующему помещению или сразу посмотреть общий итог.`
                      : "Все текущие помещения заполнены. Можно добавить ещё одну комнату или перейти к общему итогу."
                    : "Сначала подтвердите текущие шаги для этой комнаты: площадь, конфигурацию и дополнительные узлы."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isCurrentRoomComplete && nextIncompleteRoom ? (
                    <Button type="button" variant="secondary" onClick={() => switchToRoom(nextIncompleteRoom.id)}>
                      К следующей комнате →
                    </Button>
                  ) : null}
                  {isCurrentRoomComplete ? (
                    <Button type="button" onClick={onPrimaryCtaClick ?? (() => scrollToAction())}>
                      К общему итогу →
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" onClick={() => addRoom()}>
                    Добавить ещё помещение
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : null}

          {/* AREA */}
          <div ref={areaRef}>
            {confirmed.area ? (
              <SectionCard title={`Площадь`}>
                <SummaryRow
                  label="Расчёт"
                  value={`${calculationScope === "object" ? "Весь объект" : roomLabel} · ${area} м²`}
                  onEdit={() => beginEdit("area")}
                />
              </SectionCard>
            ) : activeStep === "area" ? (
              <SectionCard
                title={`Площадь`}
                description="Сначала выберите формат расчёта. Площадь считается отдельно, а профили и узлы — только по нужным участкам в метрах."
              >
                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={calculationScope === "room"}
                    title="Отдельное помещение"
                    meta="Кухня, спальня, гостиная, санузел и другие помещения поэтапно"
                    onClick={() => {
                      markInteracted();
                      setCalculationScope("room");
                    }}
                  />
                  <OptionCard
                    active={calculationScope === "object"}
                    title="Весь объект"
                    meta="Квартира или дом целиком, если уже понятен общий объём"
                    onClick={() => {
                      markInteracted();
                      setCalculationScope("object");
                    }}
                  />
                </div>
                {calculationScope === "room" ? (
                  <div className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <p className="text-sm font-medium text-slate-700">Тип помещения</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ROOM_TYPE_OPTIONS.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            markInteracted();
                            if (label !== "Другое") setRoomLabel(label);
                          }}
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                            label !== "Другое" && roomLabel === label
                              ? "bg-slate-950 text-white"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                          ].join(" ")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <Input
                        label="Название помещения"
                        value={roomLabel}
                        onChange={(event) => {
                          markInteracted();
                          setRoomLabel(event.target.value);
                        }}
                        placeholder="Например: Кухня-гостиная"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Это название будет видно в общем списке помещений и в итоговом расчёте.
                      </p>
                    </div>
                  </div>
                ) : null}
                <RangeField
                  id="area-field"
                  label={calculationScope === "object" ? "Укажите общую площадь объекта" : "Выберите площадь помещения"}
                  value={area}
                  min={calculator.areaMin}
                  max={calculator.areaMax}
                  step={calculator.areaStep}
                  unit="м²"
                  onChange={handleAreaChange}
                  showSlider={showSlider}
                  quickValues={[10, 15, 20, 25, 30, 40, 50, 60, 80]}
                />
                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Пресет или введите вручную. Для больших площадей — просто наберите число.</p>
                  <Button type="button" variant="secondary" className="step0-confirm-button step0-confirm-area max-sm:hidden" onClick={() => confirmAndNavigate("area")}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Площадь`}
                subtitle={calculationScope === "object" ? "Выберите формат и общую площадь" : "Выберите формат, помещение и площадь"}
                enabled
                onOpen={() => openStep("area")}
              />
            )}
          </div>

          {/* CEILING */}
          <div ref={ceilingRef}>
            {confirmed.ceiling ? (
              <SectionCard title={`Тип потолка`}>
                <SummaryRow
                  label="Тип"
                  value={
                    !shadowEnabled && !floatingEnabled
                      ? `Простой потолок · от ${formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м²`
                      : `${shadowEnabled ? "Теневой" : ""}${shadowEnabled && floatingEnabled ? " + " : ""}${floatingEnabled ? "Парящий" : ""} · от ${formatCurrency(shadowCeiling.baseRatePerSqm)} ₽ / м²`
                  }
                  onEdit={() => beginEdit("ceiling")}
                />
              </SectionCard>
            ) : activeStep === "ceiling" ? (
              <SectionCard
                title={`Тип потолка`}
                description="Базовая площадь считается отдельно. Теневой и парящий указывайте только на нужных участках — они не обязаны идти по всему периметру."
              >
                {/* Simple ceiling option */}
                <div
                  className={["rounded-2xl border p-4 text-left transition-all mb-3",
                    !shadowEnabled && !floatingEnabled
                      ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                      : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => { markInteracted(); setShadowEnabled(false); setFloatingEnabled(false); }}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-semibold">Простой потолок</p>
                    <p className={["mt-1 text-xs", !shadowEnabled && !floatingEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                      от {formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м²
                    </p>
                  </button>
                </div>

                {/* Shadow + Floating checkboxes */}
                <div className="space-y-3">
                  <div
                    className={["rounded-2xl border p-4 text-left transition-all",
                      shadowEnabled
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <button type="button" onClick={toggleShadow} className="w-full text-left flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Теневой потолок</p>
                        <p className={["mt-1 text-xs", shadowEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                          {formatCurrency(shadowCeiling.baseRatePerSqm)} ₽ / м² + {formatCurrency(shadowCeiling.extraRatePerMeter)} ₽ / м.п.
                        </p>
                      </div>
                      <span className={["mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs",
                        shadowEnabled ? "border-white bg-white text-slate-950" : "border-slate-300 bg-transparent"
                      ].join(" ")}>{shadowEnabled ? "✓" : ""}</span>
                    </button>
                  </div>

                  <div
                    className={["rounded-2xl border p-4 text-left transition-all",
                      floatingEnabled
                        ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                        : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <button type="button" onClick={toggleFloating} className="w-full text-left flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Парящий потолок</p>
                        <p className={["mt-1 text-xs", floatingEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                          {formatCurrency(floatingCeiling.baseRatePerSqm)} ₽ / м² + {formatCurrency(floatingCeiling.extraRatePerMeter)} ₽ / м.п.
                        </p>
                      </div>
                      <span className={["mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs",
                        floatingEnabled ? "border-white bg-white text-slate-950" : "border-slate-300 bg-transparent"
                      ].join(" ")}>{floatingEnabled ? "✓" : ""}</span>
                    </button>
                  </div>
                </div>

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-ceiling max-sm:hidden"
                    onClick={() => confirmAndNavigate("ceiling")}
                    disabled={!isStepEnabled("ceiling")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Тип потолка`}
                subtitle={isStepEnabled("ceiling") ? "Выберите тип потолка" : "Сначала подтвердите площадь"}
                enabled={isStepEnabled("ceiling")}
                onOpen={() => openStep("ceiling")}
              />
            )}
          </div>

          {/* SHADOW PROFILE (if shadow enabled) */}
          {shadowEnabled ? (
            <div ref={shadowProfileRef}>
              {confirmed.shadowProfile ? (
                <SectionCard title={`Теневой профиль`}>
                  <SummaryRow
                    label="Теневой профиль"
                    value={`${shadowLength} м.п. (${shadowLengthAuto ? "авто 1:1" : "вручную"})`}
                    onEdit={() => beginEdit("shadowProfile")}
                  />
                </SectionCard>
              ) : activeStep === "shadowProfile" ? (
                <SectionCard
                  title={`Теневой профиль`}
                  description="Укажите только те метры, где действительно нужен теневой зазор. Это может быть не весь периметр комнаты."
                >
                  <RangeField
                    id="shadow-length-field"
                    label="Длина теневого профиля"
                    value={shadowLength}
                    min={calculator.specialMeters.min}
                    max={calculator.specialMeters.max}
                    step={calculator.specialMeters.step}
                    unit="м.п."
                    onChange={handleShadowLengthChange}
                    showSlider={showSlider}
                    quickValues={[perimeterSuggestion.recommended]}
                  />

                  <PerimeterHint
                    area={area}
                    recommended={perimeterSuggestion.recommended}
                    onApply={() => { markInteracted(); setShadowLengthAuto(true); setShadowLength(perimeterSuggestion.recommended); }}
                    isAuto={shadowLengthAuto}
                  />

                  <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                    <p className="text-xs text-slate-500">Оставьте авто 1:1 или измените вручную.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="step0-confirm-button step0-confirm-shadow max-sm:hidden"
                      onClick={() => confirmAndNavigate("shadowProfile")}
                      disabled={!isStepEnabled("shadowProfile")}
                    >
                      Подтвердить
                    </Button>
                  </div>
                </SectionCard>
              ) : (
                <CollapsedStep
                  title={`Теневой профиль`}
                  subtitle={isStepEnabled("shadowProfile") ? "Настройте длину" : "Сначала выберите тип потолка"}
                  enabled={isStepEnabled("shadowProfile")}
                  onOpen={() => openStep("shadowProfile")}
                />
              )}
            </div>
          ) : null}

          {/* FLOATING PROFILE (if floating enabled) */}
          {floatingEnabled ? (
            <div ref={floatingProfileRef}>
              {confirmed.floatingProfile ? (
                <SectionCard title={`Парящий профиль`}>
                  <SummaryRow
                    label="Парящий профиль"
                    value={`${floatingLength} м.п. (${floatingLengthAuto ? "авто 1:1" : "вручную"})`}
                    onEdit={() => beginEdit("floatingProfile")}
                  />
                </SectionCard>
              ) : activeStep === "floatingProfile" ? (
                <SectionCard
                  title={`Парящий профиль`}
                  description="Укажите только те метры, где нужен парящий эффект. Это может быть одна стена, ниша или отдельный участок."
                >
                  <RangeField
                    id="floating-length-field"
                    label="Длина парящего профиля"
                    value={floatingLength}
                    min={calculator.specialMeters.min}
                    max={calculator.specialMeters.max}
                    step={calculator.specialMeters.step}
                    unit="м.п."
                    onChange={handleFloatingLengthChange}
                    showSlider={showSlider}
                    quickValues={[perimeterSuggestion.recommended]}
                  />

                  <PerimeterHint
                    area={area}
                    recommended={perimeterSuggestion.recommended}
                    onApply={() => { markInteracted(); setFloatingLengthAuto(true); setFloatingLength(perimeterSuggestion.recommended); }}
                    isAuto={floatingLengthAuto}
                  />

                  <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                    <p className="text-xs text-slate-500">Оставьте авто 1:1 или измените вручную.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="step0-confirm-button step0-confirm-floating max-sm:hidden"
                      onClick={() => confirmAndNavigate("floatingProfile")}
                      disabled={!isStepEnabled("floatingProfile")}
                    >
                      Подтвердить
                    </Button>
                  </div>
                </SectionCard>
              ) : (
                <CollapsedStep
                  title={`Парящий профиль`}
                  subtitle={isStepEnabled("floatingProfile") ? "Настройте длину" : "Сначала выберите тип потолка"}
                  enabled={isStepEnabled("floatingProfile")}
                  onOpen={() => openStep("floatingProfile")}
                />
              )}
            </div>
          ) : null}

          {/* LIGHT LINES */}
          <div ref={lightLinesRef}>
            {confirmed.lightLines ? (
              <SectionCard title={`Световые линии`}>
                <SummaryRow
                  label="Световые линии"
                  value={lightLinesValue}
                  onEdit={() => beginEdit("lightLines")}
                />
              </SectionCard>
            ) : activeStep === "lightLines" ? (
              <SectionCard title={`Световые линии`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={!lightLinesEnabled}
                    title="Без световых линий"
                    meta="Без доп. расчёта"
                    onClick={() => {
                      markInteracted();
                      setLightLinesEnabled(false);
                    }}
                  />
                  <OptionCard
                    active={lightLinesEnabled}
                    title="Добавить световые линии"
                    meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`}
                    onClick={() => {
                      markInteracted();
                      setLightLinesEnabled(true);
                    }}
                  />
                </div>

                {lightLinesEnabled ? (
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <RangeField
                      id="light-lines-length"
                      label="Длина световых линий"
                      value={lightLinesLength}
                      min={calculator.lightLineMeters.min}
                      max={calculator.lightLineMeters.max}
                      step={calculator.lightLineMeters.step}
                      unit="м.п."
                      onChange={(v) => {
                        markInteracted();
                        setLightLinesLength(v);
                      }}
                      showSlider={showSlider}
                    />
                  </div>
                ) : null}

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-light-lines max-sm:hidden"
                    onClick={() => confirmAndNavigate("lightLines")}
                    disabled={!isStepEnabled("lightLines")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Световые линии`}
                subtitle={isStepEnabled("lightLines") ? "Выберите: нужны или нет" : "Сначала подтвердите площадь и тип потолка"}
                enabled={isStepEnabled("lightLines")}
                onOpen={() => openStep("lightLines")}
              />
            )}
          </div>

          {/* CORNICE */}
          <div ref={corniceRef}>
            {confirmed.cornice ? (
              <SectionCard title={`Карнизы`}>
                <SummaryRow
                  label="Карниз"
                  value={corniceValue}
                  onEdit={() => beginEdit("cornice")}
                />
              </SectionCard>
            ) : activeStep === "cornice" ? (
              <SectionCard title={`Карнизы`}>
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                  {calculator.cornices.map((option) => (
                    <OptionCard
                      key={option.slug}
                      active={corniceType === option.slug}
                      title={option.label}
                      meta={
                        option.ratePerMeter > 0
                          ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                          : "Без доп. расчёта"
                      }
                      onClick={() => {
                        markInteracted();
                        setCorniceType(option.slug);
                        if (option.slug !== "none") {
                          setCorniceLength(calculator.corniceMeters.default);
                        }
                      }}
                    />
                  ))}
                </div>

                {selectedCornice.ratePerMeter > 0 ? (
                  <div className="mt-4 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <RangeField
                      id="cornice-length"
                      label="Длина карниза"
                      value={corniceLength}
                      min={calculator.corniceMeters.min}
                      max={calculator.corniceMeters.max}
                      step={calculator.corniceMeters.step}
                      unit="м.п."
                      onChange={(v) => {
                        markInteracted();
                        setCorniceLength(v);
                      }}
                      showSlider={showSlider}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <OptionCard
                        active={!corniceLightingEnabled}
                        title="Без подсветки карниза"
                        meta="Только карнизный узел без дополнительной LED-подсветки"
                        onClick={() => {
                          markInteracted();
                          setCorniceLightingEnabled(false);
                        }}
                      />
                      <OptionCard
                        active={corniceLightingEnabled}
                        title="Добавить подсветку"
                        meta={`+${formatCurrency(calculator.corniceLighting.ratePerMeter)} ₽ / м.п. + блок ${formatCurrency(calculator.corniceLighting.powerSupplyRate)} ₽`}
                        onClick={() => {
                          markInteracted();
                          setCorniceLightingEnabled(true);
                          setCorniceLightingLength((prev) => Math.max(1, Math.round(prev || corniceLength)));
                          setCorniceLightingPowerSupplies((prev) => Math.max(1, Math.round(prev || 1)));
                        }}
                      />
                    </div>

                    {corniceLightingEnabled ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <RangeField
                          id="cornice-lighting-length"
                          label="Подсветка карниза"
                          value={corniceLightingLength}
                          min={1}
                          max={calculator.corniceMeters.max}
                          step={1}
                          unit="м.п."
                          onChange={(value) => {
                            markInteracted();
                            setCorniceLightingLength(value);
                          }}
                          showSlider={showSlider}
                        />
                        <RangeField
                          id="cornice-lighting-psu"
                          label="Блоки питания"
                          value={corniceLightingPowerSupplies}
                          min={1}
                          max={10}
                          step={1}
                          unit="шт."
                          onChange={(value) => {
                            markInteracted();
                            setCorniceLightingPowerSupplies(value);
                          }}
                          showSlider={showSlider}
                          quickValues={[1, 2, 3]}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-cornice max-sm:hidden"
                    onClick={() => confirmAndNavigate("cornice")}
                    disabled={!isStepEnabled("cornice")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Карнизы`}
                subtitle={isStepEnabled("cornice") ? "Выберите: нужен или нет" : "Сначала выберите световые линии"}
                enabled={isStepEnabled("cornice")}
                onOpen={() => openStep("cornice")}
              />
            )}
          </div>

          {/* TRACK */}
          <div ref={trackRef}>
            {confirmed.track ? (
              <SectionCard title={`Трековое освещение`}>
                <SummaryRow
                  label="Трек"
                  value={trackValue}
                  onEdit={() => beginEdit("track")}
                />
              </SectionCard>
            ) : activeStep === "track" ? (
              <SectionCard title={`Трековое освещение`}>
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                  {calculator.tracks.map((option) => {
                    const systemHint =
                      option.slug === "built-in"
                        ? " · CLARUS, COLIBRI"
                        : option.slug === "surface"
                          ? " · ART"
                          : "";

                    const meta =
                      option.ratePerMeter > 0
                        ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.${systemHint}`
                        : `Без доп. расчёта${systemHint}`;

                    return (
                      <OptionCard
                        key={option.slug}
                        active={trackType === option.slug}
                        title={option.label}
                        meta={meta}
                        onClick={() => {
                          markInteracted();
                          setTrackTypeTouched(true);
                          setTrackType(option.slug);
                          if (option.slug !== "none") {
                            setTrackLengthTouched(true);
                            setTrackLength(calculator.trackMeters.default);
                          }
                        }}
                      />
                    );
                  })}
                </div>

                {selectedTrack.ratePerMeter > 0 ? (
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <RangeField
                      id="track-length"
                      label="Длина трека"
                      value={trackLength}
                      min={calculator.trackMeters.min}
                      max={calculator.trackMeters.max}
                      step={calculator.trackMeters.step}
                      unit="м.п."
                      onChange={(v) => {
                        markInteracted();
                        setTrackLengthTouched(true);
                        setTrackLength(v);
                      }}
                      showSlider={showSlider}
                    />
                  </div>
                ) : null}

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-track max-sm:hidden"
                    onClick={() => confirmAndNavigate("track")}
                    disabled={!isStepEnabled("track")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Трековое освещение`}
                subtitle={isStepEnabled("track") ? "Выберите: нужен или нет" : "Сначала подтвердите карниз"}
                enabled={isStepEnabled("track")}
                onOpen={() => openStep("track")}
              />
            )}
          </div>

          {/* CHANDELIERS */}
          <div ref={chandeliersRef}>
            {confirmed.chandeliers ? (
              <SectionCard title={`Установка люстр`}>
                <SummaryRow
                  label="Установка люстр"
                  value={chandeliersValue}
                  onEdit={() => beginEdit("chandeliers")}
                />
              </SectionCard>
            ) : activeStep === "chandeliers" ? (
              <SectionCard title={`Установка люстр`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={!chandeliersEnabled}
                    title="Не нужно"
                    meta="Без поштучного расчёта"
                    onClick={() => {
                      markInteracted();
                      setChandeliersTouched(true);
                      setChandeliersEnabled(false);
                    }}
                  />
                  <OptionCard
                    active={chandeliersEnabled}
                    title="Добавить установку"
                    meta={`${formatCurrency(CHANDELIERS_INSTALL_RATE_PER_UNIT)} ₽ / шт`}
                    onClick={() => {
                      markInteracted();
                      setChandeliersTouched(true);
                      setChandeliersEnabled(true);
                      setChandeliersCount((prev) => Math.max(1, Math.round(prev || 1)));
                    }}
                  />
                </div>

                {chandeliersEnabled ? (
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <RangeField
                      id="chandeliers-count"
                      label="Количество люстр"
                      value={chandeliersCount}
                      min={1}
                      max={40}
                      step={1}
                      unit="шт."
                      onChange={(v) => {
                        markInteracted();
                        setChandeliersTouched(true);
                        setChandeliersCount(v);
                      }}
                      showSlider={showSlider}
                      quickValues={[1, 2, 3]}
                    />
                  </div>
                ) : null}

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-chandeliers max-sm:hidden"
                    onClick={() => confirmAndNavigate("chandeliers")}
                    disabled={!isStepEnabled("chandeliers")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Установка люстр`}
                subtitle={
                  isStepEnabled("chandeliers")
                    ? "Выберите: нужна или нет"
                    : "Сначала выберите трековое освещение"
                }
                enabled={isStepEnabled("chandeliers")}
                onOpen={() => openStep("chandeliers")}
              />
            )}
          </div>

          {/* LIGHTS */}
          <div ref={lightsRef}>
            {confirmed.lights ? (
              <SectionCard title={`Точечные светильники`}>
                <SummaryRow
                  label="Светильники"
                  value={lightsValue}
                  onEdit={() => beginEdit("lights")}
                />
              </SectionCard>
            ) : activeStep === "lights" ? (
              <SectionCard title={`Точечные светильники`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={!lightsEnabled}
                    title="Без светильников"
                    meta="Без поштучного расчёта"
                    onClick={() => {
                      markInteracted();
                      setLightsTouched(true);
                      setLightsEnabled(false);
                    }}
                  />
                  <OptionCard
                    active={lightsEnabled}
                    title="Добавить светильники"
                    meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`}
                    onClick={() => {
                      markInteracted();
                      setLightsTouched(true);
                      setLightsEnabled(true);
                    }}
                  />
                </div>

                {lightsEnabled ? (
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <RangeField
                      id="lights-count"
                      label="Количество светильников"
                      value={lightsCount}
                      min={calculator.lights.countMin}
                      max={calculator.lights.countMax}
                      step={calculator.lights.countStep}
                      unit="шт."
                      onChange={(v) => {
                        markInteracted();
                        setLightsTouched(true);
                        setLightsCount(v);
                      }}
                      showSlider={showSlider}
                      quickValues={[4, 6, 8, 10, 12]}
                    />
                  </div>
                ) : null}

                <div className="step0-confirm-row mt-4 flex items-center justify-between gap-3 max-sm:hidden">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="step0-confirm-button step0-confirm-lights max-sm:hidden"
                    onClick={() => confirmAndNavigate("lights")}
                    disabled={!isStepEnabled("lights")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`Точечные светильники`}
                subtitle={isStepEnabled("lights") ? "Выберите: нужны или нет" : "Сначала выберите установку люстр"}
                enabled={isStepEnabled("lights")}
                onOpen={() => openStep("lights")}
              />
            )}
          </div>
        </div>

        {/* RIGHT summary — desktop sidebar */}
        <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
            <p className="text-sm text-white/70">
              {isRoomScopeMulti ? "Общий ориентир по всем помещениям" : "Ориентировочная стоимость от"}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(displayTotal)} ₽
            </p>

            <p className="mt-2 text-xs text-white/70">
              {isRoomScopeMulti
                ? `${effectiveRooms.length} ${effectiveRooms.length === 1 ? "помещение" : effectiveRooms.length < 5 ? "помещения" : "помещений"} · сейчас редактируете: ${roomLabel}`
                : `${calculationScope === "object" ? "Весь объект" : "Отдельное помещение"} · ${!shadowEnabled && !floatingEnabled ? "Простой потолок" : `${shadowEnabled ? "Теневой" : ""}${shadowEnabled && floatingEnabled ? " + " : ""}${floatingEnabled ? "Парящий" : ""}`} · ${area} м²${shadowEnabled ? ` · теневой ${shadowLength} м.п.` : ""}${floatingEnabled ? ` · парящий ${floatingLength} м.п.` : ""}`}
            </p>

            {isRoomScopeMulti ? (
              <div className="mt-4 space-y-2 rounded-2xl bg-white/5 p-4">
                {effectiveSnapshot.roomBreakdown?.map((room) => (
                  <div key={room.id} className="flex items-center justify-between gap-3 text-xs text-white/75">
                    <span className="truncate">{room.label} · {room.area} м²</span>
                    <span className="font-semibold text-white">{formatCurrency(room.totalRub)} ₽</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 space-y-2">
              <Button type="button" className="w-full" onClick={onPrimaryCtaClick ?? (() => scrollToAction())}>
                {isRoomScopeMulti ? "К общему итогу →" : homepage.price.primaryCtaLabel}
              </Button>
              {isRoomScopeMulti ? (
                <Button type="button" variant="secondary" className="w-full" onClick={() => addRoom()}>
                  Добавить ещё помещение
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* V-3: Mobile sticky bottom bar with price + CTA */}
        {showMobileStickyBar ? (
        <div className="calc-sticky-bar fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{isRoomScopeMulti ? "Общий итог" : "Итого от"}</p>
              <p className="text-lg font-bold tracking-tight text-slate-950">
                {formatCurrency(displayTotal)} ₽
              </p>
            </div>
            <Button type="button" className="whitespace-nowrap shrink-0" onClick={onPrimaryCtaClick ?? (() => scrollToAction())}>
              {isRoomScopeMulti ? "Итог по объекту →" : homepage.price.primaryCtaLabel}
            </Button>
          </div>
        </div>
        ) : null}
      </div>

      {/* Spacer for mobile sticky bar so last step isn't hidden */}
      {showMobileStickyBar ? (
        <div className="h-20 lg:hidden" aria-hidden="true" />
      ) : null}
      </>
    );
  }

  // ===== NON-COMPACT (страница): обычный режим с breakdown =====
  return (
    <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8 max-sm:gap-3 max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none">
      <div className="min-w-0 space-y-5 max-sm:space-y-3">
        <SectionCard
          title="Площадь"
          description="Сначала выберите формат расчёта. Площадь считается отдельно, а профили и узлы — только по фактическим метрам."
        >
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={calculationScope === "room"}
              title="Отдельное помещение"
              meta="Кухня, спальня, гостиная, санузел и другие помещения поэтапно"
              onClick={() => {
                markInteracted();
                setCalculationScope("room");
              }}
            />
            <OptionCard
              active={calculationScope === "object"}
              title="Весь объект"
              meta="Квартира или дом целиком, если уже понятен общий объём"
              onClick={() => {
                markInteracted();
                setCalculationScope("object");
              }}
            />
          </div>
          <RangeField
            id="area-field"
            label={calculationScope === "object" ? "Укажите общую площадь объекта" : "Выберите площадь помещения"}
            value={area}
            min={calculator.areaMin}
            max={calculator.areaMax}
            step={calculator.areaStep}
            unit="м²"
            onChange={handleAreaChange}
            showSlider
            quickValues={[10, 15, 20, 25, 30, 40, 50, 60, 80]}
          />
        </SectionCard>

        <SectionCard
          title="Тип потолка"
          description="Базовая площадь считается отдельно. Теневой и парящий указывайте только на нужных участках — они не обязаны идти по всему периметру."
        >
          {/* Simple ceiling option */}
          <div
            className={["rounded-2xl border p-4 text-left transition-all mb-3",
              !shadowEnabled && !floatingEnabled
                ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => { markInteracted(); setShadowEnabled(false); setFloatingEnabled(false); }}
              className="w-full text-left"
            >
              <p className="text-sm font-semibold">Простой потолок</p>
              <p className={["mt-1 text-xs", !shadowEnabled && !floatingEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                от {formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м²
              </p>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div
              className={["rounded-2xl border p-4 text-left transition-all",
                shadowEnabled
                  ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
              ].join(" ")}
            >
              <button type="button" onClick={toggleShadow} className="w-full text-left flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Теневой потолок</p>
                  <p className={["mt-1 text-xs", shadowEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                    {formatCurrency(shadowCeiling.baseRatePerSqm)} ₽ / м² + {formatCurrency(shadowCeiling.extraRatePerMeter)} ₽ / м.п.
                  </p>
                </div>
                <span className={["mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs",
                  shadowEnabled ? "border-white bg-white text-slate-950" : "border-slate-300 bg-transparent"
                ].join(" ")}>{shadowEnabled ? "✓" : ""}</span>
              </button>
            </div>
            <div
              className={["rounded-2xl border p-4 text-left transition-all",
                floatingEnabled
                  ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
              ].join(" ")}
            >
              <button type="button" onClick={toggleFloating} className="w-full text-left flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Парящий потолок</p>
                  <p className={["mt-1 text-xs", floatingEnabled ? "text-white/75" : "text-slate-500"].join(" ")}>
                    {formatCurrency(floatingCeiling.baseRatePerSqm)} ₽ / м² + {formatCurrency(floatingCeiling.extraRatePerMeter)} ₽ / м.п.
                  </p>
                </div>
                <span className={["mt-0.5 h-5 w-5 shrink-0 rounded border flex items-center justify-center text-xs",
                  floatingEnabled ? "border-white bg-white text-slate-950" : "border-slate-300 bg-transparent"
                ].join(" ")}>{floatingEnabled ? "✓" : ""}</span>
              </button>
            </div>
          </div>
        </SectionCard>

        {shadowEnabled ? (
          <SectionCard
            title="Теневой профиль"
            description="Укажите только те метры, где действительно нужен теневой зазор. Это может быть не весь периметр комнаты."
          >
            <RangeField
              id="shadow-length-field-page"
              label="Длина теневого профиля"
              value={shadowLength}
              min={calculator.specialMeters.min}
              max={calculator.specialMeters.max}
              step={calculator.specialMeters.step}
              unit="м.п."
              onChange={handleShadowLengthChange}
              showSlider
            />
            <PerimeterHint
              area={area}
              recommended={perimeterSuggestion.recommended}
              onApply={() => { markInteracted(); setShadowLengthAuto(true); setShadowLength(perimeterSuggestion.recommended); }}
              isAuto={shadowLengthAuto}
            />
          </SectionCard>
        ) : null}

        {floatingEnabled ? (
          <SectionCard
            title="Парящий профиль"
            description="Укажите только те метры, где нужен парящий эффект. Это может быть одна стена, ниша или отдельный участок."
          >
            <RangeField
              id="floating-length-field-page"
              label="Длина парящего профиля"
              value={floatingLength}
              min={calculator.specialMeters.min}
              max={calculator.specialMeters.max}
              step={calculator.specialMeters.step}
              unit="м.п."
              onChange={handleFloatingLengthChange}
              showSlider
            />
            <PerimeterHint
              area={area}
              recommended={perimeterSuggestion.recommended}
              onApply={() => { markInteracted(); setFloatingLengthAuto(true); setFloatingLength(perimeterSuggestion.recommended); }}
              isAuto={floatingLengthAuto}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Световые линии">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={!lightLinesEnabled}
              title="Без световых линий"
              meta="Без доп. расчёта"
              onClick={() => {
                markInteracted();
                setLightLinesEnabled(false);
              }}
            />
            <OptionCard
              active={lightLinesEnabled}
              title="Добавить световые линии"
              meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`}
              onClick={() => {
                markInteracted();
                setLightLinesEnabled(true);
              }}
            />
          </div>

          {lightLinesEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="light-lines-length"
                label="Длина световых линий"
                value={lightLinesLength}
                min={calculator.lightLineMeters.min}
                max={calculator.lightLineMeters.max}
                step={calculator.lightLineMeters.step}
                unit="м.п."
                onChange={(v) => {
                  markInteracted();
                  setLightLinesLength(v);
                }}
                showSlider
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Карнизы">
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {calculator.cornices.map((option) => (
              <OptionCard
                key={option.slug}
                active={corniceType === option.slug}
                title={option.label}
                meta={
                  option.ratePerMeter > 0
                    ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                    : "Без доп. расчёта"
                }
                onClick={() => {
                  markInteracted();
                  setCorniceType(option.slug);
                  if (option.slug !== "none") setCorniceLength(calculator.corniceMeters.default);
                }}
              />
            ))}
          </div>

          {selectedCornice.ratePerMeter > 0 ? (
            <div className="mt-4 space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="cornice-length"
                label="Длина карниза"
                value={corniceLength}
                min={calculator.corniceMeters.min}
                max={calculator.corniceMeters.max}
                step={calculator.corniceMeters.step}
                unit="м.п."
                onChange={(v) => {
                  markInteracted();
                  setCorniceLength(v);
                }}
                showSlider
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <OptionCard
                  active={!corniceLightingEnabled}
                  title="Без подсветки карниза"
                  meta="Только карнизный узел без дополнительной LED-подсветки"
                  onClick={() => {
                    markInteracted();
                    setCorniceLightingEnabled(false);
                  }}
                />
                <OptionCard
                  active={corniceLightingEnabled}
                  title="Добавить подсветку"
                  meta={`+${formatCurrency(calculator.corniceLighting.ratePerMeter)} ₽ / м.п. + блок ${formatCurrency(calculator.corniceLighting.powerSupplyRate)} ₽`}
                  onClick={() => {
                    markInteracted();
                    setCorniceLightingEnabled(true);
                    setCorniceLightingLength((prev) => Math.max(1, Math.round(prev || corniceLength)));
                    setCorniceLightingPowerSupplies((prev) => Math.max(1, Math.round(prev || 1)));
                  }}
                />
              </div>

              {corniceLightingEnabled ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <RangeField
                    id="cornice-lighting-length-page"
                    label="Подсветка карниза"
                    value={corniceLightingLength}
                    min={1}
                    max={calculator.corniceMeters.max}
                    step={1}
                    unit="м.п."
                    onChange={(value) => {
                      markInteracted();
                      setCorniceLightingLength(value);
                    }}
                    showSlider
                  />
                  <RangeField
                    id="cornice-lighting-psu-page"
                    label="Блоки питания"
                    value={corniceLightingPowerSupplies}
                    min={1}
                    max={10}
                    step={1}
                    unit="шт."
                    onChange={(value) => {
                      markInteracted();
                      setCorniceLightingPowerSupplies(value);
                    }}
                    showSlider
                    quickValues={[1, 2, 3]}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Трековое освещение">
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {calculator.tracks.map((option) => {
              const systemHint =
                option.slug === "built-in"
                  ? " · CLARUS, COLIBRI"
                  : option.slug === "surface"
                    ? " · ART"
                    : "";

              return (
                <OptionCard
                  key={option.slug}
                  active={trackType === option.slug}
                  title={option.label}
                  meta={
                    option.ratePerMeter > 0
                      ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.${systemHint}`
                      : `Без доп. расчёта${systemHint}`
                  }
                  onClick={() => {
                    markInteracted();
                    setTrackTypeTouched(true);
                    setTrackType(option.slug);
                    if (option.slug !== "none") setTrackLength(calculator.trackMeters.default);
                  }}
                />
              );
            })}
          </div>

          {selectedTrack.ratePerMeter > 0 ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="track-length"
                label="Длина трека"
                value={trackLength}
                min={calculator.trackMeters.min}
                max={calculator.trackMeters.max}
                step={calculator.trackMeters.step}
                unit="м.п."
                onChange={(v) => {
                  markInteracted();
                  setTrackLengthTouched(true);
                  setTrackLength(v);
                }}
                showSlider
              />
            </div>
          ) : null}
        </SectionCard>

        {/* NEW: CHANDELIERS */}
        <SectionCard title="Установка люстр">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={!chandeliersEnabled}
              title="Не нужно"
              meta="Без поштучного расчёта"
              onClick={() => {
                markInteracted();
                setChandeliersTouched(true);
                setChandeliersEnabled(false);
              }}
            />
            <OptionCard
              active={chandeliersEnabled}
              title="Добавить установку"
              meta={`${formatCurrency(CHANDELIERS_INSTALL_RATE_PER_UNIT)} ₽ / шт`}
              onClick={() => {
                markInteracted();
                setChandeliersTouched(true);
                setChandeliersEnabled(true);
                setChandeliersCount((prev) => Math.max(1, Math.round(prev || 1)));
              }}
            />
          </div>

          {chandeliersEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="chandeliers-count-noncompact"
                label="Количество люстр"
                value={chandeliersCount}
                min={1}
                max={40}
                step={1}
                unit="шт."
                onChange={(v) => {
                  markInteracted();
                  setChandeliersTouched(true);
                  setChandeliersCount(v);
                }}
                showSlider
              />
            </div>
          ) : null}
        </SectionCard>

        <SectionCard title="Точечные светильники">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={!lightsEnabled}
              title="Без светильников"
              meta="Без поштучного расчёта"
              onClick={() => {
                markInteracted();
                setLightsTouched(true);
                setLightsEnabled(false);
              }}
            />
            <OptionCard
              active={lightsEnabled}
              title="Добавить светильники"
              meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`}
              onClick={() => {
                markInteracted();
                setLightsTouched(true);
                setLightsEnabled(true);
              }}
            />
          </div>

          {lightsEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="lights-count"
                label="Количество светильников"
                value={lightsCount}
                min={calculator.lights.countMin}
                max={calculator.lights.countMax}
                step={calculator.lights.countStep}
                unit="шт."
                onChange={(v) => {
                  markInteracted();
                  setLightsTouched(true);
                  setLightsCount(v);
                }}
                showSlider
              />
            </div>
          ) : null}
        </SectionCard>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
          <p className="text-sm text-white/70">Ориентировочная стоимость от</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCurrency(total)} ₽
          </p>

          <p className="mt-2 text-xs text-white/70">При площади {area} м² и выбранных параметрах.</p>

          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/80">Состав расчёта</p>

            <div className="mt-3 space-y-2">
              <PriceRow label="Потолок" value={`${formatCurrency(ceilingBaseTotal)} ₽`} />
              {shadowExtraTotal > 0 ? (
                <PriceRow
                  label="Теневой профиль"
                  value={`${formatCurrency(shadowExtraTotal)} ₽`}
                />
              ) : null}
              {floatingExtraTotal > 0 ? (
                <PriceRow
                  label="Парящий профиль"
                  value={`${formatCurrency(floatingExtraTotal)} ₽`}
                />
              ) : null}
              {lightLinesTotal > 0 ? (
                <PriceRow
                  label={calculator.lightLines.label}
                  value={`${formatCurrency(lightLinesTotal)} ₽`}
                />
              ) : null}
              {corniceTotal > 0 ? (
                <PriceRow label={selectedCornice.label} value={`${formatCurrency(corniceTotal)} ₽`} />
              ) : null}
              {corniceLightingTotal > 0 ? (
                <PriceRow label={calculator.corniceLighting.label} value={`${formatCurrency(corniceLightingTotal)} ₽`} />
              ) : null}
              {trackTotal > 0 ? (
                <PriceRow label={selectedTrack.label} value={`${formatCurrency(trackTotal)} ₽`} />
              ) : null}
              {chandeliersTotal > 0 ? (
                <PriceRow label="Установка люстр" value={`${formatCurrency(chandeliersTotal)} ₽`} />
              ) : null}
              {lightsTotal > 0 ? (
                <PriceRow label="Светильники" value={`${formatCurrency(lightsTotal)} ₽`} />
              ) : null}

              <div className="border-t border-white/10 pt-3">
                <PriceRow label="Итого" value={`${formatCurrency(total)} ₽`} strong />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button type="button" className="w-full" onClick={onPrimaryCtaClick ?? (() => {
              if (typeof document !== "undefined") {
                const el = document.getElementById("action");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            })}>
              {homepage.price.primaryCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
