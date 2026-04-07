"use client";

import { ReactNode, useMemo, useState } from "react";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";

const BASE_RATE_PER_SQM = 1000;
const SPECIAL_CEILING_DELTA_PER_SQM = 800; // +800 ₽/м² для теневого/парящего

const AREA_MIN = 5;
const AREA_MAX = 250;
const AREA_STEP = 1;
const AREA_DEFAULT = 20;

const LENGTH_MIN = 1;
const LENGTH_MAX = 100;
const LENGTH_STEP = 1;
const LENGTH_DEFAULT = 10;

const LIGHTS_MIN = 1;
const LIGHTS_MAX = 50;
const LIGHTS_STEP = 1;
const LIGHTS_DEFAULT = 6;

const CEILING_TYPES = [
  {
    slug: "standard",
    label: "Обычный",
    profileLabel: "",
    profileRatePerMeter: 0,
  },
  {
    slug: "shadow",
    label: "Теневой",
    profileLabel: "Длина теневого профиля",
    profileRatePerMeter: 800,
  },
  {
    slug: "floating",
    label: "Парящий",
    profileLabel: "Длина парящего профиля",
    profileRatePerMeter: 2500,
  },
] as const;

const CORNICE_TYPES = [
  {
    slug: "none",
    label: "Без карниза",
    ratePerMeter: 0,
  },
  {
    slug: "built-in",
    label: "Встроенный",
    ratePerMeter: 4500,
  },
  {
    slug: "hidden-niche",
    label: "Скрытая ниша",
    ratePerMeter: 1800,
  },
  {
    slug: "surface",
    label: "Накладной",
    ratePerMeter: 1000,
  },
] as const;

const TRACK_TYPES = [
  {
    slug: "none",
    label: "Без трека",
    ratePerMeter: 0,
  },
  {
    slug: "built-in",
    label: "Встроенный",
    ratePerMeter: 2500,
  },
  {
    slug: "surface",
    label: "Накладной",
    ratePerMeter: 1500,
  },
] as const;

const LIGHT_RATE = 750;

type CeilingType = (typeof CEILING_TYPES)[number]["slug"];
type CorniceType = (typeof CORNICE_TYPES)[number]["slug"];
type TrackType = (typeof TRACK_TYPES)[number]["slug"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-950 hover:border-slate-950"
      }`}
    >
      {children}
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
        <label htmlFor={id} className="text-sm font-semibold text-slate-950">
          {label}
        </label>
        <span className="font-mono text-sm font-semibold text-slate-950">
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

export function PriceCalculatorClient() {
  const [area, setArea] = useState<number>(AREA_DEFAULT);

  const [ceilingType, setCeilingType] = useState<CeilingType>("standard");
  const [ceilingLength, setCeilingLength] = useState<number>(LENGTH_DEFAULT);

  const [corniceType, setCorniceType] = useState<CorniceType>("none");
  const [corniceLength, setCorniceLength] = useState<number>(LENGTH_DEFAULT);

  const [trackType, setTrackType] = useState<TrackType>("none");
  const [trackLength, setTrackLength] = useState<number>(LENGTH_DEFAULT);

  const [lightsEnabled, setLightsEnabled] = useState<boolean>(false);
  const [lightsCount, setLightsCount] = useState<number>(LIGHTS_DEFAULT);

  const selectedCeiling = useMemo(
    () => CEILING_TYPES.find((item) => item.slug === ceilingType) ?? CEILING_TYPES[0],
    [ceilingType]
  );

  const selectedCornice = useMemo(
    () => CORNICE_TYPES.find((item) => item.slug === corniceType) ?? CORNICE_TYPES[0],
    [corniceType]
  );

  const selectedTrack = useMemo(
    () => TRACK_TYPES.find((item) => item.slug === trackType) ?? TRACK_TYPES[0],
    [trackType]
  );

  const calculation = useMemo(() => {
    const hasSpecialCeiling = ceilingType === "shadow" || ceilingType === "floating";

    const baseCeilingTotal = area * BASE_RATE_PER_SQM;
    const specialCeilingDeltaTotal = hasSpecialCeiling
      ? area * SPECIAL_CEILING_DELTA_PER_SQM
      : 0;

    const ceilingProfileTotal = hasSpecialCeiling
      ? ceilingLength * selectedCeiling.profileRatePerMeter
      : 0;

    const corniceTotal =
      corniceType !== "none" ? corniceLength * selectedCornice.ratePerMeter : 0;

    const trackTotal =
      trackType !== "none" ? trackLength * selectedTrack.ratePerMeter : 0;

    const lightsTotal = lightsEnabled ? lightsCount * LIGHT_RATE : 0;

    const total =
      baseCeilingTotal +
      specialCeilingDeltaTotal +
      ceilingProfileTotal +
      corniceTotal +
      trackTotal +
      lightsTotal;

    const areaRate =
      BASE_RATE_PER_SQM + (hasSpecialCeiling ? SPECIAL_CEILING_DELTA_PER_SQM : 0);

    return {
      hasSpecialCeiling,
      areaRate,
      baseCeilingTotal,
      specialCeilingDeltaTotal,
      ceilingProfileTotal,
      corniceTotal,
      trackTotal,
      lightsTotal,
      total,
    };
  }, [
    area,
    ceilingType,
    ceilingLength,
    selectedCeiling,
    corniceType,
    corniceLength,
    selectedCornice,
    trackType,
    trackLength,
    selectedTrack,
    lightsEnabled,
    lightsCount,
  ]);

  return (
    <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:p-10">
      <div className="space-y-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Базовая цена потолка — от {formatCurrency(BASE_RATE_PER_SQM)} ₽ / м²
          </p>
        </div>

        <RangeField
          id="area-range"
          label="Площадь помещения"
          value={area}
          min={AREA_MIN}
          max={AREA_MAX}
          step={AREA_STEP}
          unit="м²"
          onChange={setArea}
        />

        <section>
          <p className="text-sm font-semibold text-slate-950">Тип потолка</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {CEILING_TYPES.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={ceilingType === option.slug}
                onClick={() => setCeilingType(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {calculation.hasSpecialCeiling && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="mb-4 text-sm leading-6 text-slate-600">
                При выборе <span className="font-semibold">{selectedCeiling.label.toLowerCase()}</span>{" "}
                потолка к базовой цене добавляется{" "}
                <span className="font-semibold">
                  +{formatCurrency(SPECIAL_CEILING_DELTA_PER_SQM)} ₽ / м²
                </span>
                , а профиль считается отдельно в погонных метрах.
              </p>

              <RangeField
                id="ceiling-length-range"
                label={selectedCeiling.profileLabel}
                value={ceilingLength}
                min={LENGTH_MIN}
                max={LENGTH_MAX}
                step={LENGTH_STEP}
                unit="м.п."
                onChange={setCeilingLength}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">Карниз</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {CORNICE_TYPES.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={corniceType === option.slug}
                onClick={() => setCorniceType(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {corniceType !== "none" && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <RangeField
                id="cornice-length-range"
                label="Длина карниза"
                value={corniceLength}
                min={LENGTH_MIN}
                max={LENGTH_MAX}
                step={LENGTH_STEP}
                unit="м.п."
                onChange={setCorniceLength}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">Трековое освещение</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {TRACK_TYPES.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={trackType === option.slug}
                onClick={() => setTrackType(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {trackType !== "none" && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <RangeField
                id="track-length-range"
                label="Длина трека"
                value={trackLength}
                min={LENGTH_MIN}
                max={LENGTH_MAX}
                step={LENGTH_STEP}
                unit="м.п."
                onChange={setTrackLength}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">Светильники</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <ChoiceButton
              active={lightsEnabled}
              onClick={() => setLightsEnabled((prev) => !prev)}
            >
              {lightsEnabled ? "Светильники добавлены" : "Добавить светильники"}
            </ChoiceButton>
          </div>

          {lightsEnabled && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <RangeField
                id="lights-count-range"
                label="Количество светильников"
                value={lightsCount}
                min={LIGHTS_MIN}
                max={LIGHTS_MAX}
                step={LIGHTS_STEP}
                unit="шт."
                onChange={setLightsCount}
              />
            </div>
          )}
        </section>

        <div className="space-y-2 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
            <span>Базовый потолок</span>
            <span>
              {area} м² × {formatCurrency(BASE_RATE_PER_SQM)} ₽
            </span>
          </div>

          {calculation.hasSpecialCeiling && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>Надбавка за теневой / парящий</span>
              <span>
                {area} м² × {formatCurrency(SPECIAL_CEILING_DELTA_PER_SQM)} ₽
              </span>
            </div>
          )}

          {calculation.ceilingProfileTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>{selectedCeiling.label} профиль</span>
              <span>
                {ceilingLength} м.п. × {formatCurrency(selectedCeiling.profileRatePerMeter)} ₽
              </span>
            </div>
          )}

          {calculation.corniceTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>Карниз: {selectedCornice.label.toLowerCase()}</span>
              <span>
                {corniceLength} м.п. × {formatCurrency(selectedCornice.ratePerMeter)} ₽
              </span>
            </div>
          )}

          {calculation.trackTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>Трек: {selectedTrack.label.toLowerCase()}</span>
              <span>
                {trackLength} м.п. × {formatCurrency(selectedTrack.ratePerMeter)} ₽
              </span>
            </div>
          )}

          {calculation.lightsTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>Светильники</span>
              <span>
                {lightsCount} шт. × {formatCurrency(LIGHT_RATE)} ₽
              </span>
            </div>
          )}

          <div className="mt-2 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-950">
            <div className="flex items-center justify-between gap-4">
              <span>Цена потолка за 1 м²</span>
              <span>{formatCurrency(calculation.areaRate)} ₽ / м²</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-[1.75rem] bg-slate-950 p-6 text-white sm:p-8">
        <div>
          <p className="text-sm text-white/65">Ориентировочная стоимость</p>

          <div className="mt-4 flex items-end gap-2">
            <p className="text-5xl font-bold tracking-tight sm:text-6xl">
              {formatCurrency(calculation.total)}
            </p>
            <span className="pb-2 text-lg font-medium text-white/70">₽</span>
          </div>

          <p className="mt-3 text-sm leading-6 text-white/70">
            При площади {area} м² и выбранных параметрах.
          </p>

          <div className="mt-8 space-y-3 text-sm leading-6 text-white/70">
            <div className="flex items-center justify-between gap-4">
              <span>Потолок</span>
              <span>
                {formatCurrency(
                  calculation.baseCeilingTotal + calculation.specialCeilingDeltaTotal
                )}{" "}
                ₽
              </span>
            </div>

            {calculation.ceilingProfileTotal > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span>{selectedCeiling.label} профиль</span>
                <span>{formatCurrency(calculation.ceilingProfileTotal)} ₽</span>
              </div>
            )}

            {calculation.corniceTotal > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span>Карниз</span>
                <span>{formatCurrency(calculation.corniceTotal)} ₽</span>
              </div>
            )}

            {calculation.trackTotal > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span>Трек</span>
                <span>{formatCurrency(calculation.trackTotal)} ₽</span>
              </div>
            )}

            {calculation.lightsTotal > 0 && (
              <div className="flex items-center justify-between gap-4">
                <span>Светильники</span>
                <span>{formatCurrency(calculation.lightsTotal)} ₽</span>
              </div>
            )}

            <div className="border-t border-white/10 pt-3 font-semibold text-white">
              <div className="flex items-center justify-between gap-4">
                <span>Итого</span>
                <span>{formatCurrency(calculation.total)} ₽</span>
              </div>
            </div>

            <p>{homepage.price.includedLine}</p>
            <p>{homepage.price.fixedPriceNote}</p>
          </div>
        </div>

        <div className="mt-10">
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
  );
}
