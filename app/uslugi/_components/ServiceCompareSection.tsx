"use client";

import { Container } from "@/components/ui/container";

const COMPARISON_ROWS = [
  { label: "Видимая линия примыкания", plintus: "Есть (плинтус)", tenevoy: "Нет (зазор)", paryashchiy: "Есть (контур света)" },
  { label: "Световые эффекты", plintus: "Нет", tenevoy: "Нет", paryashchiy: "LED-контур по периметру" },
  { label: "Цена профиля", plintus: "от 200 ₽ / м.п.", tenevoy: "от 950 ₽ / м.п.", paryashchiy: "от 2 500 ₽ / м.п." },
  { label: "Сложность монтажа", plintus: "Низкая", tenevoy: "Средняя", paryashchiy: "Высокая" },
  { label: "Уход за примыканием", plintus: "Протирать плинтус", tenevoy: "Пылесосить зазор", paryashchiy: "Протирать профиль" },
  { label: "Современный вид", plintus: "Классический", tenevoy: "Современный", paryashchiy: "Акцентный" },
  { label: "Под покраску стен", plintus: "Требует подрезки", tenevoy: "Идеально", paryashchiy: "Требует ровных стен" },
];

export function ServiceCompareSection() {
  return (
    <section id="compare" aria-labelledby="compare-title" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Сравнение</p>
          <h2 id="compare-title" className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Плинтус, теневой или парящий?
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Сравните три типа примыкания по ключевым критериям
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 pr-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Критерий
                </th>
                <th className="p-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Потолочный плинтус
                </th>
                <th className="bg-blue-50 p-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-blue-700 rounded-t-2xl">
                  ⭐ Теневой профиль
                </th>
                <th className="p-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Парящий потолок
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-slate-100">
                  <td className="py-4 pr-4 text-sm font-medium text-slate-950 whitespace-nowrap">
                    {row.label}
                  </td>
                  <td className="p-4 text-center text-sm text-slate-600">
                    {row.plintus}
                  </td>
                  <td className="bg-blue-50/50 p-4 text-center text-sm font-medium text-blue-900">
                    {row.tenevoy}
                  </td>
                  <td className="p-4 text-center text-sm text-slate-600">
                    {row.paryashchiy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Теневой профиль — золотая середина между ценой, внешним видом и сложностью монтажа
        </p>
      </Container>
    </section>
  );
}
