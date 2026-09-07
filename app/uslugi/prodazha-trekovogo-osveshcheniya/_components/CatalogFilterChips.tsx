"use client";

import type { ReactNode } from "react";

/**
 * N-051 · Лента фильтров-чипов внутри раздела каталога.
 *
 * Одна и та же разметка повторялась четырьмя копиями: системы трека, группы
 * трека, подтипы точечных, цоколи ламп. Отличались только список, активное
 * значение и обработчик.
 *
 * Клик по чипу сбрасывает поисковый запрос — в отличие от вкладок разделов,
 * которые его сохраняют (T-065). Разница намеренная: раздел человек меняет,
 * продолжая искать то же самое, а фильтр внутри раздела сужает выдачу, и
 * старый запрос почти всегда даёт пусто.
 */

/**
 * Обёртка ленты. Отдельно от {@link CatalogFilterChipGroup}, потому что у
 * трековых систем два набора чипов (система и группа) живут в одной
 * прокручиваемой строке — своя обёртка у каждого разорвала бы её надвое.
 */
export function CatalogFilterChipsRow({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-fade-x sm:flex-wrap"
    >
      {children}
    </div>
  );
}

export function CatalogFilterChipGroup<T extends string>({
  options,
  active,
  onSelect,
}: {
  options: ReadonlyArray<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={active === option.id}
          onClick={() => onSelect(option.id)}
          className={[
            "whitespace-nowrap rounded-xl px-3 py-1.5 text-xs",
            active === option.id ? "bg-slate-900 text-white" : "bg-white text-slate-700",
            "border border-slate-200",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </>
  );
}
