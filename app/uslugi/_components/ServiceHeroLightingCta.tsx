"use client";

/**
 * T-045 · Вторичное действие героя страницы света.
 *
 * Primary («Собрать комплект») — обычный якорь на каталог `#price`, а здесь
 * открываем калькулятор сразу в режиме lighting-first, чтобы не заставлять
 * человека скроллить и собирать комплект вручную.
 */
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

export function ServiceHeroLightingCta({ label }: { label: string }) {
  const { openCalculator } = useCalculatorModal();

  return (
    <button
      type="button"
      onClick={() =>
        openCalculator({
          entryMode: "lighting-first",
          initialStep: 1,
          source: "track-sale:hero",
        })
      }
      className="min-h-11 text-sm font-semibold text-slate-700 underline underline-offset-4 transition-colors hover:text-slate-950"
    >
      {label}
    </button>
  );
}
