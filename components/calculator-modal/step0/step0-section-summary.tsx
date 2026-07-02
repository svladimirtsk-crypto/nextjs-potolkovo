"use client";

import { useMemo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { resolveStep0SummaryActions } from "@/lib/calculator-flow";
import type { SolutionScenario } from "@/lib/calculator-modal-types";

import {
  useStep0Context,
  type Step0RoomSummary,
} from "./step0-context";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const SCENARIO_SUBTITLES: Record<SolutionScenario, string> = {
  standard: "Стандартный сценарий",
  modern: "Современный сценарий",
  advanced: "Продвинутый сценарий · обсудим лично",
};

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}

function RoomCard({
  index,
  room,
  onEdit,
}: {
  index: number;
  room: Step0RoomSummary;
  onEdit?: () => void;
}) {
  const hasFeatures =
    room.shadowLength ||
    room.floatingLength ||
    room.lightLinesLength ||
    (room.corniceLength && room.corniceLabel) ||
    room.corniceLightingLength ||
    (room.trackLength && room.trackLabel) ||
    room.lightsCount ||
    room.chandeliersCount;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-950">
            {index}. {room.label}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {room.area} м² · {room.ceilingTypeLabel}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold tabular-nums text-slate-950">
          {formatCurrency(room.totalRub)} ₽
        </p>
      </div>

      {hasFeatures ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {room.shadowLength ? (
            <Tag>Теневой {room.shadowLength} м.п.</Tag>
          ) : null}
          {room.floatingLength ? (
            <Tag>Парящий {room.floatingLength} м.п.</Tag>
          ) : null}
          {room.lightLinesLength ? (
            <Tag>Линии {room.lightLinesLength} м.п.</Tag>
          ) : null}
          {room.corniceLength && room.corniceLabel ? (
            <Tag>
              {room.corniceLabel} {room.corniceLength} м.п.
            </Tag>
          ) : null}
          {room.corniceLightingLength ? (
            <Tag>Подсветка {room.corniceLightingLength} м.п.</Tag>
          ) : null}
          {room.trackLength && room.trackLabel ? (
            <Tag>
              {room.trackLabel} {room.trackLength} м.п.
            </Tag>
          ) : null}
          {room.lightsCount ? <Tag>Точки {room.lightsCount} шт.</Tag> : null}
          {room.chandeliersCount ? (
            <Tag>Люстры {room.chandeliersCount} шт.</Tag>
          ) : null}
        </div>
      ) : null}

      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          aria-label={`Редактировать: ${room.label}`}
        >
          ✎ Редактировать
        </button>
      ) : null}
    </div>
  );
}

/**
 * Финальный экран Step 0 — «Проверка».
 *
 * Заменяет длинный скролл секций на компактный обзор расчёта с карточками
 * по каждому помещению и 1-2 routing-кнопками по сценарию.
 *
 * Пользователь возвращается к редактированию через «← Назад» в footer модалки
 * (которая вызывает beginEdit(lastStep)).
 */
export function Step0SectionSummary() {
  const {
    effectiveSnapshot,
    effectiveRooms,
    solutionScenario,
    isSummaryReady,
    onPromptAddRoom,
    onEditRoom,
    onEditCalculation,
    hasLighting,
  } = useStep0Context();
  const { goToStep } = useCalculatorModal();

  const routing = useMemo(
    () => resolveStep0SummaryActions({ scenario: solutionScenario, hasLighting }),
    [solutionScenario, hasLighting]
  );
  const total = effectiveSnapshot?.total ?? 0;

  if (!isSummaryReady) return null;

  return (
    <div
      className="animate-fade-slide-in space-y-5"
      data-step0-summary
      aria-label="Проверка расчёта"
    >
      {/* Hero — итог */}
      <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/10 sm:p-8">
        <p className="text-sm text-white/70">Готовый расчёт</p>
        <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          {formatCurrency(total)} ₽
        </p>
        <p className="mt-3 text-sm text-white/70">
          {SCENARIO_SUBTITLES[solutionScenario]}
          {effectiveRooms.length > 0
            ? ` · ${effectiveRooms.length} ${pluralizeRu(effectiveRooms.length, "помещение", "помещения", "помещений")}`
            : ""}
        </p>
        {onEditCalculation && effectiveRooms.length === 0 ? (
          <button
            type="button"
            onClick={onEditCalculation}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >
            ✎ Редактировать расчёт
          </button>
        ) : null}
      </div>

      {/* Карточки помещений (только для room-scope) */}
      {effectiveRooms.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-950">
            Помещения в расчёте
          </h3>
          <div className="grid gap-3">
            {effectiveRooms.map((room, idx) => (
              <RoomCard
                key={room.id}
                index={idx + 1}
                room={room}
                onEdit={onEditRoom ? () => onEditRoom(room.id) : undefined}
              />
            ))}
          </div>

          {onPromptAddRoom ? (
            <button
              type="button"
              onClick={onPromptAddRoom}
              className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              + Добавить ещё помещение
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Routing buttons — финальное решение куда идти */}
      <div
        className={
          routing.secondary
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
            : "grid grid-cols-1 gap-3"
        }
      >
        <Button
          type="button"
          className="h-12 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:h-14"
          onClick={() => goToStep(routing.primary.destination)}
          data-step0-summary-primary
          data-destination={routing.primary.destination}
          data-scenario={solutionScenario}
        >
          {routing.primary.label}
        </Button>
        {routing.secondary ? (
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-2xl text-sm font-semibold sm:h-14"
            onClick={() => goToStep(routing.secondary!.destination)}
            data-step0-summary-secondary
            data-destination={routing.secondary.destination}
            data-scenario={solutionScenario}
          >
            {routing.secondary.label}
          </Button>
        ) : null}
      </div>

      {/* Подсказка: сценарий адаптирует дальнейший путь */}
      <p className="text-xs leading-5 text-slate-500">
        {solutionScenario === "modern"
          ? "Современный сценарий — подберите свет из каталога, чтобы зафиксировать скидку −25% при заказе потолка."
          : solutionScenario === "advanced"
            ? "Продвинутый сценарий — SMART-свет и сценарии управления обсудим по телефону после замера."
            : "Стандартный сценарий — потолок без обязательного подбора света. Можно подобрать свет из каталога со скидкой −25% или сразу записаться на замер."}
      </p>

    </div>
  );
}
