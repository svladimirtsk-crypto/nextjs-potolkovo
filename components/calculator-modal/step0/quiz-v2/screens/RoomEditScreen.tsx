"use client";
import type { CeilingEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
import type { ParamId } from "@/lib/step0-fsm";
export function RoomEditScreen({ roomId, engine, onEditParam, onBack, onDelete }:{
  roomId: string; engine: CeilingEngine;
  onEditParam: (p: ParamId)=>void; onBack: ()=>void; onDelete?: ()=>void;
}) {
  const room = engine.rooms.find(r=>r.id===roomId);
  if (!room) return <div>Комната не найдена</div>;
  const items: Array<{id: ParamId; label:string; value:string}> = [
    {id:"area", label:"Площадь", value:`${room.area} м²`},
    {id:"ceiling", label:"Тип потолка", value: room.ceilingType},
    {id:"cornice", label:"Карниз", value: room.corniceType},
    {id:"track", label:"Трек", value: room.trackType},
    {id:"lights", label:"Свет", value: room.lightsEnabled ? `${room.lightsCount} шт` : "—"},
  ];
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Карточка комнаты — {room.label}</h3>
      <p className="text-sm text-slate-600 mt-1">Выберите параметр для редактирования</p>
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
      <p className="mt-2 text-xs text-slate-400">QUIZ V2 — RoomEdit</p>
    </section>
  );
}
