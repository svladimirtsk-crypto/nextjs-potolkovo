"use client";

import type { SolutionScenario } from "@/lib/calculator-modal-types";

const OPTIONS: Array<{id: SolutionScenario; title: string; text: string}> = [
  { id: "standard", title: "Стандартный", text: "Обычный потолок, карниз, люстры и точечные светильники." },
  { id: "modern", title: "Современный", text: "Теневой/парящий профиль, встроенный карниз, линии, треки и свет." },
  { id: "advanced", title: "Продвинутый", text: "SMART-свет и сценарии управления — обсудим лично." },
];

export function ScenarioScreen({
  value,
  onChoose,
}: {
  value: SolutionScenario;
  onChoose: (s: SolutionScenario) => void;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">Какой вариант решения рассматриваете?</h3>
      <p className="mt-1 text-sm text-slate-600">Выберите уровень подбора — дальше покажу только нужные шаги, а дополнительные опции можно открыть отдельно.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(opt => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChoose(opt.id)}
              aria-pressed={active}
              className={`min-h-11 rounded-2xl border p-4 text-left transition ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}
            >
              <p className="text-sm font-semibold">{opt.title}</p>
              <p className={`mt-1 text-xs ${active ? "text-white/70" : "text-slate-600"}`}>{opt.text}</p>
            </button>
          );
        })}
      </div>

      {/*
        T-041: сомневающийся посетитель не должен упираться в выбор термина —
        «стандартный» ведёт по самому короткому сценарию и ничего не ломает:
        уточнить решение можно на замере.
      */}
      <button
        type="button"
        onClick={() => onChoose("standard")}
        className="mt-4 min-h-11 text-sm text-slate-700 underline underline-offset-4 hover:text-slate-950"
      >
        Не знаю — помогите выбрать
      </button>
    </section>
  );
}
