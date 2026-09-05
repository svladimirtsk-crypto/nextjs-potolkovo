/**
 * T-047 · Ручной календарь свободных дат замера.
 *
 * Намеренно правится руками: мастер один, автоматической синхронизации с
 * календарём нет, и лучше показать честные «чт, сб», чем выдуманный слот.
 * Если даты протухли (`validUntil` в прошлом) — блок не показываем вовсе,
 * чтобы не обещать несуществующее окно.
 */
export const availability: {
  freeSlotDays: string[];
  validUntil: string;
  labelPrefix: string;
  fallbackLabel: string;
} = {
  /** Дни недели, в которые обычно есть свободные окна. */
  freeSlotDays: ["чт", "сб"],
  /** До какой даты актуален список выше (ISO). */
  validUntil: "2026-12-31",
  labelPrefix: "Свободные даты замера:",
  fallbackLabel: "Свободные даты замера уточню при звонке",
};

/** Строка для формы и Шага 2 либо `null`, если список устарел. */
export function getAvailabilityLabel(now: Date = new Date()): string | null {
  const validUntil = new Date(`${availability.validUntil}T23:59:59`);
  if (Number.isNaN(validUntil.getTime()) || now > validUntil) return null;
  if (availability.freeSlotDays.length === 0) return null;

  return `${availability.labelPrefix} ${availability.freeSlotDays.join(", ")}`;
}
