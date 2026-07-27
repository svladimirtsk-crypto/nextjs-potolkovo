"use client";
import type { CeilingEngine } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
export function SummaryScreen({ engine, onEditRoom, onAddRoom, onPrimaryCta }:{
  engine: CeilingEngine;
  onEditRoom: (roomId:string)=>void;
  onAddRoom: ()=>void;
  onPrimaryCta?: ()=>void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-2xl bg-slate-950 p-5 text-white">
        <p className="text-sm text-white/70">Готовый расчёт</p>
        <p className="text-3xl font-semibold">{engine.totalRub.toLocaleString("ru-RU")} ₽</p>
        <p className="text-xs text-white/70 mt-1">{engine.solutionScenario} сценарий · {engine.roomsCount} {engine.roomsCount===1?"помещение":"помещений"}</p>
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
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button onClick={onPrimaryCta} className="rounded-2xl bg-slate-950 text-white py-3 text-sm font-semibold">К итогу →</button>
        <button onClick={onPrimaryCta} className="rounded-2xl bg-emerald-600 text-white py-3 text-sm font-semibold">Подобрать свет −25% →</button>
      </div>
      <p className="mt-2 text-xs text-slate-400">QUIZ V2 — Summary</p>
    </section>
  );
}
