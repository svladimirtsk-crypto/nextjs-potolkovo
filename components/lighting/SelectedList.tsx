"use client";

/**
 * N-051 · Вкладка «Выбранное» Шага 1.
 *
 * 90 строк JSX внутри условия `shownCatalogView === "selected"`: список позиций
 * со степперами, удалением и блоком итогов. Ничего от внутреннего состояния
 * мастера не зависит — только от корзины и режима скидки.
 */
import { ProductImage } from "@/components/feed2/ProductImage";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toText } from "@/lib/feed2-snapshot-normalize";
import { getDiscountedPrice } from "@/lib/feed2-products";

const nf = new Intl.NumberFormat("ru-RU");
const fmt = (value: number) => nf.format(Math.round(value));

export type SelectedListItem = {
  product: FeedCatalogProduct;
  item: { sku: string; name: string; qty: number; priceRub: number };
};

export type SelectedListTotals = {
  regular: number;
  effective: number;
  effectivePercent: number;
  effectiveBenefit: number;
  withCeiling: number;
  withCeilingBenefit: number;
};

export type SelectedListProps = {
  items: readonly SelectedListItem[];
  totals: SelectedListTotals;
  /** Показывать ли строку «с потолком» — при уже применённой скидке она лишняя. */
  showWithCeilingHint: boolean;
  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onRemove: (productId: string) => void;
  onGoToSummary: () => void;
  goToSummaryDisabled: boolean;
};

/** Шаг количества: метры добавляются по половине, штучные позиции — по одной. */
function stepOf(product: FeedCatalogProduct): number {
  return product.unit === "m" ? 0.5 : 1;
}

export function SelectedList({
  items,
  totals,
  showWithCeilingHint,
  onQtyChange,
  onRemove,
  onGoToSummary,
  goToSummaryDisabled,
}: SelectedListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Пока ничего не выбрано.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <ul className="space-y-3">
        {items.map(({ item, product }) => {
          const regular = item.priceRub;
          const discounted = getDiscountedPrice(regular, totals.effectivePercent);
          const productId = toText(product.productId);
          const step = stepOf(product);

          return (
            <li
              key={toText(item.sku)}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
            >
              <div className="grid grid-cols-[5.5rem_1fr] gap-3">
                <ProductImage
                  productId={productId}
                  kind={toText(product.kind)}
                  src={toText(product.coverImage)}
                  alt={toText(product.name)}
                />

                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-950">
                    {toText(item.name)}
                  </p>
                  <p className="mt-2 text-xs text-slate-700">
                    {item.qty} шт. · {fmt(regular)} ₽/шт · со скидкой −{totals.effectivePercent}%:{" "}
                    {fmt(discounted)} ₽/шт
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onQtyChange(product, item.qty - step)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      aria-label={`Уменьшить ${item.name}`}
                    >
                      −
                    </button>

                    <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-950">
                      {product.unit === "m" ? Number(item.qty.toFixed(1)) : item.qty}{" "}
                      {product.unit === "m" ? "м" : "шт."}
                    </span>

                    <button
                      type="button"
                      onClick={() => onQtyChange(product, item.qty + step)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                      aria-label={`Увеличить ${item.name}`}
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => onRemove(productId)}
                      aria-label={`Удалить ${item.name}`}
                      className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
        <p>
          Итого: <span className="line-through text-slate-400">{fmt(totals.regular)} ₽</span>
        </p>
        <p className="text-emerald-700">
          Сейчас: {fmt(totals.effective)} ₽ · −{totals.effectivePercent}% (−
          {fmt(totals.effectiveBenefit)} ₽)
        </p>

        {showWithCeilingHint ? (
          <p className="text-slate-500">
            С потолком: {fmt(totals.withCeiling)} ₽ · −25% (−{fmt(totals.withCeilingBenefit)} ₽)
          </p>
        ) : null}

        <button
          type="button"
          onClick={onGoToSummary}
          disabled={goToSummaryDisabled}
          className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700 max-sm:hidden"
        >
          К итогу →
        </button>
      </div>
    </div>
  );
}
