"use client";

import { useState, type ReactNode } from "react";

import { ProductImage } from "@/components/feed2/ProductImage";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { computeBenefit, getDiscountedPrice } from "@/lib/feed2-products";
import { isPanelProduct, isSmartProduct } from "@/lib/lighting/product-predicates";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

/**
 * N-051 · Презентационные части каталога освещения.
 *
 * Вынесены из `wizard-step1-lighting.tsx` (2 250 строк) без изменения
 * поведения: карточка товара, переключатель вкладок, полоска прогресса и
 * зум изображения. Логика подбора осталась в оркестраторе — здесь только
 * отрисовка, чтобы эти же компоненты могли переиспользоваться страницей
 * света (F-07).
 */

/** Ключевые характеристики товара для карточки — максимум 4 строки. */
function pickAttrs(product: FeedCatalogProduct): { label: string; value: string }[] {
  const attrs = product.keyAttributes?.length ? product.keyAttributes : product.params;
  return (attrs ?? []).slice(0, 4).map((x) => ({ label: toText(x.label), value: toText(x.value) }));
}

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

/** Метры показываем с одним знаком: 2.5 м, а не 2.50 м. */
function fmtM(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

export function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={["rounded-xl px-3 py-2 text-sm font-medium transition-colors max-sm:px-2.5 max-sm:py-1.5 max-sm:text-xs",
        active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"].join(" ")}>
      {children}
    </button>
  );
}

/* Product card with zoomable image */
export function ProductCard({
  product, qty, onInc, onDec, onImageClick, discountPercent,
}: {
  product: FeedCatalogProduct; qty: number; onInc: () => void; onDec: () => void;
  onImageClick?: () => void;
  discountPercent: number;
}) {
  const regular = toNumber(product.priceRub);
  const discounted = getDiscountedPrice(regular, discountPercent);
  const benefit = computeBenefit(regular, discounted);
  const systemBadge = product.system === "COLIBRI_220"
    ? "COLIBRI"
    : product.system === "CLARUS_48"
      ? "CLARUS"
      : product.system === "TRACK_220"
        ? "ART"
        : null;
  const kindBadge = product.kind === "TRACK_PROFILE"
    ? "Профиль"
    : product.kind === "TRACK_FIXTURE"
      ? "Трековый свет"
      : product.kind === "SPOT_FIXTURE" || isPanelProduct(product)
        ? "Точечный"
        : product.kind === "LAMP"
          ? "Лампа"
          : null;
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white max-sm:grid max-sm:grid-cols-[5.75rem_1fr] max-sm:gap-2.5 max-sm:p-2.5">
      {/* Image — clickable for zoom */}
      <div
        className="relative cursor-zoom-in bg-slate-100 max-sm:rounded-xl"
        onClick={onImageClick}
      >
        <ProductImage
          productId={toText(product.productId)}
          kind={toText(product.kind)}
          src={toText(product.coverImage)}
          alt={toText(product.name)}
          containerClassName="aspect-square h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3 max-sm:h-[5.25rem] max-sm:p-1.5"
        />
        {qty > 0 && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
            {product.unit === "m" ? qty.toFixed(1) : qty}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 max-sm:p-0">
        {(systemBadge || kindBadge || isSmartProduct(product)) ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {isSmartProduct(product) ? (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700 max-sm:px-1.5 max-sm:text-[9px]">SMART</span>
            ) : null}
            {systemBadge ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 max-sm:px-1.5 max-sm:text-[9px]">{systemBadge}</span>
            ) : null}
            {kindBadge ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 max-sm:px-1.5 max-sm:text-[9px]">{kindBadge}</span>
            ) : null}
          </div>
        ) : null}
        <p className="break-words text-sm font-semibold text-slate-950 leading-snug max-sm:text-[12px] max-sm:leading-4">
          {toText(product.name)}
        </p>

        {/*
          T-044: на карточке максимум два числа — итоговая цена и зачёркнутая
          базовая. Процент и рублёвая выгода вынесены в баннер над сеткой,
          иначе в плитке четыре числа и цена перестаёт читаться.
        */}
        <div className="mt-2 text-xs leading-5 max-sm:mt-1.5 max-sm:text-[11px] max-sm:leading-4">
          <span className="font-semibold text-emerald-700">{fmt(discounted)} ₽</span>
          {benefit > 0 ? (
            <span className="ml-1.5 text-slate-500 line-through">{fmt(regular)} ₽</span>
          ) : null}
        </div>

        {pickAttrs(product).length > 0 || toText(product.vendorCode) ? (
          <button type="button" onClick={() => setShowDetails(!showDetails)}
            className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-800 underline decoration-slate-300 underline-offset-2">
            {showDetails ? "Скрыть" : "Подробнее"}
          </button>
        ) : null}

        {showDetails && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-0.5">
            {toText(product.vendorCode) && <p className="text-slate-500">Артикул: {toText(product.vendorCode)}</p>}
            {pickAttrs(product).map((a) => <p key={a.label}>{a.label}: {a.value}</p>)}
          </div>
        )}

        {/* Qty controls */}
        <div className="mt-3 flex items-center gap-2 max-sm:mt-2 max-sm:gap-1.5">
          {/* T-064: 44×44 — минимальная площадь касания (WCAG 2.5.5); раньше было 36. */}
          <button type="button" onClick={onDec} aria-label="Уменьшить количество"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95">−</button>
          <span className="min-w-[2.5rem] text-center text-sm font-semibold text-slate-950 max-sm:min-w-[2rem]">
            {product.unit === "m" ? Number(qty.toFixed(1)) : qty}
          </span>
          <button type="button" onClick={onInc} aria-label="Увеличить количество"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-sm)] border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95">+</button>
          <span className="ml-auto text-xs text-slate-500 max-sm:text-[11px]">{product.unit === "m" ? "м" : "шт."}</span>
        </div>
      </div>
    </div>
  );
}

/* Thin progress bar — compact, never blocks */
export function ThinProgress({ current, required, unit }: { current: number; required: number; unit: string }) {
  if (required <= 0) return null;
  const pct = Math.min(100, Math.round((current / required) * 100));
  const done = current >= required;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <div className="h-1 flex-1 rounded-full bg-slate-200">
        <div
          className={["h-1 rounded-full transition-all", done ? "bg-emerald-600" : "bg-slate-950"].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={done ? "whitespace-nowrap font-semibold text-emerald-700" : "whitespace-nowrap text-slate-600"}>
        {unit === "м" ? fmtM(current) : fmt(current)}/{unit === "м" ? fmtM(required) : fmt(required)} {unit}
      </span>
    </div>
  );
}

export function ImageQuickPreview({
  image,
  onClose,
}: {
  image: { src: string; alt: string } | null;
  onClose: () => void;
}) {
  if (!image) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Закрыть фото"
        className="fixed inset-0 z-[159] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-3 right-3 z-[160] sm:bottom-auto sm:left-auto sm:right-8 sm:top-24 sm:w-[380px]">
        <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{image.alt}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть фото"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4"><path d="M5 5l10 10M15 5L5 15" /></svg>
            </button>
          </div>
          <ProductImage
            src={image.src}
            alt={image.alt}
            containerClassName="h-[min(52dvh,420px)] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3"
            className="h-full w-full object-contain"
          />
        </div>
      </div>
    </>
  );
}
