"use client";
import { useEffect, useRef } from "react";
import type { CeilingEngine } from "@/lib/calculator/use-calculator-engine";
import type { ParamId } from "@/lib/step0-fsm";
import {
  ceilingLabel,
  corniceLabel,
  describeRoom,
  formatRoomLine,
  trackLabel,
} from "@/lib/calculator/labels";
export function RoomEditScreen({ roomId, engine, onEditParam, onDelete }:{
  roomId: string; engine: CeilingEngine;
  onEditParam: (p: ParamId)=>void; onDelete?: ()=>void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, [roomId]);
  const room = engine.rooms.find(r=>r.id===roomId);
  if (!room) return <div>Комната не найдена</div>;
  const { lines, totalRub } = describeRoom(room);
  const nf = new Intl.NumberFormat("ru-RU");

  // Все узлы редактируемы, а не только 4 базовых
  const items: Array<{ id: ParamId; label: string; value: string }> = [
    { id: "area", label: "Площадь", value: `${room.area} м²` },
    { id: "ceiling", label: "Тип потолка", value: ceilingLabel(room.ceilingType) },
    ...(room.shadowEnabled ? [{ id: "shadowProfile" as const, label: room.floatingEnabled ? "Теневой / парящий профиль" : "Теневой профиль", value: room.floatingEnabled ? `${room.shadowLength} / ${room.floatingLength} м.п.` : `${room.shadowLength} м.п.` }] : []),
    ...(!room.shadowEnabled && room.floatingEnabled ? [{ id: "floatingProfile" as const, label: "Парящий профиль", value: `${room.floatingLength} м.п.` }] : []),
    { id: "lightLines", label: "Световые линии", value: room.lightLinesEnabled ? `${room.lightLinesLength} м.п.` : "Не нужны" },
    { id: "cornice", label: "Карниз", value: corniceLabel(room.corniceType) },
    { id: "track", label: "Трек", value: trackLabel(room.trackType) },
    { id: "chandeliers", label: "Люстры", value: room.chandeliersEnabled ? `${room.chandeliersCount} шт.` : "Не нужно" },
    { id: "lights", label: "Точечные светильники", value: room.lightsEnabled ? `${room.lightsCount} шт.` : "Не нужно" },
  ];

  return (
    <section className="pk-question pk-room-edit rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 ref={headingRef} tabIndex={-1} className="text-lg font-semibold">Карточка комнаты — {room.label}</h3>
      <p className="text-sm text-slate-600 mt-1">Выберите параметр для редактирования</p>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">Что входит</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {lines.map((line) => (
            <li key={`${line.label}-${line.value}`}>{formatRoomLine(line)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-slate-950">
          Предварительно по помещению: {nf.format(Math.round(totalRub))} ₽
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {items.map(it=>(
          <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <span id={`room-field-${roomId}-${it.id}`} className="text-sm">{it.label}: <b>{it.value}</b></span>
            <button type="button" data-edit-param={it.id} aria-describedby={`room-field-${roomId}-${it.id}`} onClick={()=>onEditParam(it.id)} className="min-h-11 px-3 text-sm text-slate-700 underline">Изменить</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 justify-between items-center">
        <button type="button" onClick={onDelete} className="min-h-11 text-sm text-rose-700 border border-rose-200 rounded-xl px-3 py-2">Удалить текущее помещение</button>
      </div>
    </section>
  );
}
