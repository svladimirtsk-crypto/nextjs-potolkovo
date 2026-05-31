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
      <p className="text-sm text-slate-700">
        {label}: <span className="font-semibold text-slate-950">{value}</span>
      </p>
      <Button type="button" variant="secondary" onClick={onEdit}>
        Изменить
      </Button>
    </div>
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

  const commit = (raw: string) => {
    const parsed = parseManual(raw);
    if (parsed === null) return;

    // ВАЖНО: не "прыгаем" на min во время промежуточного ввода.
    // Если пользователь ввёл меньше min — ждём нормального значения/blur/Enter.
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
              commit(next);
            }}
            onBlur={() => {
              const parsed = parseManual(manual);
              if (parsed === null) {
                setManual(String(value));
                return;
              }

              // blur: можно уже нормализовать (clamp), чтобы поле не оставалось "вне диапазона"
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
  const pathname = usePathname();
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const resolvedAreaDefault = preset?.areaDefault ?? calculator.areaDefault;
  const resolvedCeilingType = preset?.ceilingType ?? "standard";
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount = preset?.lightsCount ?? calculator.lights.countDefault;

  const [area, setArea] = useState<number>(resolvedAreaDefault);
  const [ceilingType, setCeilingType] = useState<CeilingType>(resolvedCeilingType);

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

  const selectedCeiling = useMemo(
    () => calculator.ceilingTypes.find((c) => c.slug === ceilingType) ?? calculator.ceilingTypes[0],
    [ceilingType]
  );

  const selectedCornice = useMemo(
    () => calculator.cornices.find((c) => c.slug === corniceType) ?? calculator.cornices[0],
    [corniceType]
  );

  const selectedTrack = useMemo(
    () => calculator.tracks.find((t) => t.slug === trackType) ?? calculator.tracks[0],
    [trackType]
  );

  const hasSpecialCeiling = selectedCeiling.extraRatePerMeter > 0;
  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

  // confirmation flow (только для модалки)
  const [areaConfirmed, setAreaConfirmed] = useState(!compactSections);
  const [ceilingConfirmed, setCeilingConfirmed] = useState(!compactSections);
  const [profileConfirmed, setProfileConfirmed] = useState(!compactSections);
  const [lightLinesConfirmed, setLightLinesConfirmed] = useState(!compactSections);
  const [corniceConfirmed, setCorniceConfirmed] = useState(!compactSections);
  const [trackConfirmed, setTrackConfirmed] = useState(!compactSections);
  const [lightsConfirmed, setLightsConfirmed] = useState(!compactSections);

  const areaRef = useRef<HTMLDivElement | null>(null);
  const ceilingRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const lightLinesRef = useRef<HTMLDivElement | null>(null);
  const corniceRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lightsRef = useRef<HTMLDivElement | null>(null);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    const el = ref.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const markInteracted = () => setHasInteracted(true);

  const resetAfterAreaEdit = () => {
    setCeilingConfirmed(false);
    setProfileConfirmed(false);
    setLightLinesConfirmed(false);
    setCorniceConfirmed(false);
    setTrackConfirmed(false);
    setLightsConfirmed(false);
  };

  const resetAfterCeilingEdit = () => {
    setProfileConfirmed(false);
    setLightLinesConfirmed(false);
    setCorniceConfirmed(false);
    setTrackConfirmed(false);
    setLightsConfirmed(false);
  };

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

  // derived inputs (важно для Step1 рекомендаций)
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

  const showSlider = !compactSections;

  // non-compact: оставляем “аккордеон” как было раньше по смыслу (без подтверждений)
  const defaultOpenSection = getDefaultOpenSection(pathname);
  const [isDesktopAccordion, setIsDesktopAccordion] = useState(false);
  const [openSections, setOpenSections] = useState<Record<AccordionSectionId, boolean>>({
    "ceiling-profile": false,
    "light-lines": false,
    cornices: false,
    tracks: false,
    lights: false,
  });
  const [lastToggledSection, setLastToggledSection] = useState<AccordionSectionId | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopAccordion(mq.matches && compactSections);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [compactSections]);

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

  // ====== UI ======
  if (compactSections) {
    const activeRing = (active: boolean) =>
      active ? "ring-2 ring-blue-600 ring-offset-2 bg-blue-50/50" : "";

    const confirmArea = () => {
      setAreaConfirmed(true);
      resetAfterAreaEdit();
      scrollTo(ceilingRef);
    };

    const confirmCeiling = () => {
      setCeilingConfirmed(true);
      resetAfterCeilingEdit();
      if (hasSpecialCeiling) {
        scrollTo(profileRef);
      } else {
        scrollTo(lightLinesRef);
      }
    };

    const confirmProfile = () => {
      setProfileConfirmed(true);
      scrollTo(lightLinesRef);
    };

    const confirmLightLines = () => {
      setLightLinesConfirmed(true);
      scrollTo(corniceRef);
    };

    const confirmCornice = () => {
      setCorniceConfirmed(true);
      scrollTo(trackRef);
    };

    const confirmTrack = () => {
      setTrackConfirmed(true);
      scrollTo(lightsRef);
    };

    const confirmLights = () => {
      setLightsConfirmed(true);
    };

    return (
      <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
        {/* LEFT */}
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-950">Быстрый расчёт</p>
            <p className="mt-1">Подтверждайте шаги по очереди — так проще и без путаницы.</p>
          </div>

          {/* AREA */}
          <div ref={areaRef}>
            {areaConfirmed ? (
              <SectionCard title="1) Площадь" className={activeRing(!areaConfirmed)}>
                <SummaryRow
                  label="Площадь"
                  value={`${area} м²`}
                  onEdit={() => {
                    setAreaConfirmed(false);
                    resetAfterAreaEdit();
                    scrollTo(areaRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard title="1) Площадь" className={activeRing(true)}>
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
                  <Button type="button" variant="secondary" onClick={confirmArea}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* CEILING */}
          <div ref={ceilingRef}>
            {ceilingConfirmed ? (
              <SectionCard title="2) Тип потолка" className={activeRing(areaConfirmed && !ceilingConfirmed)}>
                <SummaryRow
                  label="Тип"
                  value={selectedCeiling.label}
                  onEdit={() => {
                    setCeilingConfirmed(false);
                    resetAfterCeilingEdit();
                    scrollTo(ceilingRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard
                title="2) Тип потолка"
                description="Для теневого и парящего профиль считается отдельно (по м.п.)."
                className={activeRing(areaConfirmed)}
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
                  <Button type="button" variant="secondary" onClick={confirmCeiling} disabled={!areaConfirmed}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* PROFILE (only for special) */}
          {hasSpecialCeiling ? (
            <div ref={profileRef}>
              {profileConfirmed ? (
                <SectionCard title="3) Длина профиля" className={activeRing(ceilingConfirmed && !profileConfirmed)}>
                  <SummaryRow
                    label={selectedCeiling.extraLabel ?? "Профиль"}
                    value={`${ceilingLength} м.п. (${ceilingLengthAuto ? "авто 1:1" : "вручную"})`}
                    onEdit={() => {
                      setProfileConfirmed(false);
                      scrollTo(profileRef);
                    }}
                  />
                </SectionCard>
              ) : (
                <SectionCard
                  title="3) Длина профиля"
                  description={selectedCeiling.extraLabel ?? "Профиль по периметру"}
                  className={activeRing(ceilingConfirmed)}
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
                    suggestion={perimeterSuggestion}
                    onApply={applyPerimeterSuggestion}
                    isAuto={ceilingLengthAuto}
                  />

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">Можно оставить авто 1:1 или изменить вручную.</p>
                    <Button type="button" variant="secondary" onClick={confirmProfile} disabled={!ceilingConfirmed}>
                      Подтвердить
                    </Button>
                  </div>
                </SectionCard>
              )}
            </div>
          ) : null}

          {/* LIGHT LINES */}
          <div ref={lightLinesRef}>
            {lightLinesConfirmed ? (
              <SectionCard title={`${hasSpecialCeiling ? "4" : "3"}) Световые линии`} className={activeRing(false)}>
                <SummaryRow
                  label="Световые линии"
                  value={lightLinesEnabled ? `${lightLinesLength} м.п.` : "нет"}
                  onEdit={() => {
                    setLightLinesConfirmed(false);
                    scrollTo(lightLinesRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard title={`${hasSpecialCeiling ? "4" : "3"}) Световые линии`} className={activeRing(true)}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionCard
                    active={!lightLinesEnabled}
                    title="Без световых линий"
                    meta="Без доп. расчёта"
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button type="button" variant="secondary" onClick={confirmLightLines}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* CORNICES */}
          <div ref={corniceRef}>
            {corniceConfirmed ? (
              <SectionCard title={`${hasSpecialCeiling ? "5" : "4"}) Карнизы`}>
                <SummaryRow
                  label="Карниз"
                  value={
                    selectedCornice.ratePerMeter > 0 ? `${selectedCornice.label}, ${corniceLength} м.п.` : "нет"
                  }
                  onEdit={() => {
                    setCorniceConfirmed(false);
                    scrollTo(corniceRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard title={`${hasSpecialCeiling ? "5" : "4"}) Карнизы`}>
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button type="button" variant="secondary" onClick={confirmCornice}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* TRACKS */}
          <div ref={trackRef}>
            {trackConfirmed ? (
              <SectionCard title={`${hasSpecialCeiling ? "6" : "5"}) Трековое освещение`}>
                <SummaryRow
                  label="Трек"
                  value={selectedTrack.ratePerMeter > 0 ? `${selectedTrack.label}, ${trackLength} м.п.` : "нет"}
                  onEdit={() => {
                    setTrackConfirmed(false);
                    scrollTo(trackRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard title={`${hasSpecialCeiling ? "6" : "5"}) Трековое освещение`}>
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

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button type="button" variant="secondary" onClick={confirmTrack}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>

          {/* LIGHTS */}
          <div ref={lightsRef}>
            {lightsConfirmed ? (
              <SectionCard title={`${hasSpecialCeiling ? "7" : "6"}) Точечные светильники`}>
                <SummaryRow
                  label="Светильники"
                  value={lightsEnabled ? `${lightsCount} шт.` : "нет"}
                  onEdit={() => {
                    setLightsConfirmed(false);
                    scrollTo(lightsRef);
                  }}
                />
              </SectionCard>
            ) : (
              <SectionCard title={`${hasSpecialCeiling ? "7" : "6"}) Точечные светильники`}>
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
                      quickValues={[4, 6, 8, 10, 12]}
                    />
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">Выберите вариант и подтвердите.</p>
                  <Button type="button" variant="secondary" onClick={confirmLights}>
                    Подтвердить
                  </Button>
                </div>
              </SectionCard>
            )}
          </div>
        </div>

        {/* RIGHT summary (короткий в модалке — без "Состав расчёта") */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
            <p className="text-sm text-white/70">Ориентировочная стоимость от</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatCurrency(total)} ₽
            </p>

            <p className="mt-2 text-xs text-white/70">
              Площадь {area} м² · {selectedCeiling.label}
              {hasSpecialCeiling ? ` · профиль ${ceilingLength} м.п.` : ""}
            </p>

            <div className="mt-6">
              <Button type="button" className="w-full">
                {homepage.price.primaryCtaLabel}
              </Button>
            </div>

            <p className="mt-3 text-xs text-white/60">
              Если вы пришли “за светом”, параметры можно поставить минимально — продолжите на следующем шаге.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== Non-compact (страница) — оставить прежнюю логику с “Составом расчёта” =====

  const ceilingExtraTotalNonCompact =
    hasSpecialCeiling ? ceilingLength * selectedCeiling.extraRatePerMeter : 0;

  const lightLinesTotalNonCompact = lightLinesEnabled
    ? lightLinesLength * calculator.lightLines.ratePerMeter
    : 0;

  const corniceTotalNonCompact =
    selectedCornice.ratePerMeter > 0
      ? corniceLength * selectedCornice.ratePerMeter
      : 0;

  const trackTotalNonCompact =
    selectedTrack.ratePerMeter > 0 ? trackLength * selectedTrack.ratePerMeter : 0;

  const lightsTotalNonCompact = lightsEnabled
    ? lightsCount * calculator.lights.ratePerUnit
    : 0;

  const totalNonCompact =
    ceilingBaseTotal +
    ceilingExtraTotalNonCompact +
    lightLinesTotalNonCompact +
    corniceTotalNonCompact +
    trackTotalNonCompact +
    lightsTotalNonCompact;

  // auto perimeter for non-compact too
  useEffect(() => {
    if (ceilingType === "standard") return;
    if (!ceilingLengthAuto) return;
    setCeilingLength(getPerimeterSuggestion(area).recommended);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, ceilingType]);

  const applyPerimeterSuggestionNonCompact = () => {
    markInteracted();
    setCeilingLengthAuto(true);
    setCeilingLength(perimeterSuggestion.recommended);
  };

  const handleCeilingLengthChangeNonCompact = (v: number) => {
    markInteracted();
    setCeilingLengthAuto(false);
    setCeilingLength(v);
  };

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
            onChange={(v) => {
              markInteracted();
              handleAreaChange(v);
            }}
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
              onChange={handleCeilingLengthChangeNonCompact}
              showSlider
            />

            <PerimeterHint
              area={area}
              suggestion={perimeterSuggestion}
              onApply={applyPerimeterSuggestionNonCompact}
              isAuto={ceilingLengthAuto}
            />
          </SectionCard>
        ) : null}

        {/* Остальные блоки оставляем как обычные секции (без подтверждений) */}
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
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {formatCurrency(totalNonCompact)} ₽
          </p>

          <p className="mt-2 text-xs text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-6 rounded-2xl bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/80">Состав расчёта</p>

            <div className="mt-3 space-y-2">
              <PriceRow label="Потолок" value={`${formatCurrency(ceilingBaseTotal)} ₽`} />

              {ceilingExtraTotalNonCompact > 0 ? (
                <PriceRow
                  label={selectedCeiling.extraLabel ?? "Профиль"}
                  value={`${formatCurrency(ceilingExtraTotalNonCompact)} ₽`}
                />
              ) : null}

              {lightLinesTotalNonCompact > 0 ? (
                <PriceRow
                  label={calculator.lightLines.label}
                  value={`${formatCurrency(lightLinesTotalNonCompact)} ₽`}
                />
              ) : null}

              {corniceTotalNonCompact > 0 ? (
                <PriceRow label={selectedCornice.label} value={`${formatCurrency(corniceTotalNonCompact)} ₽`} />
              ) : null}

              {trackTotalNonCompact > 0 ? (
                <PriceRow label={selectedTrack.label} value={`${formatCurrency(trackTotalNonCompact)} ₽`} />
              ) : null}

              {lightsTotalNonCompact > 0 ? (
                <PriceRow label="Светильники" value={`${formatCurrency(lightsTotalNonCompact)} ₽`} />
              ) : null}

              <div className="border-t border-white/10 pt-3">
                <PriceRow label="Итого" value={`${formatCurrency(totalNonCompact)} ₽`} strong />
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
