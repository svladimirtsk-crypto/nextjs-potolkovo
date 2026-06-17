"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { homepage } from "@/content/homepage";
import type { ServiceCalculatorPreset } from "@/content/services";

import { Button } from "@/components/ui/button";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number) {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
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
        Для площади <span className="font-semibold text-slate-950">{area} м²</span>{" "}
        ориентир по профилю:{" "}
        <span className="font-semibold text-slate-950">{recommended} м.п.</span>{" "}
        (1:1).
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
  const resolvedCeilingType = (preset?.ceilingType ?? "standard") as CeilingType;
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount =
    preset?.lightsCount ?? calculator.lights.countDefault;

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
    () => getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [shadowLengthAuto, setShadowLengthAuto] = useState<boolean>(true);
  const [floatingLength, setFloatingLength] = useState<number>(
    () => getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [floatingLengthAuto, setFloatingLengthAuto] = useState<boolean>(true);

  const [lightLinesEnabled, setLightLinesEnabled] = useState<boolean>(false);
  const [lightLinesLength, setLightLinesLength] = useState<number>(
    calculator.lightLineMeters.default
  );

  const [corniceType, setCorniceType] =
    useState<CorniceType>(resolvedCorniceType);
  const [corniceLength, setCorniceLength] = useState<number>(
    calculator.corniceMeters.default
  );

  const [trackType, setTrackType] = useState<TrackType>(resolvedTrackType);
  const [trackLength, setTrackLength] = useState<number>(
    calculator.trackMeters.default
  );

  // NEW: Установка люстр
  const [chandeliersEnabled, setChandeliersEnabled] = useState<boolean>(false);
  const [chandeliersCount, setChandeliersCount] = useState<number>(1);

  const [lightsEnabled, setLightsEnabled] =
    useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount] = useState<number>(resolvedLightsCount);

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

  const snapshot = useMemo<CalculatorLeadSnapshot>(
    () => ({
      area,
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

  useEffect(() => {
    setSnapshot((prev) => {
      if (prev == null) return snapshot;

      // сохраняем leadSource/lighting/grandTotal/_reconciled
      return {
        ...snapshot,
        leadSource: prev.leadSource ?? snapshot.leadSource,
        lighting: prev.lighting,
        grandTotal: prev.grandTotal,
        _reconciled: prev._reconciled,
      };
    });
  }, [setSnapshot, snapshot]);

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
        ? `${selectedCornice.label}, ${corniceLength} м.п.`
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
          {/* intro removed — visual noise */}

          {/* AREA */}
          <div ref={areaRef}>
            {confirmed.area ? (
              <SectionCard title={`Площадь`}>
                <SummaryRow
                  label="Площадь"
                  value={`${area} м²`}
                  onEdit={() => beginEdit("area")}
                />
              </SectionCard>
            ) : activeStep === "area" ? (
              <SectionCard title={`Площадь`}>
                <RangeField
                  id="area-field"
                  label="Выберите площадь"
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
                subtitle="Выберите площадь помещения"
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
                description="Можно выбрать одновременно теневой и парящий профиль."
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
                  description="Профиль по периметру для теневого зазора"
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
                  description="Профиль по периметру для парящего эффекта"
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
                  <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
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
            <p className="text-sm text-white/70">Ориентировочная стоимость от</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(total)} ₽
            </p>

            <p className="mt-2 text-xs text-white/70">
              {!shadowEnabled && !floatingEnabled ? "Простой потолок" : `${shadowEnabled ? "Теневой" : ""}${shadowEnabled && floatingEnabled ? " + " : ""}${floatingEnabled ? "Парящий" : ""}`} · {area} м²
              {shadowEnabled ? ` · теневой ${shadowLength} м.п.` : ""}
              {floatingEnabled ? ` · парящий ${floatingLength} м.п.` : ""}
            </p>

            <div className="mt-6">
              <Button type="button" className="w-full" onClick={onPrimaryCtaClick ?? (() => scrollToAction())}>
                {homepage.price.primaryCtaLabel}
              </Button>
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
              <p className="text-xs text-slate-500">Итого от</p>
              <p className="text-lg font-bold tracking-tight text-slate-950">
                {formatCurrency(total)} ₽
              </p>
            </div>
            <Button type="button" className="whitespace-nowrap shrink-0" onClick={onPrimaryCtaClick ?? (() => scrollToAction())}>
              {homepage.price.primaryCtaLabel}
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
        <SectionCard title="Площадь помещения">
          <RangeField
            id="area-field"
            label="Выберите площадь"
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
          description="Можно выбрать одновременно теневой и парящий профиль."
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
            description="Профиль по периметру для теневого зазора"
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
            description="Профиль по периметру для парящего эффекта"
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
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
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
