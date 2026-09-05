"use client";

import type { ReactNode } from "react";

import { ProductCard } from "@/components/lighting/CatalogPieces";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

/**
 * N-051 · Экран выбора товаров из готового списка.
 *
 * Шаги «Люстры», «Подсветка карниза», «Светильники для трека» и «Точечные»
 * отличались только заголовком, подписью и источником списка, но каждый был
 * скопирован в JSX целиком — вместе с обработчиками карточки и текстом
 * пустого состояния. Из-за этого правка в одном экране (например, добавление
 * скидки на карточку) регулярно забывалась в остальных.
 *
 * Компонент не знает о шагах мастера: получает список и колбэки, возвращает
 * разметку. Логика переходов остаётся в оркестраторе.
 */

export type ProductPickerScreenProps = {
  /** Заголовок блока-шапки. */
  title: string;
  /** Пояснение под заголовком: сколько нужно и почему. */
  hint: ReactNode;
  /** Дополнительная строка-ориентир (например, диапазон светильников). */
  extraHint?: ReactNode;
  /** Оформление шапки: нейтральное или акцентное (шаги трека и точек). */
  tone?: "neutral" | "accent";
  products: readonly FeedCatalogProduct[];
  /** Текущее количество по productId. */
  cartItems: Record<string, number>;
  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
  discountPercent: number;
  /** Что показать, если каталог по этому шагу пуст. */
  emptyText: string;
  /** Кнопки навигации — рисует оркестратор, он же знает порядок шагов. */
  footer?: ReactNode;
};

export function ProductPickerScreen({
  title,
  hint,
  extraHint,
  tone = "neutral",
  products,
  cartItems,
  onQtyChange,
  onZoom,
  discountPercent,
  emptyText,
  footer,
}: ProductPickerScreenProps) {
  const isAccent = tone === "accent";

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border p-3 ${
          isAccent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
        }`}
      >
        <p
          className={`text-sm font-semibold ${isAccent ? "text-emerald-950" : "text-slate-950"}`}
        >
          {title}
        </p>
        <p className={`mt-1 text-xs ${isAccent ? "text-emerald-800" : "text-slate-600"}`}>{hint}</p>
        {extraHint ? (
          <p
            className={`mt-2 text-xs font-medium ${
              isAccent ? "text-emerald-900" : "text-slate-700"
            }`}
          >
            {extraHint}
          </p>
        ) : null}
      </div>

      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const id = toText(product.productId);
            const qty = toNumber(cartItems[id]);

            return (
              <ProductCard
                key={id}
                product={product}
                qty={qty}
                onInc={() => onQtyChange(product, qty + 1)}
                onDec={() => onQtyChange(product, qty - 1)}
                onImageClick={() =>
                  onZoom({ src: toText(product.coverImage), alt: toText(product.name) })
                }
                discountPercent={discountPercent}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {emptyText}
        </div>
      )}

      {footer}
    </div>
  );
}
