// components/home/price-calculator-client.tsx
"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { homepage } from "@/content/homepage";
import type { ServiceCalculatorPreset } from "@/content/services";

import { Button } from "@/components/ui/button";
import {
  CalculatorLeadSnapshot,
  usePriceCalculatorBridge,
} from "./price-calculator-context";
import {
  calcRecommendedTrackSpots,
} from "@/lib/lighting-formulas";
import type { DerivedInputs } from "@/lib/calculator-modal-types";

const calculator = homepage.price.calculator;

type CeilingType = (typeof calculator.ceilingTypes)[number]["slug"];
type CorniceType = (typeof calculator.cornices)[number]["slug"];
type TrackType   = (typeof calculator.tracks)[number]["slug"];

type PerimeterSuggestion = { min: number; max: number; recommended: number };
type AccordionSectionId =
  | "ceiling-profile"
  | "light-lines"
  | "cornices"
  | "tracks"
  | "lights";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number) {
  if (step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

function getPerimeterSuggestion(area: number): PerimeterSuggestion {
  const minRaw = Math.sqrt(area) * calculator.perimeterHintMinMultiplier;
  const maxRaw = Math.sqrt(area) * calculator.perimeterHintMaxMultiplier;

  const min = clamp(
    roundToStep(minRaw, calculator.specialMeters.step),
    calculator.specialMeters.min,
    calculator.specialMeters.max
  );
  const max = clamp(
    roundToStep(maxRaw, calculator.specialMeters.step),
    calculator.specialMeters.min,
    calculator.specialMeters.max
  );
  const normalizedMax = Math.max(min, max);
  const recommended = clamp(
    roundToStep((min + normalizedMax) / 2, calculator.specialMeters.step),
    min,
    normalizedMax
  );

  return { min, max: normalizedMax, recommended };
}

function getDefaultOpenSection(pathname: string): AccordionSectionId | null {
  const routeMap: Record<string, AccordionSectionId> = {
    "/uslugi/tenevoy-profil":       "ceiling-profile",
    "/uslugi/paryashchie-potolki":  "ceiling-profile",
    "/uslugi/skrytye-karnizy":      "cornices",
    "/uslugi/trekovoe-osveshchenie":"tracks",
    "/uslugi/svetovye-linii":       "light-lines",
  };
  return routeMap[pathname] ?? null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
      <SectionCard title={title} description={description}>
        {children}
      </SectionCard>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
        aria-expanded={isOpen}
        aria-controls={`calculator-panel-${id}`}
        onClick={() => onToggle(id)}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={`shrink-0 text-sm text-slate-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen ? (
        <div
          id={`calculator-panel-${id}`}
          ref={contentRef}
          className="border-t border-slate-200 px-4 py-4 sm:px-5"
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

// ── OptionCard — ИЗМЕНЕНО: line-clamp + фиксированная высота ─────────────────

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
        // Базовая геометрия
        "rounded-2xl border p-4 text-left transition-all",
        // Выравниваем высоту всех карточек в строке
        "flex flex-col h-full",
        // Активное/неактивное состояние
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3 flex-1">
        <div className="min-w-0 flex-1">
          {/* line-clamp-2: заголовок не растягивает карточку */}
          <p className="text-sm font-semibold line-clamp-2 leading-5">{title}</p>
          {/* line-clamp-2: мета тоже ограничена */}
          <p
            className={[
              "mt-1 text-xs leading-5 line-clamp-2",
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

function SummaryPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
      {children}
    </span>
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
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const [manual, setManual] = useState<string>(String(value));

  useEffect(() => {
    setManual(String(value));
  }, [value]);

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

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label={label}
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
        </div>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pc-range mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-950"
      />

      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
}

function PerimeterHint({
  area,
  suggestion,
  onApply,
}: {
  area: number;
  suggestion: PerimeterSuggestion;
  onApply: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4">
      <p className="text-sm leading-6 text-slate-600">
        Для площади {area} м² ориентир по периметру —{" "}
        <span className="font-semibold text-slate-950">
          {suggestion.min}–{suggestion.max} м.п.
        </span>
        . Точное значение зависит от формы помещения.
      </p>
      <button
        type="button"
        onClick={onApply}
        className="mt-3 text-sm font-semibold text-slate-950 underline underline-offset-4 hover:text-slate-700"
      >
        Подставить ориентир: {suggestion.recommended} м.п.
      </button>
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
      className={`flex items-center justify-between gap-4 ${
        strong
          ? "text-sm font-semibold text-slate-950"
          : "text-sm text-slate-600"
      }`}
    >
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopAccordion(mq.matches && compactSections);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [compactSections]);

  const resolvedAreaDefault   = preset?.areaDefault  ?? calculator.areaDefault;
  const resolvedCeilingType   = preset?.ceilingType  ?? "standard";
  const resolvedCorniceType   = preset?.corniceType  ?? "none";
  const resolvedTrackType     = preset?.trackType    ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount   = preset?.lightsCount  ?? calculator.lights.countDefault;

  const [area, setArea]               = useState<number>(resolvedAreaDefault);
  const [ceilingType, setCeilingType] = useState<CeilingType>(resolvedCeilingType);
  const [ceilingLength, setCeilingLength] = useState<number>(
    () => getPerimeterSuggestion(resolvedAreaDefault).recommended
  );
  const [lightLinesEnabled, setLightLinesEnabled] = useState<boolean>(false);
  const [lightLinesLength, setLightLinesLength]   = useState<number>(calculator.lightLineMeters.default);
  const [corniceType, setCorniceType] = useState<CorniceType>(resolvedCorniceType);
  const [corniceLength, setCorniceLength] = useState<number>(calculator.corniceMeters.default);
  const [trackType, setTrackType]     = useState<TrackType>(resolvedTrackType);
  const [trackLength, setTrackLength] = useState<number>(calculator.trackMeters.default);
  const [lightsEnabled, setLightsEnabled] = useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount]     = useState<number>(resolvedLightsCount);

  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

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
  const defaultOpenSection = getDefaultOpenSection(pathname);

  const [openSections, setOpenSections] = useState<Record<AccordionSectionId, boolean>>({
    "ceiling-profile": false,
    "light-lines":     false,
    cornices:          false,
    tracks:            false,
    lights:            false,
  });
  const [lastToggledSection, setLastToggledSection] = useState<AccordionSectionId | null>(null);

  useEffect(() => {
    if (!isDesktopAccordion) return;
    setLastToggledSection(null);
    setOpenSections({
      "ceiling-profile": defaultOpenSection === "ceiling-profile" && hasSpecialCeiling,
      "light-lines":     defaultOpenSection === "light-lines",
      cornices:          defaultOpenSection === "cornices",
      tracks:            defaultOpenSection === "tracks",
      lights:            defaultOpenSection === "lights",
    });
  }, [defaultOpenSection, hasSpecialCeiling, isDesktopAccordion]);

  const toggleSection = (id: AccordionSectionId) => {
    setLastToggledSection(id);
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Calculations ───────────────────────────────────────────────────────────
  const ceilingBaseRate  = selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = area * ceilingBaseRate;
  const ceilingExtraTotal = hasSpecialCeiling
    ? ceilingLength * selectedCeiling.extraRatePerMeter
    : 0;
  const lightLinesTotal = lightLinesEnabled
    ? lightLinesLength * calculator.lightLines.ratePerMeter
    : 0;
  const corniceTotal = selectedCornice.ratePerMeter > 0
    ? corniceLength * selectedCornice.ratePerMeter
    : 0;
  const trackTotal = selectedTrack.ratePerMeter > 0
    ? trackLength * selectedTrack.ratePerMeter
    : 0;
  const lightsTotal = lightsEnabled
    ? lightsCount * calculator.lights.ratePerUnit
    : 0;
  const total =
    ceilingBaseTotal + ceilingExtraTotal + lightLinesTotal + corniceTotal + trackTotal + lightsTotal;

  const derivedTrackMountType: DerivedInputs["trackMountType"] =
    trackType === "built-in" ? "built-in"
    : trackType === "surface" ? "surface"
    : "none";

  const derivedTrackLength = trackType !== "none" ? trackLength : 0;

  const derivedInputs = useMemo<DerivedInputs>(
    () => ({
      pointSpotsQty:            lightsEnabled ? lightsCount : 0,
      trackMountType:           derivedTrackMountType,
      trackLengthMeters:        derivedTrackLength,
      recommendedTrackSpotsQty: calcRecommendedTrackSpots(derivedTrackLength, derivedTrackMountType),
    }),
    [lightsEnabled, lightsCount, derivedTrackMountType, derivedTrackLength]
  );

  const snapshot = useMemo<CalculatorLeadSnapshot>(
    () => ({
      area,
      ceilingTypeLabel: selectedCeiling.label,
      ceilingBaseRate,
      ceilingBaseTotal,

      ceilingExtraLabel:        hasSpecialCeiling ? selectedCeiling.extraLabel ?? null : null,
      ceilingLength:            hasSpecialCeiling ? ceilingLength : null,
      ceilingExtraRatePerMeter: hasSpecialCeiling ? selectedCeiling.extraRatePerMeter : null,
      ceilingExtraTotal,

      lightLinesEnabled,
      lightLinesLabel:        lightLinesEnabled ? calculator.lightLines.label : null,
      lightLinesLength:       lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled ? calculator.lightLines.ratePerMeter : null,
      lightLinesTotal,

      corniceLabel:      selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
      corniceLength:     selectedCornice.ratePerMeter > 0 ? corniceLength : null,
      corniceRatePerMeter: selectedCornice.ratePerMeter > 0 ? selectedCornice.ratePerMeter : null,
      corniceTotal,

      trackLabel:      selectedTrack.ratePerMeter > 0 ? selectedTrack.label : null,
      trackLength:     selectedTrack.ratePerMeter > 0 ? trackLength : null,
      trackRatePerMeter: selectedTrack.ratePerMeter > 0 ? selectedTrack.ratePerMeter : null,
      trackTotal,

      lightsEnabled,
      lightsCount:     lightsEnabled ? lightsCount : null,
      lightsRatePerUnit: calculator.lights.ratePerUnit,
      lightsTotal,

      total,
      derivedInputs,
    }),
    [
      area, selectedCeiling, ceilingBaseRate, ceilingBaseTotal,
      hasSpecialCeiling, ceilingLength, ceilingExtraTotal,
      lightLinesEnabled, lightLinesLength, lightLinesTotal,
      selectedCornice, corniceLength, corniceTotal,
      selectedTrack, trackLength, trackTotal,
      lightsEnabled, lightsCount, lightsTotal,
      total, derivedInputs,
    ]
  );

  useEffect(() => {
    setSnapshot(snapshot);
  }, [setSnapshot, snapshot]);

  const markInteracted = () => setHasInteracted(true);

  const handleAreaChange = (v: number) => { markInteracted(); setArea(v); };

  const handleCeilingTypeChange = (slug: CeilingType) => {
    markInteracted();
    setCeilingType(slug);
    if (slug !== "standard") setCeilingLength(perimeterSuggestion.recommended);
  };

  const handleCeilingLengthChange = (v: number) => { markInteracted(); setCeilingLength(v); };

  const handleLightLinesEnabledChange = (v: boolean) => { markInteracted(); setLightLinesEnabled(v); };
  const handleLightLinesLengthChange  = (v: number)  => { markInteracted(); setLightLinesLength(v); };

  const handleCorniceTypeChange = (slug: CorniceType) => {
    markInteracted();
    setCorniceType(slug);
    if (slug !== "none") setCorniceLength(calculator.corniceMeters.default);
  };
  const handleCorniceLengthChange = (v: number) => { markInteracted(); setCorniceLength(v); };

  const handleTrackTypeChange = (slug: TrackType) => {
    markInteracted();
    setTrackType(slug);
    if (slug !== "none") setTrackLength(calculator.trackMeters.default);
  };
  const handleTrackLengthChange = (v: number) => { markInteracted(); setTrackLength(v); };

  const handleLightsEnabledChange = (v: boolean) => { markInteracted(); setLightsEnabled(v); };
  const handleLightsCountChange   = (v: number)  => { markInteracted(); setLightsCount(v); };

  const applyPerimeterSuggestion = () => {
    markInteracted();
    setCeilingLength(perimeterSuggestion.recommended);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
      <div className="min-w-0 space-y-5">

        {/* ── Area ── */}
        <SectionCard title="Площадь помещения">
          <RangeField
            id="area-range"
            label="Выберите площадь"
            value={area}
            min={calculator.areaMin}
            max={calculator.areaMax}
            step={calculator.areaStep}
            unit="м²"
            onChange={handleAreaChange}
          />
        </SectionCard>

        {/* ── Ceiling type — 3 варианта → grid-cols-3 в модалке ── */}
        <SectionCard
          title="Тип потолка"
          description="Для теневого и парящего потолка цена полотна считается по новой ставке за м², а профиль считается отдельно в погонных метрах."
        >
          {/*
            ИЗМЕНЕНО:
            - Было: grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3
            - Стало: grid-cols-1 gap-3 sm:grid-cols-3
            Причина: xl:grid-cols-3 не срабатывал в модалке md:max-w-3xl (768px).
            sm:grid-cols-3 (≥640px) — все 3 варианта в строку, нет хвоста.
            В мобилке (< 640px) — 1 колонка, ОК.
          */}
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

        {/* ── Ceiling profile length ── */}
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
              id="ceiling-length-range"
              label={`Длина: ${selectedCeiling.extraLabel}`}
              value={ceilingLength}
              min={calculator.specialMeters.min}
              max={calculator.specialMeters.max}
              step={calculator.specialMeters.step}
              unit="м.п."
              onChange={handleCeilingLengthChange}
            />
            <PerimeterHint
              area={area}
              suggestion={perimeterSuggestion}
              onApply={applyPerimeterSuggestion}
            />
          </CollapsibleSection>
        ) : null}

        {/* ── Light lines ── */}
        <CollapsibleSection
          id="light-lines"
          title="Световые линии"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections["light-lines"]}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          {/*
            2 варианта → grid-cols-2 везде. Без изменений — уже ОК.
          */}
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
                id="light-lines-length-range"
                label="Длина световых линий"
                value={lightLinesLength}
                min={calculator.lightLineMeters.min}
                max={calculator.lightLineMeters.max}
                step={calculator.lightLineMeters.step}
                unit="м.п."
                onChange={handleLightLinesLengthChange}
              />
            </div>
          ) : null}
        </CollapsibleSection>

        {/* ── Cornices — 4 варианта → grid-cols-2, нет хвоста ── */}
        <CollapsibleSection
          id="cornices"
          title="Карнизы"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.cornices}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          {/*
            4 варианта → grid-cols-2 = 2+2. Без изменений — уже ОК.
            items-stretch добавляем чтобы карточки выравнивались по высоте.
          */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-stretch">
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
                id="cornice-length-range"
                label="Длина карниза"
                value={corniceLength}
                min={calculator.corniceMeters.min}
                max={calculator.corniceMeters.max}
                step={calculator.corniceMeters.step}
                unit="м.п."
                onChange={handleCorniceLengthChange}
              />
            </div>
          ) : null}
        </CollapsibleSection>

        {/* ── Tracks — 3 варианта → grid-cols-3 в модалке ── */}
        <CollapsibleSection
          id="tracks"
          title="Трековое освещение"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.tracks}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          {/*
            ИЗМЕНЕНО:
            - Было: grid-cols-1 gap-3 sm:grid-cols-2
            - Стало: grid-cols-1 gap-3 sm:grid-cols-3
            Причина: 3 варианта (Без/Встроенный/Накладной) → 2+1 хвост.
            sm:grid-cols-3 убирает хвост, все 3 в строке ≥640px.
          */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                id="track-length-range"
                label="Длина трека"
                value={trackLength}
                min={calculator.trackMeters.min}
                max={calculator.trackMeters.max}
                step={calculator.trackMeters.step}
                unit="м.п."
                onChange={handleTrackLengthChange}
              />
              <p className="mt-3 text-xs text-slate-500">
                Ориентировочно: ~{calcRecommendedTrackSpots(trackLength, derivedTrackMountType)} спотов.
                Точный подбор — на следующем шаге.
              </p>
            </div>
          ) : null}
        </CollapsibleSection>

        {/* ── Lights — 2 варианта → grid-cols-2 ── */}
        <CollapsibleSection
          id="lights"
          title="Точечные светильники"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.lights}
          onToggle={toggleSection}
          lastToggledId={lastToggledSection}
        >
          {/*
            2 варианта → grid-cols-2. Без изменений — уже ОК.
          */}
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
              meta={`от ${formatCurrency(calculator.lights.ratePerUnit)} ₽ / шт.`}
              onClick={() => handleLightsEnabledChange(true)}
            />
          </div>
          {lightsEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="lights-count-range"
                label="Количество точечных светильников"
                value={lightsCount}
                min={calculator.lights.countMin}
                max={calculator.lights.countMax}
                step={calculator.lights.countStep}
                unit="шт."
                onChange={handleLightsCountChange}
              />
            </div>
          ) : null}
        </CollapsibleSection>

        {/* ── Breakdown ── */}
        <SectionCard title="Состав расчёта">
          <div className="space-y-3">
            <PriceRow
              label="Потолок"
              value={`${area} м² × ${formatCurrency(ceilingBaseRate)} ₽`}
            />
            {ceilingExtraTotal > 0 ? (
              <PriceRow
                label={selectedCeiling.extraLabel ?? "Профиль"}
                value={`${ceilingLength} м.п. × ${formatCurrency(selectedCeiling.extraRatePerMeter)} ₽`}
              />
            ) : null}
            {lightLinesTotal > 0 ? (
              <PriceRow
                label={calculator.lightLines.label}
                value={`${lightLinesLength} м.п. × ${formatCurrency(calculator.lightLines.ratePerMeter)} ₽`}
              />
            ) : null}
            {corniceTotal > 0 ? (
              <PriceRow
                label={selectedCornice.label}
                value={`${corniceLength} м.п. × ${formatCurrency(selectedCornice.ratePerMeter)} ₽`}
              />
            ) : null}
            {trackTotal > 0 ? (
              <PriceRow
                label={selectedTrack.label}
                value={`${trackLength} м.п. × ${formatCurrency(selectedTrack.ratePerMeter)} ₽`}
              />
            ) : null}
            {lightsTotal > 0 ? (
              <PriceRow
                label="Точечные светильники"
                value={`${lightsCount} шт. × ${formatCurrency(calculator.lights.ratePerUnit)} ₽`}
              />
            ) : null}
            <div className="border-t border-slate-200 pt-3">
              <PriceRow
                label="Цена полотна за 1 м²"
                value={`${formatCurrency(ceilingBaseRate)} ₽ / м²`}
                strong
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Desktop sidebar ── */}
      <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
          <p className="text-sm text-white/60">Ориентировочная стоимость от</p>
          <div className="mt-4 flex items-end gap-2">
            <p className="text-5xl font-bold tracking-tight">{formatCurrency(total)}</p>
            <span className="pb-2 text-lg font-medium text-white/70">₽</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <SummaryPill>{selectedCeiling.label}</SummaryPill>
            {lightLinesTotal > 0 ? <SummaryPill>{calculator.lightLines.label}</SummaryPill> : null}
            {selectedCornice.ratePerMeter > 0 ? <SummaryPill>{selectedCornice.label}</SummaryPill> : null}
            {selectedTrack.ratePerMeter > 0 ? <SummaryPill>{selectedTrack.label}</SummaryPill> : null}
            {lightsEnabled ? <SummaryPill>Светильники {lightsCount} шт.</SummaryPill> : null}
          </div>

          <div className="mt-8 space-y-3 text-sm text-white/75">
            <div className="flex items-center justify-between gap-4">
              <span>Потолок</span>
              <span>{formatCurrency(ceilingBaseTotal)} ₽</span>
            </div>
            {ceilingExtraTotal > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span>{selectedCeiling.extraLabel}</span>
                <span>{formatCurrency(ceilingExtraTotal)} ₽</span>
              </div>
            ) : null}
            {lightLinesTotal > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span>{calculator.lightLines.label}</span>
                <span>{formatCurrency(lightLinesTotal)} ₽</span>
              </div>
            ) : null}
            {corniceTotal > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span>{selectedCornice.label}</span>
                <span>{formatCurrency(corniceTotal)} ₽</span>
              </div>
            ) : null}
            {trackTotal > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span>{selectedTrack.label}</span>
                <span>{formatCurrency(trackTotal)} ₽</span>
              </div>
            ) : null}
            {lightsTotal > 0 ? (
              <div className="flex items-center justify-between gap-4">
                <span>Светильники</span>
                <span>{formatCurrency(lightsTotal)} ₽</span>
              </div>
            ) : null}
            <div className="border-t border-white/10 pt-3 text-base font-semibold text-white">
              <div className="flex items-center justify-between gap-4">
                <span>Итого</span>
                <span>{formatCurrency(total)} ₽</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button
              href="#action"
              variant="secondary"
              className="w-full justify-center py-6 text-base"
            >
              {homepage.price.primaryCtaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
