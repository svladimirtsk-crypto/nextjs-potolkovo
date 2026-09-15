"use client";

import { useAvailabilityLabel } from "@/lib/availability/use-availability-label";

/**
 * PT-016 · Плашка «свободные даты замера» для серверного блока о мастере.
 *
 * `founder-block.tsx` — серверный компонент, а календарь после задачи живёт в
 * БД и обновляется без деплоя. Хук в серверном компоненте не поставить, поэтому
 * строка вынесена в отдельный клиентский компонент: разметка и `data-testid`
 * прежние, серверный рендер по-прежнему печатает запасную строку из
 * `content/availability.ts`, а после гидрации она уточняется датами из БД.
 *
 * `label === null` — свободных окон нет (все даты прошли или владелец оставил
 * список пустым). Плашка не рисуется вовсе: обещать несуществующее окно хуже,
 * чем не обещать ничего (B-F108).
 */
export function AvailabilityBadge() {
  const label = useAvailabilityLabel();

  if (!label) return null;

  return (
    <p
      data-testid="founder-availability"
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200"
    >
      {label}
    </p>
  );
}
