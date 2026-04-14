"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ServiceCalculatorPreset,
  CalculatorCeilingType,
  CalculatorCorniceType,
  CalculatorTrackType,
} from "@/content/services";
import {
  usePriceCalculatorBridge,
  type CalculatorLeadSnapshot,
} from "./price-calculator-context";
import type { DerivedInputs } from "@/lib/calculator-modal-types";
import { calcRecommendedSpots } from "@/lib/lighting-formulas";

/* ─── Pricing config ─── */

const CEILING_RATES: Record<
  string,
  { ratePerSqM: number; label: string }
> = {
  standard: { ratePerSqM: 800, label: "Стандартный" },
  premium: { ratePerSqM: 1200, label: "Премиум" },
};

const TRACK_RATES: Record<
  string,
  { ratePerMeter: number; label: string }
> = {
  "built-in": { ratePerMeter: 3500, label: "Встроенный трек" },
  surface: { ratePerMeter: 2800, label: "Накладной трек" },
};

const CORNICE_RATES: Record<
  string,
  { ratePerMeter: number; label: string }
> = {
  standard: { ratePerMeter: 600, label: "Стандартный карниз" },
  hidden: { ratePerMeter: 900, label: "Скрытый карниз" },
};

const LIGHT_LINE_RATE = { ratePerMeter: 2500, label: "Световая линия" };
const LIGHTS_RATE_PER_UNIT = 800;

/* ─── Inline primitives ─── */

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-950">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-950"
      />
      <div className="flex justify-between text-xs text-slate-400 mt-1">
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

function OptionCard({
  label,
  active,
  onClick,
  description,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left rounded-2xl border p-3 transition-all min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
      }`}
    >
      <p className="text-sm font-medium">{label}</p>
      {description ? (
        <p
          className={`text-xs mt-0.5 ${
            active ? "text-white/70" : "text-slate-500"
          }`}
        >
          {description}
        </p>
      ) : null}
    </button>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <p className="text-sm font-semibold text-slate-950 mb-3">{title}</p>
      {children}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        type="button"
        onClick={onChange}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-slate-950" : "bg-slate-300"
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  );
}

/* ─── Main component ─── */

type PriceCalculatorClientProps = {
  preset?: ServiceCalculatorPreset;
  compactSections?: boolean;
};

export function PriceCalculatorClient({
  preset,
}: PriceCalculatorClientProps) {
  const { setSnapshot, setHasInteracted } = usePriceCalculatorBridge();

  const [area, setArea] = useState(preset?.areaDefault ?? 20);
  const [ceilingType, setCeilingType] = useState<CalculatorCeilingType>(
    preset?.ceilingType ?? "standard"
  );
  const [trackType, setTrackType] = useState<CalculatorTrackType>(
    preset?.trackType ?? "none"
  );
  const [trackLength, setTrackLength] = useState(3);
  const [corniceType, setCorniceType] = useState<CalculatorCorniceType>(
    preset?.corniceType ?? "none"
  );
  const [corniceLength, setCorniceLength] = useState(3);
  const [lightLinesEnabled, setLightLinesEnabled] = useState(false);
  const [lightLinesLength, setLightLinesLength] = useState(3);
  const [lightsEnabled, setLightsEnabled] = useState(
    preset?.lightsEnabled ?? false
  );
  const [lightsCount, setLightsCount] = useState(preset?.lightsCount ?? 6);

  const markInteracted = () => setHasInteracted(true);

  const computedSnapshot = useMemo<CalculatorLeadSnapshot>(() => {
    const ceilingConfig =
      CEILING_RATES[ceilingType] ?? CEILING_RATES.standard;
    const ceilingBaseTotal = area * ceilingConfig.ratePerSqM;

    const trackConfig =
      trackType !== "none" ? TRACK_RATES[trackType] : null;
    const trackTotal = trackConfig
      ? trackLength * trackConfig.ratePerMeter
      : 0;

    const corniceConfig =
      corniceType !== "none" ? CORNICE_RATES[corniceType] : null;
    const corniceTotal = corniceConfig
      ? corniceLength * corniceConfig.ratePerMeter
      : 0;

    const lightLinesTotal = lightLinesEnabled
      ? lightLinesLength * LIGHT_LINE_RATE.ratePerMeter
      : 0;

    const lightsTotal = lightsEnabled
      ? lightsCount * LIGHTS_RATE_PER_UNIT
      : 0;

    const derivedInputs: DerivedInputs = {
      pointSpotsQty: lightsEnabled ? lightsCount : 0,
      trackMountType: trackType,
      trackLengthMeters: trackType !== "none" ? trackLength : 0,
      recommendedSpotsQty: calcRecommendedSpots(trackLength, trackType),
    };

    const total =
      ceilingBaseTotal +
      trackTotal +
      corniceTotal +
      lightLinesTotal +
      lightsTotal;

    return {
      area,
      ceilingTypeLabel: ceilingConfig.label,
      ceilingBaseRate: ceilingConfig.ratePerSqM,
      ceilingBaseTotal,

      ceilingExtraLabel: null,
      ceilingLength: null,
      ceilingExtraRatePerMeter: null,
      ceilingExtraTotal: 0,

      lightLinesEnabled,
      lightLinesLabel: lightLinesEnabled ? LIGHT_LINE_RATE.label : null,
      lightLinesLength: lightLinesEnabled ? lightLinesLength : null,
      lightLinesRatePerMeter: lightLinesEnabled
        ? LIGHT_LINE_RATE.ratePerMeter
        : null,
      lightLinesTotal,

      corniceLabel: corniceConfig ? corniceConfig.label : null,
      corniceLength: corniceConfig ? corniceLength : null,
      corniceRatePerMeter: corniceConfig ? corniceConfig.ratePerMeter : null,
      corniceTotal,

      trackLabel: trackConfig ? trackConfig.label : null,
      trackLength: trackConfig ? trackLength : null,
      trackRatePerMeter: trackConfig ? trackConfig.ratePerMeter : null,
      trackTotal,

      lightsEnabled,
      lightsCount: lightsEnabled ? lightsCount : null,
      lightsRatePerUnit: LIGHTS_RATE_PER_UNIT,
      lightsTotal,

      total,
      derivedInputs,
    };
  }, [
    area,
    ceilingType,
    trackType,
    trackLength,
    corniceType,
    corniceLength,
    lightLinesEnabled,
    lightLinesLength,
    lightsEnabled,
    lightsCount,
  ]);

  useEffect(() => {
    setSnapshot(computedSnapshot);
  }, [computedSnapshot, setSnapshot]);

  return (
    <div>
      <SectionBlock title="Площадь помещения">
        <RangeField
          label="Площадь"
          value={area}
          onChange={(v) => {
            setArea(v);
            markInteracted();
          }}
          min={6}
          max={80}
          step={1}
          unit="м²"
        />
      </SectionBlock>

      <SectionBlock title="Тип потолка">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(CEILING_RATES).map(([key, config]) => (
            <OptionCard
              key={key}
              label={config.label}
              description={`${config.ratePerSqM} ₽/м²`}
              active={ceilingType === key}
              onClick={() => {
                setCeilingType(key as CalculatorCeilingType);
                markInteracted();
              }}
            />
          ))}
        </div>
      </SectionBlock>

      <SectionBlock title="Трековое освещение">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <OptionCard
            label="Без трека"
            active={trackType === "none"}
            onClick={() => {
              setTrackType("none");
              markInteracted();
            }}
          />
          {Object.entries(TRACK_RATES).map(([key, config]) => (
            <OptionCard
              key={key}
              label={
                key === "built-in" ? "Встроенный" : "Накладной"
              }
              description={`${config.ratePerMeter} ₽/м.п.`}
              active={trackType === key}
              onClick={() => {
                setTrackType(key as CalculatorTrackType);
                markInteracted();
              }}
            />
          ))}
        </div>

        {trackType !== "none" ? (
          <RangeField
            label="Длина трека"
            value={trackLength}
            onChange={(v) => {
              setTrackLength(v);
              markInteracted();
            }}
            min={1}
            max={20}
            step={0.5}
            unit="м.п."
          />
        ) : null}
      </SectionBlock>

      <SectionBlock title="Карнизы">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <OptionCard
            label="Без карниза"
            active={corniceType === "none"}
            onClick={() => {
              setCorniceType("none");
              markInteracted();
            }}
          />
          {Object.entries(CORNICE_RATES).map(([key, config]) => (
            <OptionCard
              key={key}
              label={config.label}
              description={`${config.ratePerMeter} ₽/м.п.`}
              active={corniceType === key}
              onClick={() => {
                setCorniceType(key as CalculatorCorniceType);
                markInteracted();
              }}
            />
          ))}
        </div>

        {corniceType !== "none" ? (
          <RangeField
            label="Длина карниза"
            value={corniceLength}
            onChange={(v) => {
              setCorniceLength(v);
              markInteracted();
            }}
            min={1}
            max={20}
            step={0.5}
            unit="м.п."
          />
        ) : null}
      </SectionBlock>

      <SectionBlock title="Световые линии">
        <ToggleSwitch
          checked={lightLinesEnabled}
          onChange={() => {
            setLightLinesEnabled(!lightLinesEnabled);
            markInteracted();
          }}
          label="Добавить световые линии"
        />
        {lightLinesEnabled ? (
          <RangeField
            label="Длина световых линий"
            value={lightLinesLength}
            onChange={(v) => {
              setLightLinesLength(v);
              markInteracted();
            }}
            min={1}
            max={20}
            step={0.5}
            unit="м.п."
          />
        ) : null}
      </SectionBlock>

      <SectionBlock title="Точечные светильники">
        <ToggleSwitch
          checked={lightsEnabled}
          onChange={() => {
            setLightsEnabled(!lightsEnabled);
            markInteracted();
          }}
          label="Добавить точечные светильники"
        />
        {lightsEnabled ? (
          <RangeField
            label="Количество точечных светильников"
            value={lightsCount}
            onChange={(v) => {
              setLightsCount(v);
              markInteracted();
            }}
            min={1}
            max={30}
            step={1}
            unit="шт."
          />
        ) : null}
      </SectionBlock>
    </div>
  );
}
