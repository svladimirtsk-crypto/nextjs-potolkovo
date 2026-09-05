"use client";
import type { RoomConfig } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
const ROOM_TYPES = ["Кухня","Гостиная","Спальня","Детская","Кабинет","Санузел","Коридор","Прихожая","Другое"];
export function RoomPickerScreen({ rooms, mode, onAdd, onSelect, onBack }:{
  rooms: RoomConfig[]; mode: "first"|"add";
  onAdd: (label:string)=>void; onSelect: (id:string)=>void; onBack?: ()=>void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">{mode==="first" ? "Добавьте первое помещение" : "Добавьте ещё помещение"}</h3>
      <p className="mt-1 text-sm text-slate-600">Выберите комнату, а затем задайте её площадь и параметры потолка.</p>
      {rooms.length>0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-slate-600 mb-2">Помещения в расчёте</p>
          <div className="flex flex-wrap gap-2">
            {rooms.map(r=>(
              <button key={r.id} onClick={()=>onSelect(r.id)} className="rounded-2xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50">
                <b>{r.label}</b> · {r.area} м²
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4">
        <p className="text-xs uppercase tracking-wider text-slate-600 mb-2">Добавить помещение</p>
        <div className="flex flex-wrap gap-2">
          {ROOM_TYPES.map(t=>(
            <button key={t} type="button" onClick={()=>onAdd(t)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">+ {t}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <button type="button" onClick={onBack} className="text-slate-600">← Назад</button>
      </div>
    </section>
  );
}
