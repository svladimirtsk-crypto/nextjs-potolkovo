"use client";

/**
 * N-032 · «Хочу так же» на карточке примера (F-36).
 *
 * На главной такая кнопка есть, на страницах услуг её не было: человек видел
 * «18 м² · 1 день · от 45 000 ₽» — то есть уже почти свой случай — и не мог
 * ничего с этим сделать. Кнопка открывает расчёт с площадью этого примера.
 */
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import { useCalculatorPageContext } from "@/components/calculator-modal/page-context";
import { proofItemPreset } from "@/lib/service-page-actions";

export function ServiceProofWantSame({ areaLabel }: { areaLabel: string }) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  /**
   * PT-008: на страницах услуг без честного типового расчёта карточка примера
   * ведёт в форму, а не в калькулятор — площадь примера здесь ни при чём,
   * считать нужно конструкцию целиком.
   */
  if (page.presetDisabled) {
    return (
      <a
        href="#action"
        data-testid="want-same"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {page.projectCtaLabel}
      </a>
    );
  }

  if (!page.preset) return null;

  return (
    <button
      type="button"
      data-testid="want-same"
      onClick={() =>
        openCalculator(
          // PT-008: пресет страницы + площадь примера переносятся целиком.
          page.optionsFor("proof", { preset: proofItemPreset(page.preset!, areaLabel) })
        )
      }
      className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Хочу так же
    </button>
  );
}
