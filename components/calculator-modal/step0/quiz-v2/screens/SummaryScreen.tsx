"use client";
import { useEffect, useRef } from "react";
import type { RoomConfig } from "@/lib/calculator/use-calculator-engine";
import type { CeilingEngine } from "@/lib/calculator/use-calculator-engine";
import { pluralizeRooms } from "@/lib/calculator/labels";
import { buildRoomBreakdown, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { buildTelegramDeepLink } from "@/lib/lead/telegram-link";
import { trackMessengerClick } from "@/lib/analytics";
export function SummaryScreen({ engine, onEditRoom, onAddRoom, onPrimaryCta, onSecondaryCta, primaryLabel, secondaryLabel, showPrimary = true, roomStatus, pending = false }:{
  engine: CeilingEngine;
  onEditRoom: (roomId:string)=>void;
  onAddRoom: ()=>void;
  onPrimaryCta?: ()=>void;
  onSecondaryCta?: ()=>void;
  primaryLabel?: string;
  secondaryLabel?: string;
  showPrimary?: boolean;
  roomStatus?: (room: RoomConfig) => string;
  pending?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  return (
    <section className="pk-question rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 ref={headingRef} tabIndex={-1} className="pk-room-summary-heading">Потолочная часть</h3>
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <p className="text-sm text-white/70">Потолок и работы · предварительно</p>
        {/* T-041: сумма меняется по ходу правок — озвучиваем её скринридеру. */}
        <p aria-live="polite" className="text-3xl font-semibold">
          {engine.totalRub.toLocaleString("ru-RU")} ₽
        </p>
        <p className="text-xs text-white/70 mt-1">{engine.calculationScope === "object" ? "По общей площади · " : ""}{engine.roomsCount} {pluralizeRooms(engine.roomsCount)}</p>
      </div>
      <p className="pk-room-summary-note">Это потолочная часть. Оборудование и итог всего проекта проверим дальше.</p>
      {engine.minimumApplied && <p className="pk-room-summary-note">Учтена минимальная стоимость заказа на потолок.</p>}
      {pending && <p className="pk-room-edit-note" role="status">В некоторых помещениях остались неподтверждённые параметры. Продолжите заполнение кнопкой внизу.</p>}
      <div className="mt-4 space-y-2">
        <p className="text-sm font-semibold">Помещения в расчёте</p>
        {engine.rooms.map((r, index)=>(
          <div key={r.id} data-room-id={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <span id={`summary-room-${r.id}`} className="text-sm pk-room-list-label"><b>{index + 1}. {r.label}</b> · {r.area} м²{roomStatus && <small>{roomStatus(r)}</small>}</span>
            <button
              type="button"
              onClick={()=>onEditRoom(r.id)}
              aria-label={`Редактировать: ${r.label}`}
              aria-describedby={`summary-room-${r.id}`}
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
        {showPrimary && <button type="button" onClick={onPrimaryCta} className="min-h-12 rounded-2xl bg-slate-950 text-white py-3 text-sm font-semibold">{primaryLabel ?? "К итогу →"}</button>}
        {onSecondaryCta && secondaryLabel && (
          <button type="button" onClick={onSecondaryCta} className="min-h-12 rounded-2xl border border-slate-300 bg-white text-slate-950 py-3 text-sm font-semibold">{secondaryLabel}</button>
        )}
      </div>
    </section>
  );
}
