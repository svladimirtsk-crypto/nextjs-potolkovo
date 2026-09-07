"use client";

/**
 * N-031 · Ценовые примеры вместо схемы шагов (F-29).
 *
 * Каждая карточка — кликабельный ответ «сколько», а не описание процесса.
 * Клик открывает калькулятор уже с параметрами примера: человек, узнавший
 * свою комнату, продолжает расчёт, а не начинает его с пустого экрана.
 */
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { homePriceExamples } from "@/lib/home-price-examples";

export function HomePriceExamples() {
  const { openCalculator } = useCalculatorModal();

  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-3" data-testid="price-examples">
      {homePriceExamples.map((example) => (
        <li key={example.id}>
          <button
            type="button"
            data-testid={`price-example-${example.id}`}
            onClick={() =>
              openCalculator({
                preset: example.preset,
                forcePreset: true,
                source: `homepage:price-example:${example.id}`,
              })
            }
            className="flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-400 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            <p className="text-sm font-semibold text-slate-950">{example.title}</p>

            <p className="mt-1 text-sm leading-6 text-slate-600">{example.composition}</p>

            <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {example.priceLabel}
            </p>

            {example.note ? (
              <p className="mt-0.5 text-xs text-slate-500">{example.note}</p>
            ) : null}

            <span className="mt-3 text-sm font-semibold text-slate-900 underline underline-offset-4">
              {example.ctaLabel}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
