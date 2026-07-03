"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Компактный менеджер помещений с возможностью раскрытия/сворачивания.
 * Заменяет большую статичную карточку на компактную строку-суммарий
 * + раскрывающийся блок со списком комнат и добавлением новых.
 */
export function CollapsibleRoomManager({
  roomLabel,
  effectiveRooms,
  activeRoomId,
  completedRoomsCount,
  displayTotal,
  roomProgressMap,
  switchToRoom,
  createRoomFromSelection,
  removeRoom,
  promptAddRoom,
  isCurrentRoomComplete,
  currentRoomPendingStep,
  nextIncompleteRoom,
  step0Phase,
  openStep,
  formatCurrency,
  calcRoomSnapshot,
  ROOM_TYPE_OPTIONS,
  ALL_COMPACT_STEPS,
}: {
  roomLabel: string;
  effectiveRooms: Array<{ id: string; label: string; area: number }>;
  activeRoomId: string | null;
  completedRoomsCount: number;
  displayTotal: number;
  roomProgressMap: Record<string, { done: number; total: number }>;
  switchToRoom: (id: string) => void;
  createRoomFromSelection: (label?: string) => void;
  removeRoom: (id: string) => void;
  promptAddRoom: () => void;
  isCurrentRoomComplete: boolean;
  currentRoomPendingStep: string | null;
  nextIncompleteRoom: { id: string } | null;
  step0Phase: string;
  openStep: (id: any) => void;
  formatCurrency: (v: number) => string;
  calcRoomSnapshot: (room: any) => { total: number };
  ROOM_TYPE_OPTIONS: readonly string[] | string[];
  ALL_COMPACT_STEPS: readonly string[] | string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const totalRooms = effectiveRooms.length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header — строка-суммарий, всегда видна */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {totalRooms}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950 truncate">
              Помещения в расчёте
            </p>
            <p className="text-xs text-slate-500">
              {roomLabel} · {completedRoomsCount}/{totalRooms} готово · {formatCurrency(displayTotal)} ₽
            </p>
          </div>
        </div>
        <span className="shrink-0 text-lg text-slate-400 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      </button>

      {/* Expandable content */}
      {expanded ? (
        <div className="border-t border-slate-100 p-3 space-y-3">
          {/* Статистика */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2">
              <p className="text-xs font-semibold text-slate-950">{effectiveRooms.length}</p>
              <p className="text-[10px] text-slate-500">помещений</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <p className="text-xs font-semibold text-slate-950">{completedRoomsCount}/{totalRooms}</p>
              <p className="text-[10px] text-slate-500">готово</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2">
              <p className="text-xs font-semibold text-slate-950">{formatCurrency(displayTotal)} ₽</p>
              <p className="text-[10px] text-slate-500">общий итог</p>
            </div>
          </div>

          {/* Список комнат */}
          <div className="flex flex-wrap gap-1.5">
            {effectiveRooms.map((room) => {
              const isActive = room.id === activeRoomId;
              const snapshot = calcRoomSnapshot(room as any);
              const progress = roomProgressMap[room.id] ?? { done: 0, total: ALL_COMPACT_STEPS.length };
              const isDone = progress.done === progress.total;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => { switchToRoom(room.id); setExpanded(false); }}
                  className={[
                    "rounded-xl border px-2.5 py-1.5 text-left transition-colors text-xs",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <span className="font-semibold">{room.label}</span>
                  <span className="ml-1.5 text-[10px] opacity-70">{room.area} м²</span>
                  {isDone ? (
                    <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[9px] font-semibold text-emerald-700">✓</span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-xl border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              + Добавить
            </button>
          </div>

          {/* Добавление комнаты — быстрые варианты */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Добавить помещение</p>
            <div className="flex flex-wrap gap-1">
              {ROOM_TYPE_OPTIONS.slice(0, 6).map((label: string) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => { createRoomFromSelection(label); setExpanded(false); }}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
