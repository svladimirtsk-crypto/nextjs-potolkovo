"use client";

import { useState } from "react";

import { ProductImageLightbox } from "@/components/feed2/ProductImageLightbox";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { getDiscountedPrice } from "@/lib/feed2-products";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { LIGHTING_ONLY_DISCOUNT_PERCENT } from "@/lib/lighting-formulas";
import { isSmartProduct, kindBadgeLabel, systemBadgeLabel } from "@/lib/lighting/product-predicates";

/**
 * N-051 · Карточка товара каталога на странице продажи света.
 *
 * Отличается от `components/lighting/CatalogPieces#ProductCard`: здесь есть
 * лайтбокс изображения, бейджи системы/типа и раскрывающийся список
 * характеристик, а цена всегда показывается в режиме «только оборудование».
 * Объединять их не стали — у карточек разные наборы данных и разный контекст.
 */

const fmt = (value: number): string =>
  new Intl.NumberFormat("ru-RU").format(Math.round(value));

/** Абсолютная выгода в рублях, не меньше нуля. */
function benefitRub(priceRub: number, discountPercent: number): number {
  return Math.max(0, Math.round(priceRub - getDiscountedPrice(priceRub, discountPercent)));
}

export function ProductCard({
  product,
  qty,
  onDec,
  onInc,
}: {
  product: FeedCatalogProduct;
  qty: number;
  onDec: () => void;
  onInc: () => void;
}) {
  const regular = toNumber(product.priceRub);
  const lightingOnly = getDiscountedPrice(regular, LIGHTING_ONLY_DISCOUNT_PERCENT);
  const lightingOnlyBenefit = benefitRub(regular, LIGHTING_ONLY_DISCOUNT_PERCENT);
  const systemBadge = systemBadgeLabel(product);
  const kindBadge = kindBadgeLabel(product);

  const allAttrs = (product.keyAttributes?.length ? product.keyAttributes : product.params)
    .slice(0, 4)
    .map((p) => ({ label: toText(p.label), value: toText(p.value) }))
    .filter((a) => a.label && a.value);

  // V-20: show first 2 attributes on card surface, "+N ещё" expandable
  const visibleAttrs = allAttrs.slice(0, 2);
  const hiddenCount = allAttrs.length - visibleAttrs.length;

  const [showAllAttrs, setShowAllAttrs] = useState(false);
  const displayAttrs = showAllAttrs ? allAttrs : visibleAttrs;

  const attrs = displayAttrs.map((a) => `${a.label}: ${a.value}`).join(" • ");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
        <div className="cursor-zoom-in">
          <ProductImageLightbox
            src={toText(product.coverImage)}
            alt={toText(product.name)}
            productId={toText(product.productId)}
            kind={toText(product.kind)}
          />
        </div>

        <div className="min-w-0">
          {(systemBadge || kindBadge || isSmartProduct(product)) ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {isSmartProduct(product) ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">SMART</span>
              ) : null}
              {systemBadge ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{systemBadge}</span>
              ) : null}
              {kindBadge ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{kindBadge}</span>
              ) : null}
            </div>
          ) : null}
          <p className="text-sm font-semibold text-slate-950 break-words">{toText(product.name)}</p>

          {/* V-20: vendor code hidden from main card */}

          {attrs ? (
            <p className="mt-2 text-xs text-slate-600 break-words">
              {attrs}
              {hiddenCount > 0 && !showAllAttrs ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(true)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  ещё {hiddenCount}
                </button>
              ) : null}
              {showAllAttrs && hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAllAttrs(false)}
                  className="ml-1 text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-800"
                >
                  свернуть
                </button>
              ) : null}
            </p>
          ) : null}

          {/*
            T-044: одна ценовая подпись — итог со скидкой и зачёркнутая базовая.
            Раньше карточка несла шесть чисел (две скидки, два процента, две
            выгоды), и цену приходилось расшифровывать. Режим скидки объявлен
            баннером над сеткой.
          */}
          <div className="mt-3 text-xs">
            <span className="font-semibold text-emerald-700">{fmt(lightingOnly)} ₽</span>
            {lightingOnlyBenefit > 0 ? (
              <span className="ml-1.5 text-slate-500 line-through">{fmt(regular)} ₽</span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onDec}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                −
              </button>

              <div className="min-w-[4.5rem] text-center text-sm font-semibold text-slate-950">
                {product.unit === "m" ? qty.toFixed(1) : qty} {product.unit === "m" ? "м" : "шт"}
              </div>

              <button
                type="button"
                onClick={onInc}
                className="h-11 w-11 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:scale-95"
              >
                +
              </button>
            </div>

            <span
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold",
                qty > 0 ? "bg-emerald-50 text-emerald-700" : "hidden",
              ].join(" ")}
            >
              В корзине
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
