"use client";
import type { CeilingEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import { pluralizeRooms, scenarioLabel } from "@/lib/calculator-v2/labels";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator-v2/room-snapshot";
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
        <p className="text-3xl font-semibold">{engine.totalRub.toLocaleString("ru-RU")} ₽</p>
        <p className="text-xs text-white/70 mt-1">{scenarioLabel(engine.solutionScenario)} · {engine.roomsCount} {pluralizeRooms(engine.roomsCount)}</p>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold">Помещения в расчёте</p>
        {engine.rooms.map(r=>(
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-sm">{r.label} · {r.area} м²</span>
            <button onClick={()=>onEditRoom(r.id)} className="text-xs underline text-slate-600">Редактировать</button>
          </div>
        ))}
        <button onClick={onAddRoom} className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-600">+ Добавить ещё помещение</button>
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
        <button onClick={onPrimaryCta} className="rounded-2xl bg-slate-950 text-white py-3 text-sm font-semibold">{primaryLabel ?? "К итогу →"}</button>
        {onSecondaryCta && secondaryLabel && (
          <button onClick={onSecondaryCta} className="rounded-2xl bg-emerald-600 text-white py-3 text-sm font-semibold">{secondaryLabel}</button>
        )}
      </div>
    </section>
  );
}
