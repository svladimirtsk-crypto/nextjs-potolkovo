"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

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

type PerimeterSuggestion = { min: number; max: number; recommended: number };

type AccordionSectionId =
  | "ceiling-profile"
  | "light-lines"
  | "cornices"
  | "tracks"
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
 * Значит ориентир (и recommended) = area.
 */
function getPerimeterSuggestion(area: number): PerimeterSuggestion {
  const recommended = clamp(
    roundToStep(area, calculator.specialMeters.step),
    calculator.specialMeters.min,
    calculator.specialMeters.max
  );

  return { min: recommended, max: recommended, recommended };
}

function getDefaultOpenSection(pathname: string): AccordionSectionId | null {
  const routeMap: Record<string, AccordionSectionId> = {
    "/uslugi/tenevoy-profil": "ceiling-profile",
    "/uslugi/paryashchie-potolki": "ceiling-profile",
    "/uslugi/skrytye-karnizy": "cornices",
    "/uslugi/trekovoe-osveshchenie": "tracks",
    "/uslugi/svetovye-linii": "light-lines",
  };

  return routeMap[pathname] ?? null;
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5",
        className ?? "",
      ].join(" ")}
    >
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

function CollapsibleSection({
  id,
  title,
  description,
  isDesktopAccordion,
  isOpen,
  onToggle,
  lastToggledId,
  children,
}: {
  id: AccordionSectionId;
  title: string;
  description?: string;
  isDesktopAccordion: boolean;
  isOpen: boolean;
  onToggle: (id: AccordionSectionId) => void;
  lastToggledId: AccordionSectionId | null;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    if (
      !isDesktopAccordion ||
      !isOpen ||
      wasOpenRef.current ||
      !contentRef.current ||
      lastToggledId !== id
    ) {
      wasOpenRef.current = isOpen;
      return;
    }

    const rect = contentRef.current.getBoundingClientRect();
    const viewportTop = 96;
    const viewportBottom = window.innerHeight - 24;

    if (rect.top < viewportTop || rect.bottom > viewportBottom) {
      contentRef.current.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }

    wasOpenRef.current = isOpen;
  }, [id, isDesktopAccordion, isOpen, lastToggledId]);

  if (!isDesktopAccordion) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:px-5"
        aria-expanded={isOpen}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>

        <span className="mt-0.5 text-sm text-slate-500">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen ? (
        <div
          ref={contentRef}
          className="border-t border-slate-200 px-4 py-4 sm:px-5"
        >
          {children}
        </div>
      ) : null}
    </section>
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
          <p className="line-clamp-2 text-sm font-semibold leading-5">
            {title}
          </p>
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

  const commitManual = (raw: string) => {
    const parsed = parseManual(raw);
    if (parsed === null) return;
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
              commitManual(next);
            }}
            onBlur={() => {
              const parsed = parseManual(manual);
              if (parsed === null) {
                setManual(String(value));
                return;
              }
              const next = normalize(parsed);
              setManual(String(next));
              if (next !== value) onChange(next);
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
  suggestion,
  onApply,
  isAuto,
}: {
  area: number;
  suggestion: PerimeterSuggestion;
  onApply: () => void;
  isAuto: boolean;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
      <p className="text-sm leading-6 text-slate-600">
        Для площади <span className="font-semibold text-slate-950">{area} м²</span>{" "}
        ориентир по профилю:{" "}
        <span className="font-semibold text-slate-950">
          {suggestion.recommended} м.п.
        </span>{" "}
        (1:1).
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onApply}
          className="text-sm font-semibold text-slate-950 underline underline-offset-4 hover:text-slate-700"
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
};

export function PriceCalculatorClient({
  preset,
  compactSections = false,
}: PriceCalculatorClientProps) {
  const pathname = usePathname();
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const [isDesktopAccordion, setIsDesktopAccordion] = useState(false);

  // guided UX только в compactSections (модалка Step0)
  const [areaConfirmed, setAreaConfirmed] = useState<boolean>(!compactSections);
  const [ceilingConfirmed, setCeilingConfirmed] = useState<boolean>(!compactSections);

  const areaSectionRef = useRef<HTMLDivElement | null>(null);
  const ceilingSectionRef = useRef<HTMLDivElement | null>(null);
  const extrasSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopAccordion(mq.matches && compactSections);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [compactSections]);

  const resolvedAreaDefault = preset?.areaDefault ?? calculator.areaDefault;
  const resolvedCeilingType = preset?.ceilingType ?? "standard";
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount = preset?.lightsCount ?? calculator.lights.countDefault;

  const [area, setArea] = useState<number>(resolvedAreaDefault);
  const [ceilingType, setCeilingType] = useState<CeilingType>(resolvedCeilingType);

  // Периметр (профиль) + авто-режим
  const [ceilingLength, setCeilingLength] = useState<number>(() =>
    getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [ceilingLengthAuto, setCeilingLengthAuto] = useState<boolean>(true);

  const [lightLinesEnabled, setLightLinesEnabled] = useState<boolean>(false);
  const [lightLinesLength, setLightLinesLength] = useState<number>(
    calculator.lightLineMeters.default
  );

  const [corniceType, setCorniceType] = useState<CorniceType>(resolvedCorniceType);
  const [corniceLength, setCorniceLength] = useState<number>(calculator.corniceMeters.default);

  const [trackType, setTrackType] = useState<TrackType>(resolvedTrackType);
  const [trackLength, setTrackLength] = useState<number>(calculator.trackMeters.default);

  const [lightsEnabled, setLightsEnabled] = useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount] = useState<number>(resolvedLightsCount);

  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

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
      calculator.tracks.find((t) => t.slug === trackType) ??
      calculator.tracks[0],
    [trackType]
  );

  const hasSpecialCeiling = selectedCeiling.extraRatePerMeter > 0;

  const defaultOpenSection = getDefaultOpenSection(pathname);

  const [openSections, setOpenSections] = useState<Record<AccordionSectionId, boolean>>({
    "ceiling-profile": false,
    "light-lines": false,
    cornices: false,
    tracks: false,
    lights: false,
  });

  const [lastToggledSection, setLastToggledSection] = useState<AccordionSectionId | null>(null);

  useEffect(() => {
    if (!isDesktopAccordion) return;

    setLastToggledSection(null);

    setOpenSections({
      "ceiling-profile": defaultOpenSection === "ceiling-profile" && hasSpecialCeiling,
      "light-lines": defaultOpenSection === "light-lines",
      cornices: defaultOpenSection === "cornices",
      tracks: defaultOpenSection === "tracks",
      lights: defaultOpenSection === "lights",
    });
  }, [defaultOpenSection, hasSpecialCeiling, isDesktopAccordion]);

  const toggleSection = (id: AccordionSectionId) => {
    setLastToggledSection(id);

    setOpenSections((prev) => {
      if (!isDesktopAccordion) return { ...prev, [id]: !prev[id] };

      // desktop accordion mode: открыта одна секция
      const next: Record<AccordionSectionId, boolean> = {
        "ceiling-profile": false,
        "light-lines": false,
        cornices: false,
        tracks: false,
        lights: false,
      };
      next[id] = !prev[id];
      return next;
    });
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
    selectedTrack.ratePerMeter > 0
      ? trackLength * selectedTrack.ratePerMeter
      : 0;

  const lightsTotal = lightsEnabled ? lightsCount * calculator.lights.ratePerUnit : 0;

  const total =
    ceilingBaseTotal +
    ceilingExtraTotal +
    lightLinesTotal +
    corniceTotal +
    trackTotal +
    lightsTotal;

  // derived inputs
  const derivedTrackMountType: DerivedInputs["trackMountType"] =
    trackType === "built-in" ? "built-in" : trackType === "surface" ? "surface" : "none";

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
      ceilingExtraRatePerMeter: hasSpecialCeiling ? selectedCeiling.extraRatePerMeter : null,
      ceilingExtraTotal,

      lightLinesEnabled,
      lightLinesLabel: lightLinesEnabled ? calculator.lightLines.label : null,
      lightLinesLength: lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled ? calculator.lightLines.ratePerMeter : null,
      lightLinesTotal,

      corniceLabel: selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
      corniceLength: selectedCornice.ratePerMeter > 0 ? corniceLength : null,
      corniceRatePerMeter: selectedCornice.ratePerMeter > 0 ? selectedCornice.ratePerMeter : null,
      corniceTotal,

      trackLabel: selectedTrack.ratePerMeter > 0 ? selectedTrack.label : null,
      trackLength: selectedTrack.ratePerMeter > 0 ? trackLength : null,
      trackRatePerMeter: selectedTrack.ratePerMeter > 0 ? selectedTrack.ratePerMeter : null,
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

  const markInteracted = () => setHasInteracted(true);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const handleAreaChange = (v: number) => {
    markInteracted();
    setArea(v);

    // авто-периметр (1:1) пока пользователь не “сломал” вручную
    if (ceilingType !== "standard" && ceilingLengthAuto) {
      setCeilingLength(getPerimeterSuggestion(v).recommended);
    }
  };

  const handleCeilingTypeChange = (slug: CeilingType) => {
    markInteracted();
    setCeilingType(slug);

    // При выборе теневого/парящего — включаем авто 1:1 (но НЕ подтверждаем шаг автоматически)
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

  const handleLightLinesEnabledChange = (v: boolean) => {
    markInteracted();
    setLightLinesEnabled(v);
  };

  const handleLightLinesLengthChange = (v: number) => {
    markInteracted();
    setLightLinesLength(v);
  };

  const handleCorniceTypeChange = (slug: CorniceType) => {
    markInteracted();
    setCorniceType(slug);
    if (slug !== "none") setCorniceLength(calculator.corniceMeters.default);
  };

  const handleCorniceLengthChange = (v: number) => {
    markInteracted();
    setCorniceLength(v);
  };

  const handleTrackTypeChange = (slug: TrackType) => {
    markInteracted();
    setTrackType(slug);
    if (slug !== "none") setTrackLength(calculator.trackMeters.default);
  };

  const handleTrackLengthChange = (v: number) => {
    markInteracted();
    setTrackLength(v);
  };

  const handleLightsEnabledChange = (v: boolean) => {
    markInteracted();
    setLightsEnabled(v);
  };

  const handleLightsCountChange = (v: number) => {
    markInteracted();
    setLightsCount(v);
  };

  const showSlider = !compactSections; // в модалке без range

  const activeStep: 0 | 1 | 2 = !compactSections
    ? 2
    : !areaConfirmed
      ? 0
      : !ceilingConfirmed
        ? 1
        : 2;

  const guidedRing = (active: boolean) =>
    compactSections && active ? "ring-2 ring-blue-600 ring-offset-2 bg-blue-50/50" : "";

  const confirmArea = () => {
    setAreaConfirmed(true);
    // если пользователь вернулся редактировать площадь — пусть переподтвердит потолок тоже
    setCeilingConfirmed(false);
    scrollToRef(ceilingSectionRef);
  };

  const confirmCeiling = () => {
    setCeilingConfirmed(true);

    // слегка “ведём дальше”: открываем релевантный блок
    if (hasSpecialCeiling) {
      setOpenSections((prev) => ({ ...prev, "ceiling-profile": true }));
    } else {
      setOpenSections((prev) => ({ ...prev, tracks: true }));
    }

    scrollToRef(extrasSectionRef);
  };

  return (
    <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
      {/* LEFT */}
      <div className="min-w-0 space-y-5">
        {compactSections ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Быстрый расчёт</p>
            <p className="mt-1">1) Площадь → 2) Тип потолка → 3) Доп. опции (по желанию).</p>
          </div>
        ) : null}

        {/* STEP A: AREA */}
        <div ref={areaSectionRef}>
          {compactSections && areaConfirmed ? (
            <SectionCard title="Площадь помещения" className={guidedRing(activeStep === 0)}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm text-slate-700">
                  Выбрано: <span className="font-semibold text-slate-950">{area} м²</span>
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAreaConfirmed(false);
                    setCeilingConfirmed(false);
                    scrollToRef(areaSectionRef);
                  }}
                >
                  Изменить
                </Button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Площадь помещения" className={guidedRing(activeStep === 0)}>
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

              {compactSections ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Можно ввести вручную или выбрать пресет.</p>
                  <Button type="button" variant="secondary" onClick={confirmArea}>
                    Подтвердить площадь
                  </Button>
                </div>
              ) : null}
            </SectionCard>
          )}
        </div>

        {/* STEP B: CEILING TYPE */}
        <div ref={ceilingSectionRef}>
          {compactSections && areaConfirmed && ceilingConfirmed ? (
            <SectionCard title="Тип потолка" className={guidedRing(activeStep === 1)}>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-sm text-slate-700">
                  Выбрано:{" "}
                  <span className="font-semibold text-slate-950">{selectedCeiling.label}</span>
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCeilingConfirmed(false);
                    scrollToRef(ceilingSectionRef);
                  }}
                >
                  Изменить
                </Button>
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title="Тип потолка"
              description="Для теневого и парящего: цена полотна считается по новой ставке за м², а профиль считается отдельно (по м.п.)."
              className={guidedRing(activeStep === 1)}
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
                      onClick={() => {
                        handleCeilingTypeChange(option.slug);
                        if (compactSections) setCeilingConfirmed(false);
                      }}
                    />
                  );
                })}
              </div>

              {compactSections ? (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">После выбора — подтвердите и перейдём дальше.</p>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={confirmCeiling}
                    disabled={!areaConfirmed}
                  >
                    Подтвердить тип потолка
                  </Button>
                </div>
              ) : null}
            </SectionCard>
          )}
        </div>

        {/* STEP C: EXTRAS */}
        <div ref={extrasSectionRef} />

        {hasSpecialCeiling ? (
          <CollapsibleSection
            id="ceiling-profile"
            title="Длина профиля"
            description={selectedCeiling.extraLabel ?? "Профиль по периметру"}
            isDesktopAccordion={isDesktopAccordion}
            isOpen={openSections["ceiling-profile"]}
            onToggle={toggleSection}
            lastToggledId={lastToggledSection}
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
              quickValues={compactSections ? [perimeterSuggestion.recommended] : undefined}
            />

            <PerimeterHint
              area={area}
              suggestion={perimeterSuggestion}
              onApply={applyPerimeterSuggestion}
              isAuto={ceilingLengthAuto}
            />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection
          id="light-lines"
          title="Световые линии"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections["light-lines"]}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={!lightLinesEnabled}
              title="Без световых линий"
              meta="Без дополнительного расчёта"
              onClick={() => handleLightLinesEnabledChange(false)}
            />
            <OptionCard
              active={lightLinesEnabled}
              title="Добавить световые линии"
              meta={`от ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽ / м.п.`}
              onClick={() => handleLightLinesEnabledChange(true)}
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
                onChange={handleLightLinesLengthChange}
                showSlider={showSlider}
              />
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          id="cornices"
          title="Карнизы"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.cornices}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {calculator.cornices.map((option) => (
              <OptionCard
                key={option.slug}
                active={corniceType === option.slug}
                title={option.label}
                meta={
                  option.ratePerMeter > 0
                    ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                    : "Без дополнительного расчёта"
                }
                onClick={() => handleCorniceTypeChange(option.slug)}
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
                onChange={handleCorniceLengthChange}
                showSlider={showSlider}
              />
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          id="tracks"
          title="Трековое освещение"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.tracks}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {calculator.tracks.map((option) => (
              <OptionCard
                key={option.slug}
                active={trackType === option.slug}
                title={option.label}
                meta={
                  option.ratePerMeter > 0
                    ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                    : "Без дополнительного расчёта"
                }
                onClick={() => handleTrackTypeChange(option.slug)}
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
                onChange={handleTrackLengthChange}
                showSlider={showSlider}
              />

              <p className="mt-3 text-xs text-slate-500">
                Ориентировочно: ~{calcRecommendedTrackSpots(trackLength)} спотов. Точный подбор — на следующем шаге.
              </p>
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          id="lights"
          title="Точечные светильники"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.lights}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <OptionCard
              active={!lightsEnabled}
              title="Без светильников"
              meta="Без поштучного расчёта"
              onClick={() => handleLightsEnabledChange(false)}
            />
            <OptionCard
              active={lightsEnabled}
              title="Добавить светильники"
              meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт`}
              onClick={() => handleLightsEnabledChange(true)}
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
                onChange={handleLightsCountChange}
                showSlider={showSlider}
                quickValues={compactSections ? [4, 6, 8, 10, 12] : undefined}
              />
            </div>
          ) : null}
        </CollapsibleSection>
      </div>

      {/* RIGHT summary */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
          <p className="text-sm text-white/70">Ориентировочная стоимость от</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCurrency(total)} ₽
          </p>

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

          {compactSections ? (
            <p className="mt-3 text-xs text-white/60">
              Подсказка: если вы пришли “только за светом” — параметры потолка можно пропустить и перейти к каталогу на следующем шаге.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
