"use client";

import { ReactNode, useMemo, useState } from "react";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";

const calculator = homepage.price.calculator;

type CeilingType = (typeof calculator.ceilingTypes)[number]["slug"];
type CorniceType = (typeof calculator.cornices)[number]["slug"];
type TrackType = (typeof calculator.tracks)[number]["slug"];

type PerimeterSuggestion = {
  min: number;
  max: number;
  recommended: number;
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

export function PriceCalculatorClient() {
  const initialPerimeterSuggestion = useMemo(
    () => getPerimeterSuggestion(calculator.areaDefault),
    []
  );

  const [area, setArea] = useState<number>(calculator.areaDefault);

  const [ceilingType, setCeilingType] = useState<CeilingType>("standard");
  const [ceilingLength, setCeilingLength] = useState<number>(
    initialPerimeterSuggestion.recommended
  );

  const [corniceType, setCorniceType] = useState<CorniceType>("none");
  const [corniceLength, setCorniceLength] = useState<number>(
    calculator.corniceMeters.default
  );

  const [trackType, setTrackType] = useState<TrackType>("none");
  const [trackLength, setTrackLength] = useState<number>(
    calculator.trackMeters.default
  );

  const [lightsEnabled, setLightsEnabled] = useState<boolean>(false);
  const [lightsCount, setLightsCount] = useState<number>(
    calculator.lights.countDefault
  );

  const perimeterSuggestion = useMemo(() => getPerimeterSuggestion(area), [area]);

  const selectedCeiling =
    calculator.ceilingTypes.find((item) => item.slug === ceilingType) ??
    calculator.ceilingTypes[0];

  const selectedCornice =
    calculator.cornices.find((item) => item.slug === corniceType) ??
    calculator.cornices[0];

  const selectedTrack =
    calculator.tracks.find((item) => item.slug === trackType) ??
    calculator.tracks[0];

  const hasSpecialCeiling = selectedCeiling.extraRatePerMeter > 0;

  const ceilingBaseRate = selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = area * ceilingBaseRate;

  const ceilingExtraTotal = hasSpecialCeiling
    ? ceilingLength * selectedCeiling.extraRatePerMeter
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
    corniceTotal +
    trackTotal +
    lightsTotal;

  const handleCeilingTypeChange = (slug: CeilingType) => {
    setCeilingType(slug);

    if (slug !== "standard") {
      setCeilingLength(perimeterSuggestion.recommended);
    }
  };

  const handleCorniceTypeChange = (slug: CorniceType) => {
    setCorniceType(slug);

    if (slug !== "none") {
      setCorniceLength(calculator.corniceMeters.default);
    }
  };

  const handleTrackTypeChange = (slug: TrackType) => {
    setTrackType(slug);

    if (slug !== "none") {
      setTrackLength(calculator.trackMeters.default);
    }
  };

  return (
    <div className="grid gap-8 rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start xl:gap-10">
      <div className="min-w-0 space-y-8">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {calculator.baseDescription}
          </p>
        </div>

        <RangeField
          id="area-range"
          label="Площадь помещения"
          value={area}
          min={calculator.areaMin}
          max={calculator.areaMax}
          step={calculator.areaStep}
          unit="м²"
          onChange={setArea}
        />

        <section>
          <p className="text-sm font-semibold text-slate-950">Тип потолка</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {calculator.ceilingTypes.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={ceilingType === option.slug}
                onClick={() => handleCeilingTypeChange(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {hasSpecialCeiling && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="mb-4 text-sm leading-6 text-slate-600">
                Для выбранного типа потолка цена полотна считается от{" "}
                <span className="font-semibold text-slate-950">
                  {formatCurrency(selectedCeiling.baseRatePerSqm)} ₽ / м²
                </span>
                , а{" "}
                <span className="font-semibold text-slate-950">
                  {selectedCeiling.extraLabel ?? "профиль"}
                </span>{" "}
                считается отдельно в погонных метрах.
              </p>

              <RangeField
                id="ceiling-length-range"
                label="Длина профиля"
                value={ceilingLength}
                min={calculator.specialMeters.min}
                max={calculator.specialMeters.max}
                step={calculator.specialMeters.step}
                unit="м.п."
                onChange={setCeilingLength}
              />

              <PerimeterHint
                area={area}
                suggestion={perimeterSuggestion}
                onApply={() => setCeilingLength(perimeterSuggestion.recommended)}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">Карнизы</p>

          <div className="mt-4 flex flex-wrap gap-3">
            {calculator.cornices.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={corniceType === option.slug}
                onClick={() => handleCorniceTypeChange(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {selectedCornice.ratePerMeter > 0 && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <RangeField
                id="cornice-length-range"
                label="Длина карниза"
                value={corniceLength}
                min={calculator.corniceMeters.min}
                max={calculator.corniceMeters.max}
                step={calculator.corniceMeters.step}
                unit="м.п."
                onChange={setCorniceLength}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">
            Трековое освещение
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            {calculator.tracks.map((option) => (
              <ChoiceButton
                key={option.slug}
                active={trackType === option.slug}
                onClick={() => handleTrackTypeChange(option.slug)}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>

          {selectedTrack.ratePerMeter > 0 && (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <RangeField
                id="track-length-range"
                label="Длина трека"
                value={trackLength}
                min={calculator.trackMeters.min}
                max={calculator.trackMeters.max}
                step={calculator.trackMeters.step}
                unit="м.п."
                onChange={setTrackLength}
              />
            </div>
          )}
        </section>

        <section>
          <p className="text-sm font-semibold text-slate-950">
            {calculator.lights.label}
          </p>

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
                min={calculator.lights.countMin}
                max={calculator.lights.countMax}
                step={calculator.lights.countStep}
                unit="шт."
                onChange={setLightsCount}
              />
            </div>
          )}
        </section>

        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
            <span>Потолок</span>
            <span>
              {area} м² × {formatCurrency(ceilingBaseRate)} ₽
            </span>
          </div>

          {ceilingExtraTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>{selectedCeiling.extraLabel}</span>
              <span>
                {ceilingLength} м.п. ×{" "}
                {formatCurrency(selectedCeiling.extraRatePerMeter)} ₽
              </span>
            </div>
          )}

          {corniceTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>{selectedCornice.label}</span>
              <span>
                {corniceLength} м.п. ×{" "}
                {formatCurrency(selectedCornice.ratePerMeter)} ₽
              </span>
            </div>
          )}

          {trackTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>{selectedTrack.label}</span>
              <span>
                {trackLength} м.п. ×{" "}
                {formatCurrency(selectedTrack.ratePerMeter)} ₽
              </span>
            </div>
          )}

          {lightsTotal > 0 && (
            <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
              <span>{calculator.lights.label}</span>
              <span>
                {lightsCount} шт. × {formatCurrency(calculator.lights.ratePerUnit)} ₽
              </span>
            </div>
          )}

          <div className="mt-2 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-950">
            <div className="flex items-center justify-between gap-4">
              <span>Цена потолка за 1 м²</span>
              <span>{formatCurrency(ceilingBaseRate)} ₽ / м²</span>
            </div>
          </div>
        </div>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <div className="flex flex-col justify-between rounded-[1.75rem] bg-slate-950 p-6 text-white sm:p-8">
          <div>
            <p className="text-sm text-white/65">Ориентировочная стоимость от</p>

            <div className="mt-4 flex items-end gap-2">
              <p className="text-5xl font-bold tracking-tight sm:text-6xl">
                {formatCurrency(total)}
              </p>
              <span className="pb-2 text-lg font-medium text-white/70">₽</span>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/70">
              При площади {area} м² и выбранных параметрах.
            </p>

            <div className="mt-8 space-y-3 text-sm leading-6 text-white/70">
              <div className="flex items-center justify-between gap-4">
                <span>Потолок</span>
                <span>{formatCurrency(ceilingBaseTotal)} ₽</span>
              </div>

              {ceilingExtraTotal > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span>{selectedCeiling.extraLabel}</span>
                  <span>{formatCurrency(ceilingExtraTotal)} ₽</span>
                </div>
              )}

              {corniceTotal > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span>{selectedCornice.label}</span>
                  <span>{formatCurrency(corniceTotal)} ₽</span>
                </div>
              )}

              {trackTotal > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span>{selectedTrack.label}</span>
                  <span>{formatCurrency(trackTotal)} ₽</span>
                </div>
              )}

              {lightsTotal > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span>{calculator.lights.label}</span>
                  <span>{formatCurrency(lightsTotal)} ₽</span>
                </div>
              )}

              <div className="border-t border-white/10 pt-3 font-semibold text-white">
                <div className="flex items-center justify-between gap-4">
                  <span>Итого</span>
                  <span>{formatCurrency(total)} ₽</span>
                </div>
              </div>

              <p>{homepage.price.includedLine}</p>
              <p>{homepage.price.fixedPriceNote}</p>
              <p>{homepage.price.noExtraChargeNote}</p>
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
    </div>
  );
}
