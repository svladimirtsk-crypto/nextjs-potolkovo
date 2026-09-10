"use client";

/**
 * N-051 · Сетка каталога с догрузкой и пустым состоянием.
 *
 * Три связанных блока, которые всегда идут вместе: карточки, кнопка «Показать
 * ещё» и подсказка, когда ничего не нашлось. Держать их порознь смысла нет —
 * пустое состояние это та же сетка, просто без товаров.
 *
 * Отдельная ценность пустого состояния: если запрос ничего не дал в текущем
 * разделе, но нашёлся в других, человеку предлагают перейти туда, а не
 * оставляют перед пустым экраном.
 */
import { ProductCard } from "@/components/lighting/CatalogProductCard";
import type { CatalogSectionId } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { normalizeQty } from "@/lib/lighting/product-predicates";

/** Сколько карточек добавляет одно нажатие «Показать ещё». */
export const CATALOG_PAGE_SIZE = 24;

export type SearchMatch = { id: CatalogSectionId; label: string; count: number };

export type CatalogGridProps = {
  products: readonly FeedCatalogProduct[];
  visibleCount: number;
  onShowMore: () => void;

  cartItems: Record<string, number>;
  onIncrement: (product: FeedCatalogProduct, qty: number) => void;
  onDecrement: (product: FeedCatalogProduct, qty: number) => void;

  /** Для aria-связи панели с активной вкладкой раздела. */
  sectionId: string;

  /** Разделы, где нашлось искомое, — показываем вместо пустого экрана. */
  searchMatches: SearchMatch[];
  onPickSection: (id: CatalogSectionId) => void;
  query: string;
  onResetQuery: () => void;
};

export function CatalogGrid({
  products,
  visibleCount,
  onShowMore,
  cartItems,
  onIncrement,
  onDecrement,
  sectionId,
  searchMatches,
  onPickSection,
  query,
  onResetQuery,
}: CatalogGridProps) {
  const hidden = products.length - visibleCount;

  return (
    <>
      <div
        id="catalog-panel"
        role="tabpanel"
        aria-labelledby={`catalog-tab-${sectionId}`}
        className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {products.slice(0, visibleCount).map((product) => {
          const id = toText(product.productId);
          const qty = toNumber(cartItems[id]);
          // Метры добавляются по половине, штучные позиции — по одной.
          const step = product.unit === "m" ? 0.5 : 1;

          return (
            <ProductCard
              key={id}
              product={product}
              qty={qty}
              onDec={() => onDecrement(product, normalizeQty(qty - step, product.unit))}
              onInc={() => onIncrement(product, qty + step)}
            />
          );
        })}
      </div>

      {hidden > 0 ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onShowMore}
            className="rounded-2xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-400"
          >
            Показать ещё ({hidden} из {products.length})
          </button>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="mt-6 rounded-[var(--radius-lg)] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          {searchMatches.length > 0 ? (
            <>
              <p className="font-semibold text-slate-950">
                В этом разделе ничего нет, но есть в других
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {searchMatches.map((match) => (
                  <button
                    key={match.id}
                    type="button"
                    onClick={() => onPickSection(match.id)}
                    className="inline-flex min-h-11 items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
                  >
                    {match.label} ({match.count})
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p>Ничего не найдено.</p>
              {query ? (
                <button
                  type="button"
                  onClick={onResetQuery}
                  className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-100"
                >
                  Сбросить поиск
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
