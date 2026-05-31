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

type CeilingType = (typeof calculator.ceilingTypes)[number]["slug"];
type CorniceType = (typeof calculator.cornices)[number]["slug"];
type TrackType = (typeof calculator.tracks)[number]["slug"];

type PerimeterSuggestion = { recommended: number };

type CompactStepId =
  | "area"
  | "ceiling"
  | "profile"
  | "lightLines"
  | "cornice"
  | "track"
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

/**
 * ТЗ: периметр теневого/парящего = 1:1 к площади.
 */
function getPerimeterSuggestion(area: number): PerimeterSuggestion {
  const recommended = clamp(
    roundToStep(area, calculator.specialMeters.step),
    calculator.specialMeters.min,
    calculator.specialMeters.max
  );

  return { recommended };
}

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

  // fallback
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
    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="flex items-center gap-2 text-sm text-slate-700">
        <CompactBadge>✓</CompactBadge>
        <span>
          {label}: <span className="font-semibold text-slate-950">{value}</span>
        </span>
      </p>
      <Button type="button" variant="secondary" onClick={onEdit}>
        Изменить
      </Button>
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
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
        "rounded-2xl border p-4 text-left transition-all",
        "flex h-full flex-col",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-5">{title}</p>
          <p
            className={[
              "mt-1 line-clamp-2 text-xs leading-5",
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
  useEffect(() => setManual(String(value)), [value]);

  const normalize = (num: number) => clamp(roundToStep(num, step), min, max);

  const parseManual = (raw: string) => {
    const normalizedRaw = raw.replace(",", ".").trim();
    if (!normalizedRaw) return null;
    const parsed = Number(normalizedRaw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  /**
   * Фикс бага “40 → стереть → прыгнуло на 10”:
   * - во время набора НЕ clamp’им на min/max
   * - clamp делаем на blur/Enter
   */
  const commitWhileTyping = (raw: string) => {
    const parsed = parseManual(raw);
    if (parsed === null) return;

    // пока пользователь набирает: применяем только если уже в диапазоне
    if (parsed < min || parsed > max) return;

    onChange(normalize(parsed));
  };

  const isIntegerStep = Number.isInteger(step);

  const dec = () => onChange(normalize(value - step));
  const inc = () => onChange(normalize(value + step));

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={dec}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
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
            className="w-20 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-24"
          />

          <span className="text-sm font-semibold text-slate-950">{unit}</span>

          <button
            type="button"
            onClick={inc}
            className="h-8 w-8 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50"
            aria-label="Увеличить"
          >
            +
          </button>
        </div>
      </div>

      {quickValues && quickValues.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickValues.map((q) => {
            const active = Math.abs(value - q) < 0.0001;
            return (
              <button
                key={q}
                type="button"
                onClick={() => onChange(normalize(q))}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
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
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
      <p className="text-sm leading-6 text-slate-600">
        Для площади <span className="font-semibold text-slate-950">{area} м²</span>{" "}
        ориентир по профилю:{" "}
        <span className="font-semibold text-slate-950">{recommended} м.п.</span> (1:1).
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          className="text-sm font-semibold text-slate-950 underline underline-offset-4 hover:text-slate-700"
        >
          Подставить 1:1
        </button>

        <span className="text-xs text-slate-500">Авто: {isAuto ? "включено" : "выключено"}</span>
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
        strong ? "text-sm font-semibold text-slate-950" : "text-sm text-slate-600",
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
};

export function PriceCalculatorClient({
  preset,
  compactSections = false,
}: PriceCalculatorClientProps) {
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const resolvedAreaDefault = preset?.areaDefault ?? calculator.areaDefault;
  const resolvedCeilingType = preset?.ceilingType ?? "standard";
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount = preset?.lightsCount ?? calculator.lights.countDefault;

  const [area, setArea] = useState<number>(resolvedAreaDefault);
  const [ceilingType, setCeilingType] = useState<CeilingType>(resolvedCeilingType);

  // профиль (периметр) + auto
  const [ceilingLength, setCeilingLength] = useState<number>(
    () => getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [ceilingLengthAuto, setCeilingLengthAuto] = useState<boolean>(true);

  const [lightLinesEnabled, setLightLinesEnabled] = useState<boolean>(false);
  const [lightLinesLength, setLightLinesLength] = useState<number>(
    calculator.lightLineMeters.default
  );

  const [corniceType, setCorniceType] = useState<CorniceType>(resolvedCorniceType);
  const [corniceLength, setCorniceLength] = useState<number>(
    calculator.corniceMeters.default
  );

  const [trackType, setTrackType] = useState<TrackType>(resolvedTrackType);
  const [trackLength, setTrackLength] = useState<number>(calculator.trackMeters.default);

  const [lightsEnabled, setLightsEnabled] = useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount] = useState<number>(resolvedLightsCount);

  const selectedCeiling = useMemo(
    () =>
      calculator.ceilingTypes.find((c) => c.slug === ceilingType) ??
      calculator.ceilingTypes[0],
    [ceilingType]
  );

  const selectedCornice = useMemo(
    () =>
      calculator.cornices.find((c) => c.slug === corniceType) ??
      calculator.cornices[0],
    [corniceType]
  );

  const selectedTrack = useMemo(
    () =>
      calculator.tracks.find((t) => t.slug === trackType) ?? calculator.tracks[0],
    [trackType]
  );

  const hasSpecialCeiling = selectedCeiling.extraRatePerMeter > 0;
  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

  const markInteracted = () => setHasInteracted(true);

  const handleAreaChange = (v: number) => {
    markInteracted();
    setArea(v);

    if (ceilingType !== "standard" && ceilingLengthAuto) {
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

  // totals
  const ceilingBaseRate = selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = area * ceilingBaseRate;

  const ceilingExtraTotal = hasSpecialCeiling
    ? ceilingLength * selectedCeiling.extraRatePerMeter
    : 0;

  const lightLinesTotal = lightLinesEnabled
    ? lightLinesLength * calculator.lightLines.ratePerMeter
    : 0;

  const corniceTotal =
    selectedCornice.ratePerMeter > 0
      ? corniceLength * selectedCornice.ratePerMeter
      : 0;

  const trackTotal =
    selectedTrack.ratePerMeter > 0 ? trackLength * selectedTrack.ratePerMeter : 0;

  const lightsTotal = lightsEnabled ? lightsCount * calculator.lights.ratePerUnit : 0;

  const total =
    ceilingBaseTotal +
    ceilingExtraTotal +
    lightLinesTotal +
    corniceTotal +
    trackTotal +
    lightsTotal;

  // derived inputs (важно для Step1 рекомендаций)
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
      ceilingTypeLabel: selectedCeiling.label,
      ceilingBaseRate,
      ceilingBaseTotal,

      ceilingExtraLabel: hasSpecialCeiling ? selectedCeiling.extraLabel ?? null : null,
      ceilingLength: hasSpecialCeiling ? ceilingLength : null,
      ceilingExtraRatePerMeter: hasSpecialCeiling
        ? selectedCeiling.extraRatePerMeter
        : null,
      ceilingExtraTotal,

      lightLinesEnabled,
      lightLinesLabel: lightLinesEnabled ? calculator.lightLines.label : null,
      lightLinesLength: lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled
        ? calculator.lightLines.ratePerMeter
        : null,
      lightLinesTotal,

      corniceLabel: selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
      corniceLength: selectedCornice.ratePerMeter > 0 ? corniceLength : null,
      corniceRatePerMeter:
        selectedCornice.ratePerMeter > 0 ? selectedCornice.ratePerMeter : null,
      corniceTotal,

      trackLabel: selectedTrack.ratePerMeter > 0 ? selectedTrack.label : null,
      trackLength: selectedTrack.ratePerMeter > 0 ? trackLength : null,
      trackRatePerMeter:
        selectedTrack.ratePerMeter > 0 ? selectedTrack.ratePerMeter : null,
      trackTotal,

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
      lightsEnabled,
      lightsCount,
      lightsTotal,
      total,
      derivedInputs,
    ]
  );

  // keep leadSource/lighting/grandTotal/_reconciled from previous snapshot
  useEffect(() => {
    setSnapshot((prev) => {
      if (prev == null) return snapshot;

      return {
        ...snapshot,
        leadSource: prev.leadSource ?? snapshot.leadSource,
        lighting: prev.lighting,
        grandTotal: prev.grandTotal,
        _reconciled: prev._reconciled,
      };
    });
  }, [setSnapshot, snapshot]);

  const showSlider = !compactSections; // в модалке: без range

  // ===== COMPACT (модалка Step0): один открытый шаг + подтверждения с галочкой =====
  const compactSteps: CompactStepId[] = useMemo(() => {
    return hasSpecialCeiling
      ? ["area", "ceiling", "profile", "lightLines", "cornice", "track", "lights"]
      : ["area", "ceiling", "lightLines", "cornice", "track", "lights"];
  }, [hasSpecialCeiling]);

  const [activeStep, setActiveStep] = useState<CompactStepId>("area");
  const [resumeStep, setResumeStep] = useState<CompactStepId | null>(null);

  const [confirmed, setConfirmed] = useState<Record<CompactStepId, boolean>>({
    area: !compactSections,
    ceiling: !compactSections,
    profile: !compactSections,
    lightLines: !compactSections,
    cornice: !compactSections,
    track: !compactSections,
    lights: !compactSections,
  });

  // refs for scrolling
  const areaRef = useRef<HTMLDivElement | null>(null);
  const ceilingRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const lightLinesRef = useRef<HTMLDivElement | null>(null);
  const corniceRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lightsRef = useRef<HTMLDivElement | null>(null);

  const getRef = (id: CompactStepId) => {
    switch (id) {
      case "area":
        return areaRef;
      case "ceiling":
        return ceilingRef;
      case "profile":
        return profileRef;
      case "lightLines":
        return lightLinesRef;
      case "cornice":
        return corniceRef;
      case "track":
        return trackRef;
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

    // оффсет под “шапку” модалки / липкие элементы
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

    // сначала рендер, потом корректный скролл с оффсетом
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToStep(id, "smooth"));
    });
  };

  const beginEdit = (id: CompactStepId) => {
    // запоминаем, откуда пользователь пришёл (чтобы после подтверждения вернуться)
    setResumeStep((prev) => prev ?? activeStep);

    // делаем редактируемый шаг "не подтвержден" (но НЕ трогаем остальные)
    setConfirmed((prev) => ({ ...prev, [id]: false }));

    openStep(id);
  };

  const confirmAndNavigate = (id: CompactStepId) => {
    // 1) подтверждаем текущий
    setConfirmed((prev) => ({ ...prev, [id]: true }));

    // 2) выбираем куда идти:
    //    - если это редактирование, возвращаемся туда, откуда пришли
    //    - иначе идём к следующему неподтвержденному
    const maybeResume = resumeStep && compactSteps.includes(resumeStep) ? resumeStep : null;

    const fallbackNext = nextUnconfirmedAfter(id);

    const nextTarget =
      maybeResume && maybeResume !== id
        ? maybeResume
        : fallbackNext;

    // очищаем resumeStep, если использовали
    if (maybeResume) setResumeStep(null);

    if (!nextTarget) {
      // всё подтверждено (или нет дальше) — просто оставляем текущий в summary
      return;
    }

    // ВАЖНО: "следующая вкладка должна быть закрыта перед переходом":
    // - пока activeStep остаётся текущим, следующая отрисована как CollapsedStep
    // - скроллим к ней в закрытом виде
    // - затем открываем
    setTimeout(() => {
      scrollToStep(nextTarget, "smooth");

      requestAnimationFrame(() => {
        setActiveStep(nextTarget);

        // после раскрытия высота меняется -> доскролливаем повторно,
        // чтобы верх шага не скрывался (фикс бага “уехало ниже и спряталось”)
        requestAnimationFrame(() => {
          scrollToStep(nextTarget, "auto");
        });
      });
    }, 0);
  };

  // Если потолок стал "не special" — профильный шаг исчезает => считаем его подтверждённым
  // Если потолок стал special — профиль появляется => делаем его неподтверждённым (важный шаг)
  useEffect(() => {
    if (!compactSections) return;

    setConfirmed((prev) => {
      const next = { ...prev };
      next.profile = hasSpecialCeiling ? false : true;
      return next;
    });

    setActiveStep((prev) => {
      if (prev === "profile" && !hasSpecialCeiling) return "lightLines";
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSpecialCeiling, compactSections]);

  if (compactSections) {
    const stepNumber = (id: CompactStepId) => {
      const idx = stepIndex(id);
      return idx >= 0 ? idx + 1 : 0;
    };

    return (
      <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
        {/* LEFT */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Быстрый расчёт</p>
            <p className="mt-1">Один шаг за раз: выбрали → подтвердили → дальше.</p>
          </div>

          {/* AREA */}
          <div ref={areaRef}>
            {confirmed.area ? (
              <SectionCard title={`${stepNumber("area")}) Площадь`}>
                <SummaryRow
                  label="Площадь"
                  value={`${area} м²`}
                  onEdit={() => beginEdit("area")}
                />
              </SectionCard>
            ) : activeStep === "area" ? (
              <SectionCard title={`${stepNumber("area")}) Площадь`}>
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
                  quickValues={[10, 15, 20, 25, 30, 40]}
                />

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Можно выбрать пресет или ввести вручную.</p>
                  <Button type="button" variant="secondary" onClick={() => confirmAndNavigate("area")}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("area")}) Площадь`}
                subtitle="Выберите площадь помещения"
                enabled
                onOpen={() => openStep("area")}
              />
            )}
          </div>

          {/* CEILING */}
          <div ref={ceilingRef}>
            {confirmed.ceiling ? (
              <SectionCard title={`${stepNumber("ceiling")}) Тип потолка`}>
                <SummaryRow
                  label="Тип"
                  value={selectedCeiling.label}
                  onEdit={() => beginEdit("ceiling")}
                />
              </SectionCard>
            ) : activeStep === "ceiling" ? (
              <SectionCard
                title={`${stepNumber("ceiling")}) Тип потолка`}
                description="Для теневого и парящего профиль считается отдельно (по м.п.)."
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {calculator.ceilingTypes.map((option) => {
                    const meta =
                      option.slug === "standard"
                        ? `от ${formatCurrency(option.baseRatePerSqm)} ₽ / м²`
                        : `${formatCurrency(option.baseRatePerSqm)} ₽ / м² + ${formatCurrency(option.extraRatePerMeter)} ₽ / м.п.`;

                    return (
                      <OptionCard
                        key={option.slug}
                        active={ceilingType === option.slug}
                        title={option.label}
                        meta={meta}
                        onClick={() => handleCeilingTypeChange(option.slug)}
                      />
                    );
                  })}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => confirmAndNavigate("ceiling")}
                    disabled={!isStepEnabled("ceiling")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("ceiling")}) Тип потолка`}
                subtitle={isStepEnabled("ceiling") ? "Выберите тип потолка" : "Сначала подтвердите площадь"}
                enabled={isStepEnabled("ceiling")}
                onOpen={() => openStep("ceiling")}
              />
            )}
          </div>

          {/* PROFILE (only when special ceiling) */}
          {hasSpecialCeiling ? (
            <div ref={profileRef}>
              {confirmed.profile ? (
                <SectionCard title={`${stepNumber("profile")}) Длина профиля`}>
                  <SummaryRow
                    label={selectedCeiling.extraLabel ?? "Профиль"}
                    value={`${ceilingLength} м.п. (${ceilingLengthAuto ? "авто 1:1" : "вручную"})`}
                    onEdit={() => beginEdit("profile")}
                  />
                </SectionCard>
              ) : activeStep === "profile" ? (
                <SectionCard
                  title={`${stepNumber("profile")}) Длина профиля`}
                  description={selectedCeiling.extraLabel ?? "Профиль по периметру"}
                >
                  <RangeField
                    id="ceiling-length-field"
                    label={`Длина: ${selectedCeiling.extraLabel ?? "профиль"}`}
                    value={ceilingLength}
                    min={calculator.specialMeters.min}
                    max={calculator.specialMeters.max}
                    step={calculator.specialMeters.step}
                    unit="м.п."
                    onChange={handleCeilingLengthChange}
                    showSlider={showSlider}
                    quickValues={[perimeterSuggestion.recommended]}
                  />

                  <PerimeterHint
                    area={area}
                    recommended={perimeterSuggestion.recommended}
                    onApply={applyPerimeterSuggestion}
                    isAuto={ceilingLengthAuto}
                  />

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Оставьте авто 1:1 или измените вручную.</p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => confirmAndNavigate("profile")}
                      disabled={!isStepEnabled("profile")}
                    >
                      Подтвердить
                    </Button>
                  </div>
                </SectionCard>
              ) : (
                <CollapsedStep
                  title={`${stepNumber("profile")}) Длина профиля`}
                  subtitle={isStepEnabled("profile") ? "Настройте длину профиля" : "Подтвердите предыдущий шаг"}
                  enabled={isStepEnabled("profile")}
                  onOpen={() => openStep("profile")}
                />
              )}
            </div>
          ) : null}

          {/* LIGHT LINES */}
          <div ref={lightLinesRef}>
            {confirmed.lightLines ? (
              <SectionCard title={`${stepNumber("lightLines")}) Световые линии`}>
                <SummaryRow
                  label="Световые линии"
                  value={lightLinesEnabled ? `${lightLinesLength} м.п.` : "нет"}
                  onEdit={() => beginEdit("lightLines")}
                />
              </SectionCard>
            ) : activeStep === "lightLines" ? (
              <SectionCard title={`${stepNumber("lightLines")}) Световые линии`}>
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => confirmAndNavigate("lightLines")}
                    disabled={!isStepEnabled("lightLines")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("lightLines")}) Световые линии`}
                subtitle={isStepEnabled("lightLines") ? "Выберите: нужны или нет" : "Подтвердите предыдущий шаг"}
                enabled={isStepEnabled("lightLines")}
                onOpen={() => openStep("lightLines")}
              />
            )}
          </div>

          {/* CORNICE */}
          <div ref={corniceRef}>
            {confirmed.cornice ? (
              <SectionCard title={`${stepNumber("cornice")}) Карнизы`}>
                <SummaryRow
                  label="Карниз"
                  value={
                    selectedCornice.ratePerMeter > 0
                      ? `${selectedCornice.label}, ${corniceLength} м.п.`
                      : "нет"
                  }
                  onEdit={() => beginEdit("cornice")}
                />
              </SectionCard>
            ) : activeStep === "cornice" ? (
              <SectionCard title={`${stepNumber("cornice")}) Карнизы`}>
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => confirmAndNavigate("cornice")}
                    disabled={!isStepEnabled("cornice")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("cornice")}) Карнизы`}
                subtitle={isStepEnabled("cornice") ? "Выберите: нужен или нет" : "Подтвердите предыдущий шаг"}
                enabled={isStepEnabled("cornice")}
                onOpen={() => openStep("cornice")}
              />
            )}
          </div>

          {/* TRACK */}
          <div ref={trackRef}>
            {confirmed.track ? (
              <SectionCard title={`${stepNumber("track")}) Трековое освещение`}>
                <SummaryRow
                  label="Трек"
                  value={
                    selectedTrack.ratePerMeter > 0
                      ? `${selectedTrack.label}, ${trackLength} м.п.`
                      : "нет"
                  }
                  onEdit={() => beginEdit("track")}
                />
              </SectionCard>
            ) : activeStep === "track" ? (
              <SectionCard title={`${stepNumber("track")}) Трековое освещение`}>
                <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
                  {calculator.tracks.map((option) => (
                    <OptionCard
                      key={option.slug}
                      active={trackType === option.slug}
                      title={option.label}
                      meta={
                        option.ratePerMeter > 0
                          ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                          : "Без доп. расчёта"
                      }
                      onClick={() => {
                        markInteracted();
                        setTrackType(option.slug);
                        if (option.slug !== "none") {
                          setTrackLength(calculator.trackMeters.default);
                        }
                      }}
                    />
                  ))}
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
                        setTrackLength(v);
                      }}
                      showSlider={showSlider}
                    />
                    <p className="mt-3 text-xs text-slate-500">
                      Ориентировочно: ~{calcRecommendedTrackSpots(trackLength)} спотов. Точный подбор — на следующем шаге.
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => confirmAndNavigate("track")}
                    disabled={!isStepEnabled("track")}
                  >
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("track")}) Трековое освещение`}
                subtitle={isStepEnabled("track") ? "Выберите: нужен или нет" : "Подтвердите предыдущий шаг"}
                enabled={isStepEnabled("track")}
                onOpen={() => openStep("track")}
              />
            )}
          </div>

          {/* LIGHTS */}
          <div ref={lightsRef}>
            {confirmed.lights ? (
              <SectionCard title={`${stepNumber("lights")}) Точечные светильники`}>
                <SummaryRow
                  label="Светильники"
                  value={lightsEnabled ? `${lightsCount} шт.` : "нет"}
                  onEdit={() => beginEdit("lights")}
                />
              </SectionCard>
            ) : activeStep === "lights" ? (
              <SectionCard title={`${stepNumber("lights")}) Точечные светильники`}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={!lightsEnabled}
                    title="Без светильников"
                    meta="Без поштучного расчёта"
                    onClick={() => {
                      markInteracted();
                      setLightsEnabled(false);
                    }}
                  />
                  <OptionCard
                    active={lightsEnabled}
                    title="Добавить светильники"
                    meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`}
                    onClick={() => {
                      markInteracted();
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
                        setLightsCount(v);
                      }}
                      showSlider={showSlider}
                      quickValues={[4, 6, 8, 10, 12]}
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button type="button" variant="secondary" onClick={() => confirmAndNavigate("lights")}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            ) : (
              <CollapsedStep
                title={`${stepNumber("lights")}) Точечные светильники`}
                subtitle={isStepEnabled("lights") ? "Выберите: нужны или нет" : "Подтвердите предыдущий шаг"}
                enabled={isStepEnabled("lights")}
                onOpen={() => openStep("lights")}
              />
            )}
          </div>
        </div>

        {/* RIGHT summary (компактный — без “Состав расчёта”, чтобы не ломать высоту) */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
            <p className="text-sm text-white/70">Ориентировочная стоимость от</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(total)} ₽</p>

            <p className="mt-2 text-xs text-white/70">
              Площадь {area} м² · {selectedCeiling.label}
              {hasSpecialCeiling ? ` · профиль ${ceilingLength} м.п.` : ""}
            </p>

            <div className="mt-6">
              <Button type="button" className="w-full">
                {homepage.price.primaryCtaLabel}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== NON-COMPACT (страница) — обычный режим с “Составом расчёта” =====
  return (
    <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
      <div className="min-w-0 space-y-5">
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
            quickValues={[10, 15, 20, 25, 30, 40]}
          />
        </SectionCard>

        <SectionCard
          title="Тип потолка"
          description="Для теневого и парящего профиль считается отдельно (по м.п.)."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {calculator.ceilingTypes.map((option) => {
              const meta =
                option.slug === "standard"
                  ? `от ${formatCurrency(option.baseRatePerSqm)} ₽ / м²`
                  : `${formatCurrency(option.baseRatePerSqm)} ₽ / м² + ${formatCurrency(option.extraRatePerMeter)} ₽ / м.п.`;

              return (
                <OptionCard
                  key={option.slug}
                  active={ceilingType === option.slug}
                  title={option.label}
                  meta={meta}
                  onClick={() => handleCeilingTypeChange(option.slug)}
                />
              );
            })}
          </div>
        </SectionCard>

        {hasSpecialCeiling ? (
          <SectionCard
            title="Длина профиля"
            description={selectedCeiling.extraLabel ?? "Профиль по периметру"}
          >
            <RangeField
              id="ceiling-length-field"
              label={`Длина: ${selectedCeiling.extraLabel ?? "профиль"}`}
              value={ceilingLength}
              min={calculator.specialMeters.min}
              max={calculator.specialMeters.max}
              step={calculator.specialMeters.step}
              unit="м.п."
              onChange={handleCeilingLengthChange}
              showSlider
            />

            <PerimeterHint
              area={area}
              recommended={perimeterSuggestion.recommended}
              onApply={applyPerimeterSuggestion}
              isAuto={ceilingLengthAuto}
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
            {calculator.tracks.map((option) => (
              <OptionCard
                key={option.slug}
                active={trackType === option.slug}
                title={option.label}
                meta={
                  option.ratePerMeter > 0
                    ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                    : "Без доп. расчёта"
                }
                onClick={() => {
                  markInteracted();
                  setTrackType(option.slug);
                  if (option.slug !== "none") setTrackLength(calculator.trackMeters.default);
                }}
              />
            ))}
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
                  setTrackLength(v);
                }}
                showSlider
              />
              <p className="mt-3 text-xs text-slate-500">
                Ориентировочно: ~{calcRecommendedTrackSpots(trackLength)} спотов.
              </p>
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
                setLightsEnabled(false);
              }}
            />
            <OptionCard
              active={lightsEnabled}
              title="Добавить светильники"
              meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`}
              onClick={() => {
                markInteracted();
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
          <p className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(total)} ₽</p>

          <p className="mt-2 text-xs text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/80">Состав расчёта</p>

            <div className="mt-3 space-y-2">
              <PriceRow label="Потолок" value={`${formatCurrency(ceilingBaseTotal)} ₽`} />

              {ceilingExtraTotal > 0 ? (
                <PriceRow
                  label={selectedCeiling.extraLabel ?? "Профиль"}
                  value={`${formatCurrency(ceilingExtraTotal)} ₽`}
                />
              ) : null}

              {lightLinesTotal > 0 ? (
                <PriceRow label={calculator.lightLines.label} value={`${formatCurrency(lightLinesTotal)} ₽`} />
              ) : null}

              {corniceTotal > 0 ? (
                <PriceRow label={selectedCornice.label} value={`${formatCurrency(corniceTotal)} ₽`} />
              ) : null}

              {trackTotal > 0 ? (
                <PriceRow label={selectedTrack.label} value={`${formatCurrency(trackTotal)} ₽`} />
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
            <Button type="button" className="w-full">
              {homepage.price.primaryCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
