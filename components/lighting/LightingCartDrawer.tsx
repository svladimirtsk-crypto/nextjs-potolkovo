"use client";

/**
 * T-031 · Мини-корзина света (drawer).
 *
 * Раньше со страницы каталога нельзя было ни посмотреть состав набора, ни
 * поправить количество — единственным способом было открыть калькулятор.
 * Drawer работает с той же общей корзиной (`useLightingCart`), поэтому
 * правки здесь мгновенно видны и в модалке.
 */
import { pricing } from "@/content/pricing";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

import type { CartEntry } from "@/lib/lighting/use-lighting-cart";
import { toText } from "@/lib/feed2-snapshot-normalize";

function fmt(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

export type LightingCartDrawerProps = {
  open: boolean;
  onClose: () => void;
  entries: CartEntry[];
  totalRub: number;
  discountedTotalRub: number;
  withCeilingTotalRub: number;
  onSetQty: (entry: CartEntry, qty: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
};

export function LightingCartDrawer({
  open,
  onClose,
  entries,
  totalRub,
  discountedTotalRub,
  withCeilingTotalRub,
  onSetQty,
  onRemove,
  onCheckout,
}: LightingCartDrawerProps) {
  // Подписка на клавиатуру — внешняя система, эффект здесь уместен.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const step = useCallback(
    (entry: CartEntry, direction: 1 | -1) => {
      const delta = entry.product.unit === "m" ? 0.5 : 1;
      onSetQty(entry, entry.qty + delta * direction);
    },
    [onSetQty]
  );

  if (!open || typeof document === "undefined") return null;

  const extraCeilingBenefit = Math.max(0, discountedTotalRub - withCeilingTotalRub);

  return createPortal(
    <div style={{ zIndex: "var(--z-confirm, 200)" }} className="fixed inset-0">
      <button
        type="button"
        aria-label="Закрыть корзину"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/40 backdrop-blur-sm"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Корзина света"
        className="absolute inset-y-0 right-0 flex w-[min(28rem,100vw)] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-950">Корзина света</p>
            <p className="mt-0.5 text-xs text-slate-600">{entries.length} поз.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-600">Пока ничего не выбрано.</p>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => (
                <li key={entry.productId} className="rounded-2xl border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-950">{toText(entry.product.name)}</p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Уменьшить"
                        onClick={() => step(entry, -1)}
                        className="h-10 w-10 rounded-xl border border-slate-300 text-slate-900 hover:bg-slate-50"
                      >
                        −
                      </button>
                      <span className="min-w-[4rem] text-center text-sm font-semibold text-slate-950">
                        {entry.product.unit === "m" ? entry.qty.toFixed(1) : entry.qty}{" "}
                        {entry.product.unit === "m" ? "м" : "шт"}
                      </span>
                      <button
                        type="button"
                        aria-label="Увеличить"
                        onClick={() => step(entry, 1)}
                        className="h-10 w-10 rounded-xl border border-slate-300 text-slate-900 hover:bg-slate-50"
                      >
                        +
                      </button>
                    </div>

                    <span className="text-sm font-semibold text-slate-950">{fmt(entry.totalRub)} ₽</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemove(entry.productId)}
                    className="mt-2 text-xs text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-rose-700"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-200 p-4">
          <div className="space-y-1 text-xs text-slate-600">
            <p>
              Без скидки: <span className="line-through text-slate-400">{fmt(totalRub)} ₽</span>
            </p>
            <p className="text-emerald-700">
              Только свет −{pricing.lightingDiscount.lightingOnlyPct}%: <span className="font-semibold">{fmt(discountedTotalRub)} ₽</span>
            </p>
            <p className="text-blue-700">
              С потолком −25%: <span className="font-semibold">{fmt(withCeilingTotalRub)} ₽</span> · выгода ещё{" "}
              {fmt(extraCeilingBenefit)} ₽
            </p>
          </div>

          <button
            type="button"
            disabled={entries.length === 0}
            onClick={onCheckout}
            className="mt-3 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Оформить
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
