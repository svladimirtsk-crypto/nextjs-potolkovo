// lib/calculator-snapshot-guard.ts

import type { CalculatorLeadSnapshot } from "@/components/home/price-calculator-context";

/**
 * Минимальная валидность snapshot для перехода на итоговый шаг.
 * Правила:
 *   1. snapshot существует (не null)
 *   2. area > 0 (площадь задана)
 *   3. ceilingBaseTotal > 0 (базовая стоимость посчитана)
 *   4. total > 0 (итог не нулевой)
 */
export function isSnapshotValid(
  snapshot: CalculatorLeadSnapshot | null
): snapshot is CalculatorLeadSnapshot {
  if (!snapshot) return false;
  if (snapshot.area <= 0) return false;
  if (snapshot.ceilingBaseTotal <= 0) return false;
  if (snapshot.total <= 0) return false;
  return true;
}
