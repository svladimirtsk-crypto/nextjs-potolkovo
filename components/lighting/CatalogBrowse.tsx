"use client";

/**
 * N-051 · Просмотр каталога: поиск, режим скидки и сетка товаров.
 *
 * Общая часть вкладки «Каталог» в модалке. Ленты фильтров рисует вызывающий —
 * их состав зависит от раздела и живёт в оркестраторе, — а всё, что ниже,
 * одинаково для любого раздела.
 */
import type { ReactNode } from "react";

import { ProductCard } from "@/components/lighting/CatalogPieces";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

export type CatalogBrowseProps = {
  /** Ленты разделов и фильтров — рисует оркестратор. */
  filters?: ReactNode;
  query: string;
  onQueryChange: (value: string) => void;

  /**
   * Скидка объявляется один раз над сеткой (T-044), а не в каждой карточке:
   * иначе на экране оказывается по два процента на товар.
   */
  hasCeilingContext: boolean;
  withCeilingPercent: number;
  lightingOnlyPercent: number;

  products: readonly FeedCatalogProduct[];
  cartItems: Record<string, number>;
  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
  cardDiscountPercent: number;
};

export function CatalogBrowse({
  filters,
  query,
  onQueryChange,
  hasCeilingContext,
  withCeilingPercent,
  lightingOnlyPercent,
  products,
  cartItems,
  onQtyChange,
  onZoom,
  cardDiscountPercent,
}: CatalogBrowseProps) {
  return (
    <>
      {filters}

      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
            <circle cx="9" cy="9" r="5.5" />
            <path d="M13.5 13.5L17 17" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value ?? "")}
          placeholder="Поиск в текущем разделе"
          className="w-full rounded-2xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
        />
      </div>

      <div
        className={[
          "rounded-2xl border px-4 py-3 text-sm font-semibold",
          hasCeilingContext
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-slate-200 bg-slate-50 text-slate-800",
        ].join(" ")}
      >
        {hasCeilingContext
          ? `Цены со скидкой −${withCeilingPercent} % при заказе потолка`
          : `Цены со скидкой −${lightingOnlyPercent} % — только свет`}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const id = toText(product.productId);
          const qty = toNumber(cartItems[id]);
          // Метры добавляются по половине, штучные позиции — по одной.
          const step = product.unit === "m" ? 0.5 : 1;

          return (
            <ProductCard
              key={id}
              product={product}
              qty={qty}
              onInc={() => onQtyChange(product, qty + step)}
              onDec={() => onQtyChange(product, qty - step)}
              onImageClick={() =>
                onZoom({ src: toText(product.coverImage), alt: toText(product.name) })
              }
              discountPercent={cardDiscountPercent}
            />
          );
        })}
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Ничего не найдено
        </div>
      ) : null}
    </>
  );
}
