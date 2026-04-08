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

const calculator = homepage.price.calculator;
const extendedCalculator = calculator as typeof calculator & {
  lightLineMeters?: {
    min: number;
    max: number;
    step: number;
    default: number;
  };
  lightLines?: {
    label: string;
    ratePerMeter: number;
  };
};

const lightLineMeters = extendedCalculator.lightLineMeters ?? {
  min: 1,
  max: 50,
  step: 1,
  default: 2,
};

const lightLinesConfig = extendedCalculator.lightLines ?? {
  label: "Световые линии",
  ratePerMeter: 3500,
};

type CeilingType = (typeof calculator.ceilingTypes)[number]["slug"];
type CorniceType = (typeof calculator.cornices)[number]["slug"];
type TrackType = (typeof calculator.tracks)[number]["slug"];

type PerimeterSuggestion = {
  min: number;
  max: number;
  recommended: number;
};

type AccordionSectionId =
  | "ceiling-profile"
  | "light-lines"
  | "cornices"
  | "tracks"
  | "lights";

type PriceCalculatorClientProps = {
  preset?: ServiceCalculatorPreset;
  compactSections?: boolean;
};

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

  return {
    min,
    max: normalizedMax,
    recommended,
  };
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
  children,
}: {
  id: AccordionSectionId;
  title: string;
  description?: string;
  isDesktopAccordion: boolean;
  isOpen: boolean;
  onToggle: (id: AccordionSectionId) => void;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(isOpen);

  useEffect(() => {
    if (
      !isDesktopAccordion ||
      !isOpen ||
      wasOpenRef.current ||
      !contentRef.current
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
  }, [isDesktopAccordion, isOpen]);

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
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
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
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p
            className={`mt-1 text-xs leading-5 ${
              active ? "text-white/75" : "text-slate-500"
            }`}
          >
            {meta}
          </p>
        </div>

        <span
          className={`mt-0.5 h-4 w-4 rounded-full border ${
            active ? "border-white bg-white" : "border-slate-300 bg-transparent"
          }`}
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
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>

        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200">
          {value} {unit}
        </span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-950"
      />

      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
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

export function PriceCalculatorClient({
  preset,
  compactSections = false,
}: PriceCalculatorClientProps) {
  const pathname = usePathname();
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const [isDesktopAccordion, setIsDesktopAccordion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      setIsDesktopAccordion(mediaQuery.matches && compactSections);
    };

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, [compactSections]);

  const resolvedAreaDefault = preset?.areaDefault ?? calculator.areaDefault;
  const resolvedCeilingType = preset?.ceilingType ?? "standard";
  const resolvedCorniceType = preset?.corniceType ?? "none";
  const resolvedTrackType = preset?.trackType ?? "none";
  const resolvedLightsEnabled = preset?.lightsEnabled ?? false;
  const resolvedLightsCount =
    preset?.lightsCount ?? calculator.lights.countDefault;

  const [area, setArea] = useState<number>(resolvedAreaDefault);

  const [ceilingType, setCeilingType] =
    useState<CeilingType>(resolvedCeilingType);
  const [ceilingLength, setCeilingLength] = useState<number>(() =>
    getPerimeterSuggestion(resolvedAreaDefault).recommended
  );

  const [lightLinesEnabled, setLightLinesEnabled] = useState(false);
  const [lightLinesLength, setLightLinesLength] = useState(
    lightLineMeters.default
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

  const [lightsEnabled, setLightsEnabled] =
    useState<boolean>(resolvedLightsEnabled);
  const [lightsCount, setLightsCount] = useState<number>(resolvedLightsCount);

  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

  const selectedCeiling = useMemo(
    () =>
      calculator.ceilingTypes.find((item) => item.slug === ceilingType) ??
      calculator.ceilingTypes[0],
    [ceilingType]
  );

  const selectedCornice = useMemo(
    () =>
      calculator.cornices.find((item) => item.slug === corniceType) ??
      calculator.cornices[0],
    [corniceType]
  );

  const selectedTrack = useMemo(
    () =>
      calculator.tracks.find((item) => item.slug === trackType) ??
      calculator.tracks[0],
    [trackType]
  );

  const hasSpecialCeiling = selectedCeiling.extraRatePerMeter > 0;
  const defaultOpenSection = getDefaultOpenSection(pathname);

  const [openSections, setOpenSections] = useState<
    Record<AccordionSectionId, boolean>
  >({
    "ceiling-profile": false,
    "light-lines": false,
    cornices: false,
    tracks: false,
    lights: false,
  });

  useEffect(() => {
    if (!isDesktopAccordion) {
      return;
    }

    setOpenSections({
      "ceiling-profile":
        defaultOpenSection === "ceiling-profile" && hasSpecialCeiling,
      "light-lines": defaultOpenSection === "light-lines",
      cornices: defaultOpenSection === "cornices",
      tracks: defaultOpenSection === "tracks",
      lights: defaultOpenSection === "lights",
    });
  }, [defaultOpenSection, hasSpecialCeiling, isDesktopAccordion]);

  const toggleSection = (id: AccordionSectionId) => {
    setOpenSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const ceilingBaseRate = selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = area * ceilingBaseRate;

  const ceilingExtraTotal = hasSpecialCeiling
    ? ceilingLength * selectedCeiling.extraRatePerMeter
    : 0;

  const lightLinesTotal = lightLinesEnabled
    ? lightLinesLength * lightLinesConfig.ratePerMeter
    : 0;

  const corniceTotal =
    selectedCornice.ratePerMeter > 0
      ? corniceLength * selectedCornice.ratePerMeter
      : 0;

  const trackTotal =
    selectedTrack.ratePerMeter > 0
      ? trackLength * selectedTrack.ratePerMeter
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
    lightsTotal;

  const snapshot = useMemo<CalculatorLeadSnapshot>(
    () => ({
      area,
      ceilingTypeLabel: selectedCeiling.label,
      ceilingBaseRate,
      ceilingBaseTotal,

      ceilingExtraLabel: hasSpecialCeiling
        ? selectedCeiling.extraLabel ?? null
        : null,
      ceilingLength: hasSpecialCeiling ? ceilingLength : null,
      ceilingExtraRatePerMeter: hasSpecialCeiling
        ? selectedCeiling.extraRatePerMeter
        : null,
      ceilingExtraTotal,

      lightLinesEnabled,
      lightLinesLabel: lightLinesEnabled ? lightLinesConfig.label : null,
      lightLinesLength: lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled
        ? lightLinesConfig.ratePerMeter
        : null,
      lightLinesTotal,

      corniceLabel:
        selectedCornice.ratePerMeter > 0 ? selectedCornice.label : null,
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
    ]
  );

  useEffect(() => {
    setSnapshot(snapshot);
  }, [setSnapshot, snapshot]);

  const markInteracted = () => {
    setHasInteracted(true);
  };

  const handleAreaChange = (value: number) => {
    markInteracted();
    setArea(value);
  };

  const handleCeilingTypeChange = (slug: CeilingType) => {
    markInteracted();
    setCeilingType(slug);

    if (slug !== "standard") {
      setCeilingLength(perimeterSuggestion.recommended);
    }
  };

  const handleLightLinesEnabledChange = (value: boolean) => {
    markInteracted();
    setLightLinesEnabled(value);
  };

  const handleLightLinesLengthChange = (value: number) => {
    markInteracted();
    setLightLinesLength(value);
  };

  const handleCorniceTypeChange = (slug: CorniceType) => {
    markInteracted();
    setCorniceType(slug);

    if (slug !== "none") {
      setCorniceLength(calculator.corniceMeters.default);
    }
  };

  const handleTrackTypeChange = (slug: TrackType) => {
    markInteracted();
    setTrackType(slug);

    if (slug !== "none") {
      setTrackLength(calculator.trackMeters.default);
    }
  };

  const handleCeilingLengthChange = (value: number) => {
    markInteracted();
    setCeilingLength(value);
  };

  const handleCorniceLengthChange = (value: number) => {
    markInteracted();
    setCorniceLength(value);
  };

  const handleTrackLengthChange = (value: number) => {
    markInteracted();
    setTrackLength(value);
  };

  const handleLightsEnabledChange = (value: boolean) => {
    markInteracted();
    setLightsEnabled(value);
  };

  const handleLightsCountChange = (value: number) => {
    markInteracted();
    setLightsCount(value);
  };

  const applyPerimeterSuggestion = () => {
    markInteracted();
    setCeilingLength(perimeterSuggestion.recommended);
  };

  return (
    <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8 lg:p-8">
      <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white">
          <p className="text-sm text-white/70">{calculator.baseDescription}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <SummaryPill>Фиксация цены после замера</SummaryPill>
            <SummaryPill>Личный монтаж</SummaryPill>
            <SummaryPill>Москва и МО</SummaryPill>
          </div>
        </div>

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

        <SectionCard
          title="Тип потолка"
          description="Для теневого и парящего потолка цена полотна считается по новой ставке за м², а профиль считается отдельно в погонных метрах."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {calculator.ceilingTypes.map((option) => {
              const meta =
                option.slug === "standard"
                  ? `от ${formatCurrency(option.baseRatePerSqm)} ₽ / м²`
                  : `${formatCurrency(option.baseRatePerSqm)} ₽ / м² + ${formatCurrency(
                      option.extraRatePerMeter
                    )} ₽ / м.п.`;

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
          <CollapsibleSection
            id="ceiling-profile"
            title="Длина профиля"
            description={selectedCeiling.extraLabel ?? "Профиль по периметру"}
            isDesktopAccordion={isDesktopAccordion}
            isOpen={openSections["ceiling-profile"]}
            onToggle={toggleSection}
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

        <CollapsibleSection
          id="light-lines"
          title="Световые линии"
          
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections["light-lines"]}
          onToggle={toggleSection}
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
              title="Добавить просчёт световых линий"
              meta={`от ${formatCurrency(lightLinesConfig.ratePerMeter)} ₽ / м.п.`}
              onClick={() => handleLightLinesEnabledChange(true)}
            />
          </div>

          {lightLinesEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="light-lines-length-range"
                label="Длина световых линий"
                value={lightLinesLength}
                min={lightLineMeters.min}
                max={lightLineMeters.max}
                step={lightLineMeters.step}
                unit="м.п."
                onChange={handleLightLinesLengthChange}
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
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {calculator.cornices.map((option) => {
              const meta =
                option.ratePerMeter > 0
                  ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                  : "Без дополнительного расчёта";

              return (
                <OptionCard
                  key={option.slug}
                  active={corniceType === option.slug}
                  title={option.label}
                  meta={meta}
                  onClick={() => handleCorniceTypeChange(option.slug)}
                />
              );
            })}
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

        <CollapsibleSection
          id="tracks"
          title="Трековое освещение"
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.tracks}
          onToggle={toggleSection}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {calculator.tracks.map((option) => {
              const meta =
                option.ratePerMeter > 0
                  ? `от ${formatCurrency(option.ratePerMeter)} ₽ / м.п.`
                  : "Без дополнительного расчёта";

              return (
                <OptionCard
                  key={option.slug}
                  active={trackType === option.slug}
                  title={option.label}
                  meta={meta}
                  onClick={() => handleTrackTypeChange(option.slug)}
                />
              );
            })}
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
            </div>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          id="lights"
          title={calculator.lights.label}
          isDesktopAccordion={isDesktopAccordion}
          isOpen={openSections.lights}
          onToggle={toggleSection}
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
              meta={`от ${formatCurrency(
                calculator.lights.ratePerUnit
              )} ₽ / шт.`}
              onClick={() => handleLightsEnabledChange(true)}
            />
          </div>

          {lightsEnabled ? (
            <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <RangeField
                id="lights-count-range"
                label="Количество светильников"
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

        <SectionCard title="Состав расчёта">
          <div className="space-y-3">
            <PriceRow
              label="Потолок"
              value={`${area} м² × ${formatCurrency(ceilingBaseRate)} ₽`}
            />

            {ceilingExtraTotal > 0 ? (
              <PriceRow
                label={selectedCeiling.extraLabel ?? "Профиль"}
                value={`${ceilingLength} м.п. × ${formatCurrency(
                  selectedCeiling.extraRatePerMeter
                )} ₽`}
              />
            ) : null}

            {lightLinesTotal > 0 ? (
              <PriceRow
                label={lightLinesConfig.label}
                value={`${lightLinesLength} м.п. × ${formatCurrency(
                  lightLinesConfig.ratePerMeter
                )} ₽`}
              />
            ) : null}

            {corniceTotal > 0 ? (
              <PriceRow
                label={selectedCornice.label}
                value={`${corniceLength} м.п. × ${formatCurrency(
                  selectedCornice.ratePerMeter
                )} ₽`}
              />
            ) : null}

            {trackTotal > 0 ? (
              <PriceRow
                label={selectedTrack.label}
                value={`${trackLength} м.п. × ${formatCurrency(
                  selectedTrack.ratePerMeter
                )} ₽`}
              />
            ) : null}

            {lightsTotal > 0 ? (
              <PriceRow
                label={calculator.lights.label}
                value={`${lightsCount} шт. × ${formatCurrency(
                  calculator.lights.ratePerUnit
                )} ₽`}
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

      <div className="hidden lg:block lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-2xl shadow-slate-950/10">
          <p className="text-sm text-white/60">Ориентировочная стоимость от</p>

          <div className="mt-4 flex items-end gap-2">
            <p className="text-5xl font-bold tracking-tight">
              {formatCurrency(total)}
            </p>
            <span className="pb-2 text-lg font-medium text-white/70">₽</span>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <SummaryPill>{selectedCeiling.label}</SummaryPill>

            {lightLinesTotal > 0 ? (
              <SummaryPill>{lightLinesConfig.label}</SummaryPill>
            ) : null}

            {selectedCornice.ratePerMeter > 0 ? (
              <SummaryPill>{selectedCornice.label}</SummaryPill>
            ) : null}

            {selectedTrack.ratePerMeter > 0 ? (
              <SummaryPill>{selectedTrack.label}</SummaryPill>
            ) : null}

            {lightsEnabled ? (
              <SummaryPill>{calculator.lights.label}</SummaryPill>
            ) : null}
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
                <span>{lightLinesConfig.label}</span>
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
                <span>{calculator.lights.label}</span>
                <span>{formatCurrency(lightsTotal)} ₽</span>
              </div>
            ) : null}

            <div className="border-t border-white/10 pt-3 text-base font-semibold text-white">
              <div className="flex items-center justify-between gap-4">
                <span>Итого</span>
                <span>{formatCurrency(total)} ₽</span>
              </div>
            </div>

            <p className="pt-2 text-sm leading-6 text-white/65">
              {homepage.price.includedLine}
            </p>
            <p className="text-sm leading-6 text-white/65">
              {homepage.price.fixedPriceNote}
            </p>
            <p className="text-sm leading-6 text-white/65">
              {homepage.price.noExtraChargeNote}
            </p>
          </div>

          <div className="mt-8">
            <Button
              href="#action"
              variant="secondary"
              className="w-full justify-center py-6 text-base"
            >
              Записаться на бесплатный замер
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
