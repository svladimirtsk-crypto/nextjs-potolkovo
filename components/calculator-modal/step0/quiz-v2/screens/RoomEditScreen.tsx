"use client";
import type { CeilingEngine } from "@/lib/calculator/use-calculator-engine";
import type { ParamId } from "@/lib/step0-fsm";
import {
  ceilingLabel,
  corniceLabel,
  describeRoom,
  formatRoomLine,
  trackLabel,
} from "@/lib/calculator/labels";
export function RoomEditScreen({ roomId, engine, onEditParam, onBack, onDelete }:{
  roomId: string; engine: CeilingEngine;
  onEditParam: (p: ParamId)=>void; onBack: ()=>void; onDelete?: ()=>void;
}) {
  const room = engine.rooms.find(r=>r.id===roomId);
  if (!room) return <div>Комната не найдена</div>;
  const { lines, totalRub } = describeRoom(room);
  const nf = new Intl.NumberFormat("ru-RU");

  // Все узлы редактируемы, а не только 4 базовых
  const items: Array<{ id: ParamId; label: string; value: string }> = [
    { id: "area", label: "Площадь", value: `${room.area} м²` },
    { id: "ceiling", label: "Тип потолка", value: ceilingLabel(room.ceilingType) },
    { id: "cornice", label: "Карниз", value: corniceLabel(room.corniceType) },
    { id: "track", label: "Трек", value: trackLabel(room.trackType) },
    { id: "chandeliers", label: "Люстры", value: room.chandeliersEnabled ? `${room.chandeliersCount} шт.` : "Не нужно" },
    { id: "lights", label: "Точечные светильники", value: room.lightsEnabled ? `${room.lightsCount} шт.` : "Не нужно" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Карточка комнаты — {room.label}</h3>
      <p className="text-sm text-slate-600 mt-1">Выберите параметр для редактирования</p>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-950">Что входит</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {lines.map((line) => (
            <li key={`${line.label}-${line.value}`}>{formatRoomLine(line)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-semibold text-slate-950">
          Итого по помещению: {nf.format(Math.round(totalRub))} ₽
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {items.map(it=>(
          <div key={it.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
            <span className="text-sm">{it.label}: <b>{it.value}</b></span>
            <button onClick={()=>onEditParam(it.id)} className="text-xs text-slate-600 underline">Изменить</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-between items-center">
        <button onClick={onBack} className="text-sm text-slate-600">← Назад</button>
        <button onClick={onDelete} className="text-xs text-rose-600 border border-rose-200 rounded-xl px-3 py-1.5">Удалить текущее помещение</button>
      </div>
    </section>
  );
}
