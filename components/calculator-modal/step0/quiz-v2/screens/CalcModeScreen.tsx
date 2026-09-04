"use client";
import type { CalculationScope } from "@/lib/calculator-v2/use-ceiling-calculator-engine";
export function CalcModeScreen({ value, onChoose, onBack }: { value: CalculationScope | null; onChoose: (m: CalculationScope) => void; onBack?: () => void }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Что хотите посчитать?</h3>
      <p className="mt-1 text-sm text-slate-600">Сначала выберите сценарий расчёта. Площадь считается отдельно, а профили и узлы — только по нужным участкам в метрах.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          {id:"room", title:"Одна комната", text:"Быстрый расчёт для кухни, спальни, гостиной, санузла или другой комнаты"},
          {id:"object", title:"Вся квартира или дом", text:"Если хотите прикинуть бюджет по объекту целиком одной суммой"},
        ].map(o=>(
          <button key={o.id} type="button" onClick={()=>onChoose(o.id as CalculationScope)}
            className={`rounded-2xl border p-4 text-left ${value===o.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <p className="text-sm font-semibold">{o.title}</p>
            <p className={`text-xs mt-1 ${value===o.id?"text-white/70":"text-slate-500"}`}>{o.text}</p>
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-between">
        <button type="button" onClick={onBack} className="text-sm text-slate-600">← Назад</button>
      </div>
    </section>
  );
}
