"use client";

/**
 * T-046 · Primary героя страницы услуги.
 *
 * Открывает калькулятор сразу с пресетом этой услуги (пресет приходит из
 * `CalculatorPageContextProvider`), чтобы человек не выбирал заново узел,
 * ради которого пришёл на страницу.
 */
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";

export function ServiceHeroCta({ slug, label }: { slug: string; label: string }) {
  const { openCalculator } = useCalculatorModal();

  return (
    <Button
      type="button"
      className="justify-center"
      onClick={() => openCalculator({ source: `${slug}:hero` })}
    >
      {label}
    </Button>
  );
}
