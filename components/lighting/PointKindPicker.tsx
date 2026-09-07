"use client";

/**
 * N-021 · Первый вопрос экрана светильников (F-15, F-16).
 *
 * Раньше человек попадал на три ряда управления подряд: табы шага, зелёный
 * баннер и полоса цоколей «GX53 / MR16 / GU10 / Панели / Прочее». Чтобы выбрать
 * светильник, надо было сначала разобраться в маркировках — стена для клиента,
 * который пришёл считать потолок.
 *
 * Здесь три карточки на языке вида и цены, а под ними одна кнопка, которая
 * закрывает потребность целиком. Цоколь остаётся, но ниже и свёрнутым — для
 * тех, кто действительно хочет выбирать сам.
 */
import type { ReactNode } from "react";

import { ProductImage } from "@/components/feed2/ProductImage";
import { ProductPickerScreen } from "@/components/lighting/ProductPickerScreen";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toText } from "@/lib/feed2-snapshot-normalize";
import { POINT_SUBTYPES, type PointSubtypeId } from "@/lib/catalog-ui-config";
import {
  POINT_KINDS,
  minPriceOfKind,
  pointsOfKind,
  popularPoints,
  type PointKindId,
} from "@/lib/lighting/popular-points";

const nf = new Intl.NumberFormat("ru-RU");
const rub = (value: number) => `${nf.format(Math.round(value))}\u00a0₽`;

export type PointKindPickerProps = {
  products: readonly FeedCatalogProduct[];
  /** Сколько светильников нужно по расчёту потолка. */
  required: number;
  /** Сколько уже добавлено — по нему считаем остаток. */
  current: number;
  activeKind: PointKindId;
  onKindChange: (kind: PointKindId) => void;
  /** Добавить готовое предложение в корзину. */
  onAddPopular: (product: FeedCatalogProduct, qty: number) => void;
  discountPercent: number;

  /** Ручной выбор по цоколю: вторичный фильтр, свёрнут по умолчанию. */
  manualOpen: boolean;
  onManualOpen: () => void;
  socketTab: PointSubtypeId;
  onSocketTabChange: (tab: PointSubtypeId) => void;
  /** Сколько уже выбрано по каждому цоколю — подсказка на табе. */
  socketProgress: Record<PointSubtypeId, { current: number; required: number }>;
};

export function PointKindPicker({
  products,
  required,
  current,
  activeKind,
  onKindChange,
  onAddPopular,
  discountPercent,
  manualOpen,
  onManualOpen,
  socketTab,
  onSocketTabChange,
  socketProgress,
}: PointKindPickerProps) {
  const list = [...products];
  const missing = Math.max(0, Math.round(required) - Math.round(current));
  const suggestion = popularPoints(list, missing, activeKind);

  const activeSpec = POINT_KINDS.find((spec) => spec.id === activeKind);

  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">Какие светильники?</p>
      <p className="mt-1 text-xs text-slate-600">
        Лампы к ним предложу ниже — сейчас только сами светильники.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {POINT_KINDS.map((spec) => {
          const from = minPriceOfKind(list, spec.id);
          // Нечего предложить — карточку не показываем: пустой выбор хуже,
          // чем его отсутствие.
          if (from === null) return null;

          const sample = pointsOfKind(list, spec.id)[0];
          const active = spec.id === activeKind;

          return (
            <button
              key={spec.id}
              type="button"
              data-testid={`point-kind-${spec.id}`}
              aria-pressed={active}
              onClick={() => onKindChange(spec.id)}
              className={[
                "flex flex-col overflow-hidden rounded-2xl border p-2 text-left transition",
                active
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white hover:border-slate-400",
              ].join(" ")}
            >
              <ProductImage
                productId={toText(sample.productId)}
                kind={toText(sample.kind)}
                src={toText(sample.coverImage)}
                alt={spec.title}
                containerClassName="aspect-square w-full overflow-hidden rounded-xl bg-white p-1"
              />

              <span className="mt-2 text-xs font-semibold leading-tight">{spec.title}</span>
              <span
                className={[
                  "mt-0.5 text-[11px] leading-tight",
                  active ? "text-white/70" : "text-slate-600",
                ].join(" ")}
              >
                {spec.meta}
              </span>
              <span className="mt-1 text-xs font-semibold">от {rub(from)}</span>
            </button>
          );
        })}
      </div>

      {suggestion ? (
        <button
          type="button"
          data-testid="add-popular-points"
          onClick={() => onAddPopular(suggestion.product, suggestion.qty)}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Добавить {suggestion.qty}&nbsp;{activeSpec?.accusative ?? "светильников"} за{" "}
          {rub(
            discountPercent > 0
              ? suggestion.totalRub * (1 - discountPercent / 100)
              : suggestion.totalRub
          )}
        </button>
      ) : null}
      {/*
        N-021 (F-15): цоколь остаётся доступен, но как вторичный фильтр —
        для тех, кто действительно знает, что ищет.
      */}
      {manualOpen ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {POINT_SUBTYPES.map((st) => (
            <button
              key={st.id}
              type="button"
              aria-pressed={socketTab === st.id}
              onClick={() => onSocketTabChange(st.id)}
              className={[
                "min-h-11 rounded-xl px-3 py-1.5 text-xs font-medium",
                socketTab === st.id
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200",
              ].join(" ")}
            >
              {st.label}
              {socketProgress[st.id].current > 0 ? (
                <span className="ml-1 text-[10px] opacity-70">
                  {socketProgress[st.id].current} шт.
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          data-testid="open-manual-points"
          onClick={onManualOpen}
          className="mt-3 min-h-11 text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-950"
        >
          Выбрать самому по цоколю
        </button>
      )}

    </div>
  );
}


/**
 * Экран «Светильники» целиком: выбор типа, ручной фильтр и сетка товаров.
 *
 * Собран здесь, а не в оркестраторе, чтобы `wizard-step1-lighting.tsx`
 * оставался списком шагов, а не их реализацией.
 */
export function PointsScreen({
  products,
  gridProducts,
  required,
  current,
  cartItems,
  onQtyChange,
  onZoom,
  discountPercent,
  footer,
  ...picker
}: Omit<PointKindPickerProps, "products" | "required" | "current" | "discountPercent" | "onAddPopular"> & {
  products: readonly FeedCatalogProduct[];
  /** Что показать в сетке: следует за выбранным типом или цоколем. */
  gridProducts: readonly FeedCatalogProduct[];
  required: number;
  current: number;
  cartItems: Record<string, number>;
  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
  discountPercent: number;
  footer: ReactNode;
}) {
  return (
    <ProductPickerScreen
      tone="accent"
      title="Светильники"
      hint={`Нужно ${required} шт. — выберите тип или добавьте готовый набор.`}
      products={gridProducts}
      cartItems={cartItems}
      onQtyChange={onQtyChange}
      onZoom={onZoom}
      discountPercent={discountPercent}
      emptyText="Светильники сейчас не найдены в каталоге. Подберу вариант при звонке."
      beforeGrid={
        <PointKindPicker
          {...picker}
          products={products}
          required={required}
          current={current}
          discountPercent={discountPercent}
          onAddPopular={(product, qty) => onQtyChange(product, qty)}
        />
      }
      footer={footer}
    />
  );
}
