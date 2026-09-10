/**
 * N-031 · Округление ценовых ориентиров (F-25).
 *
 * Ориентир, названный до рубля («≈ 107 426 ₽»), читается как смета, которой он
 * не является: точность обещает, что цифру считали по чертежу, а её считали по
 * площади. Округление возвращает числу его настоящий статус — «примерно».
 *
 * Шаг округления растёт вместе с суммой: 500 ₽ на малых бюджетах ещё заметны
 * клиенту, на 200 000 ₽ — уже шум.
 */

/** Порог, выше которого шаг округления укрупняется. */
const COARSE_STEP_THRESHOLD_RUB = 50_000;
const COARSE_STEP_RUB = 1_000;
const FINE_STEP_RUB = 500;

/** Округление суммы до шага: 1 000 ₽ выше 50 000 ₽, иначе 500 ₽. */
export function roundAnchor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const step = value > COARSE_STEP_THRESHOLD_RUB ? COARSE_STEP_RUB : FINE_STEP_RUB;
  return Math.round(value / step) * step;
}

/** Округление «от»-цены до 100 ₽ (F-42: «от 2 418 ₽» → «от 2 400 ₽»). */
export function roundFromAnchor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  // Вниз: «от» не должно оказаться выше реальной минимальной цены.
  return Math.floor(value / 100) * 100;
}

const nf = new Intl.NumberFormat("ru-RU");

/** «≈ 107 000 ₽» — округлённый ориентир с неразрывным пробелом перед знаком. */
export function formatAnchorRub(value: number): string {
  return `≈ ${nf.format(roundAnchor(value))}\u00a0₽`;
}

/** «от 2 400 ₽» — округлённая нижняя граница. */
export function formatFromAnchorRub(value: number): string {
  return `от ${nf.format(roundFromAnchor(value))}\u00a0₽`;
}
