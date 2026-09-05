"use client";
import { ReactNode, useState } from "react";

export function SectionCard({
  title,
  description,
  children,
  headingRef,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  /** T-041: фокус переводится на заголовок при смене экрана. */
  headingRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-950 outline-none">
        {title}
      </h3>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function OptionCard({ active, title, meta, onClick }: { active: boolean; title: string; meta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-2xl border p-4 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-400"}`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-600"}`}>{meta}</p>
    </button>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
function roundToStep(v: number, step: number) {
  return step <= 0 ? Math.round(v) : Math.round(v / step) * step;
}

/**
 * T-041 · Поле числа: слайдер + степперы 44 px + ручной ввод.
 *
 * Слайдер нужен, чтобы на мобильном можно было менять площадь одним движением,
 * не целясь в мелкие кнопки. Компонент управляемый — локально хранится только
 * текст поля ввода, пока оно в фокусе (иначе ввод «1» затирался бы нормализацией).
 */
export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  quickValues,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  quickValues?: number[];
  hint?: string;
}) {
  const [manual, setManual] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);
  const [lastValue, setLastValue] = useState(value);

  // Синхронизация без эффекта: подстраиваем локальный текст во время рендера.
  if (!isFocused && lastValue !== value) {
    setLastValue(value);
    setManual(String(value));
  }

  const normalize = (n: number) => clamp(roundToStep(n, step), min, max);
  const stepperClass =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-slate-900 transition-colors hover:border-slate-500 disabled:opacity-40";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Уменьшить: ${label}`}
            disabled={value <= min}
            onClick={() => onChange(normalize(value - step))}
            className={stepperClass}
          >
            −
          </button>

          <input
            id={id}
            inputMode="decimal"
            aria-label={label}
            value={manual}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              setManual(e.target.value);
              const parsed = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
            }}
            onBlur={() => {
              setIsFocused(false);
              setManual(String(value));
            }}
            className="h-11 w-20 rounded-full px-2 text-center text-sm font-semibold ring-1 ring-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-950"
          />

          <span className="text-sm font-semibold text-slate-700">{unit}</span>

          <button
            type="button"
            aria-label={`Увеличить: ${label}`}
            disabled={value >= max}
            onClick={() => onChange(normalize(value + step))}
            className={stepperClass}
          >
            +
          </button>
        </div>
      </div>

      {/* Слайдер — основной способ ввода на мобильном. */}
      <input
        type="range"
        aria-label={`${label}: слайдер`}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(normalize(Number(e.target.value)))}
        className="mt-3 h-11 w-full cursor-pointer accent-slate-950"
      />

      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}

      {quickValues && quickValues.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {quickValues.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange(normalize(q))}
              aria-pressed={Math.abs(value - q) < 0.001}
              className={`min-h-11 rounded-full px-3.5 text-xs font-semibold transition-colors ${
                Math.abs(value - q) < 0.001 ? "bg-slate-950 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:ring-slate-500"
              }`}
            >
              {q} {unit}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
