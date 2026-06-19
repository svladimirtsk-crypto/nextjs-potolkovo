import type { CalculatorLeadSnapshot } from "@/components/home/price-calculator-context";

/**
 * Правила валидности snapshot для перехода на итоговый шаг wizard.
 *
 * Правило 1: snapshot существует (не null/undefined)
 * Правило 2: выбран формат расчета (calculationScope)
 * Правило 3: если выбран покомнатный формат, должно быть добавлено минимум одно помещение
 * Правило 4: area > 0 — площадь задана пользователем или из preset
 * Правило 5: ceilingBaseTotal > 0 — базовая стоимость посчитана
 * Правило 6: total > 0 — итоговая сумма не нулевая
 *
 * Проверяется в двух местах:
 *   - calculator-modal.tsx: блокирует кнопку «Далее» на шагах 0 и 1
 *   - wizard-step2-summary.tsx: recovery state если попали без данных
 */
export function isSnapshotValid(
  snapshot: CalculatorLeadSnapshot | null | undefined
): snapshot is CalculatorLeadSnapshot {
  if (!snapshot) return false;
  if (!snapshot.calculationScope || snapshot.calculationScope === null) return false;

  if (snapshot.calculationScope === "room") {
    if (!snapshot.roomBreakdown || snapshot.roomBreakdown.length === 0) {
      return false;
    }
  }

  if (snapshot.area <= 0) return false;
  if (snapshot.ceilingBaseTotal <= 0) return false;
  if (snapshot.total <= 0) return false;
  return true;
}
