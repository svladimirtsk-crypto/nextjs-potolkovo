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

export function ServiceProofWantSame({
  slug,
  areaLabel,
}: {
  slug: string;
  areaLabel: string;
}) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  if (!page.preset) return null;

  return (
    <button
      type="button"
      data-testid="want-same"
      onClick={() =>
        openCalculator({
          preset: proofItemPreset(page.preset!, areaLabel),
          forcePreset: true,
          presetOrigin: "page",
          source: `${slug}:proof`,
        })
      }
      className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      Хочу так же
    </button>
  );
}
