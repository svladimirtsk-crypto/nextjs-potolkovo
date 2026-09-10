"use client";

/**
 * N-032 · Вторая точка входа в расчёт — в середине страницы (F-33).
 *
 * Страница услуги это 13 секций в одну колонку: на мобильном до формы больше
 * десятка экранов, а вход в калькулятор был только в самом верху и в самом
 * низу. Тот, кто дочитал до сравнения решений и уже согласен, вынужден был
 * либо скроллить назад, либо пролистать всё до конца.
 */
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";
import { Container } from "@/components/ui/container";

export function ServiceMidCta({ slug }: { slug: string }) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  if (page.presetDisabled) return null;

  return (
    <section aria-label="Быстрый расчёт" className="bg-white pb-4">
      <Container>
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] bg-slate-950 px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-base font-semibold text-white sm:text-lg">
              Ориентир для вашей комнаты за 2 минуты
            </p>
            <p className="mt-1 text-sm text-white/70">
              Без замера и звонка — сразу увидите порядок суммы.
            </p>
          </div>

          <button
            type="button"
            data-testid="mid-cta"
            onClick={() =>
              openCalculator({
                preset: page.preset ?? undefined,
                presetOrigin: page.preset ? "page" : "default",
                source: `${slug}:mid`,
              })
            }
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Рассчитать
          </button>
        </div>
      </Container>
    </section>
  );
}
