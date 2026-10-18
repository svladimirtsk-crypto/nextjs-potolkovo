"use client";
import { ReactNode, useState } from "react";

import { hasOptimizedPicture, Picture } from "@/components/ui/picture";

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
    <section className="pk-question rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-slate-950 outline-none">
        {title}
      </h3>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * PT-038 · Карточка варианта с необязательной миниатюрой.
 *
 * Высота миниатюры задана константой, а не пропом: в ТЗ прямо сказано, чтобы
 * картинки не расползались по экранам квиза. Без `imageSrc` разметка — ровно
 * прежняя (текст и отступы не меняются), поэтому существующие вызовы остаются
 * пиксель-в-пиксель.
 *
 * `imageAlt` обязателен в типах вместе с `imageSrc`, но допускает пустую
 * строку: по PT-047 alt, дублирующий видимый заголовок, — это `alt=""`
 * (картинка декоративна, смысл несёт текст).
 */
export function OptionCard({
  active,
  title,
  meta,
  onClick,
  imageSrc,
  imageAlt,
  imageAspect = "4:3",
  icon,
}: {
  active: boolean;
  title: string;
  meta: string;
  onClick: () => void;
  imageSrc?: string;
  imageAlt?: string;
  imageAspect?: "4:3" | "1:1";
  icon?: ReactNode;
}) {
  // Высоту задаёт CSS слота (96/128 px, PT-038), поэтому «соотношение сторон»
  // здесь управляет только кадрированием: квадрат — центрированный кроп,
  // 4:3 — обычный. Растянуть слот пропом нельзя: так карточки не разъезжаются.
  const fitClass = imageAspect === "1:1" ? "object-center" : "object-cover";
  // SVG в `public/` — это нарисованные схемы сечения, а не фотографии работ:
  // их нельзя выдавать за реальный объект (PT-049) и нельзя затемнять.
  const isScheme = imageSrc?.toLowerCase().endsWith(".svg") ?? false;
  // PT-048: отсутствие записи для растра не должно тихо подтягивать исходный
  // тяжёлый JPEG. Для SVG манифест не нужен; 404 прячет медиа целиком.
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const showImage = !!imageSrc && failedImageSrc !== imageSrc && (isScheme || hasOptimizedPicture(imageSrc));
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pk-option min-h-11 rounded-2xl border p-4 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-lg" : "border-slate-200 bg-white hover:border-slate-400"}`}
    >
      {showImage && imageSrc ? (
        <span
          className={`pk-option-media mb-3 block w-full overflow-hidden rounded-xl border ${
            isScheme ? "pk-option-media--scheme border-slate-200" : active ? "border-white/20 bg-white/5" : "border-slate-200 bg-slate-100"
          }`}
        >
          <Picture
            src={imageSrc}
            alt={imageAlt ?? ""}
            sizes="(max-width: 640px) 45vw, 200px"
            className="block h-full w-full"
            imgClassName={`h-full w-full ${fitClass}`}
            onError={() => setFailedImageSrc(imageSrc)}
          />
        </span>
      ) : null}
      <p className={`text-sm font-semibold${icon ? " flex items-center gap-2" : ""}`}>
        {icon ? <span aria-hidden="true" className="inline-flex size-5 shrink-0">{icon}</span> : null}
        {title}
      </p>
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
  valueText,
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
  /** Человеческое озвучивание значения для скринридера: «18 квадратных метров». */
  valueText?: string;
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
    <div className="pk-range">
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
            aria-label={`${label}, ${unit}`}
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

      {/*
        N-013 (F-13): три способа задать одну величину — перебор. На мобильном
        слайдер съедал высоту, из-за которой площадь уходила под сгиб, поэтому
        он остаётся только там, где место есть: степпер + чипы хватает везде.
      */}
      <input
        type="range"
        aria-label={`${label}: слайдер`}
        aria-valuetext={valueText ?? `${value} ${unit}`}
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(e) => onChange(normalize(Number(e.target.value)))}
        className="mt-3 hidden h-11 w-full cursor-pointer accent-slate-950 lg:block"
      />

      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}

      {quickValues && quickValues.length > 0 ? (
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {quickValues.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange(normalize(q))}
              aria-pressed={Math.abs(value - q) < 0.001}
              className={`min-h-11 rounded-full px-1 text-xs font-semibold transition-colors ${
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
