"use client";
import type { CeilingEngine } from "@/lib/calculator/use-calculator-engine";
import { pluralizeRooms, scenarioLabel } from "@/lib/calculator/labels";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { buildTelegramDeepLink } from "@/lib/lead/telegram-link";
import { trackMessengerClick } from "@/lib/analytics";
export function SummaryScreen({ engine, onEditRoom, onAddRoom, onPrimaryCta, onSecondaryCta, primaryLabel, secondaryLabel }:{
  engine: CeilingEngine;
  onEditRoom: (roomId:string)=>void;
  onAddRoom: ()=>void;
  onPrimaryCta?: ()=>void;
  onSecondaryCta?: ()=>void;
  primaryLabel?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <p className="text-sm text-white/70">Готовый расчёт</p>
        {/* T-041: сумма меняется по ходу правок — озвучиваем её скринридеру. */}
        <p aria-live="polite" className="text-3xl font-semibold">
          {engine.totalRub.toLocaleString("ru-RU")} ₽
        </p>
        <p className="text-xs text-white/70 mt-1">{scenarioLabel(engine.solutionScenario)} · {engine.roomsCount} {pluralizeRooms(engine.roomsCount)}</p>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold">Помещения в расчёте</p>
        {engine.rooms.map(r=>(
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-sm">{r.label} · {r.area} м²</span>
            <button
              type="button"
              onClick={()=>onEditRoom(r.id)}
              aria-label={`Редактировать: ${r.label}`}
              className="min-h-11 px-2 text-xs text-slate-700 underline"
            >
              Редактировать
            </button>
          </div>
        ))}
        <button type="button" onClick={onAddRoom} className="min-h-11 w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-700">+ добавить помещение</button>
      </div>
      {/* T-026: микро-конверсия — забрать расчёт в мессенджер */}
      <a
        href={buildTelegramDeepLink({
          rooms: engine.rooms.map(r => buildRoomBreakdown(r as unknown as V2RoomConfig)),
          totalArea: engine.totalArea,
          grandTotalRub: engine.totalRub,
        })}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackMessengerClick({
            messenger: "telegram",
            placement: "modal_summary",
            grandTotal: engine.totalRub,
          })
        }
        className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-100"
      >
        Получить этот расчёт в Telegram
      </a>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onPrimaryCta} className="min-h-12 rounded-2xl bg-slate-950 text-white py-3 text-sm font-semibold">{primaryLabel ?? "К итогу →"}</button>
        {onSecondaryCta && secondaryLabel && (
          <button type="button" onClick={onSecondaryCta} className="min-h-12 rounded-2xl bg-emerald-600 text-white py-3 text-sm font-semibold">{secondaryLabel}</button>
        )}
      </div>
    </section>
  );
}
