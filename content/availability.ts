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
  /**
   * До какой даты актуален список выше (ISO).
   *
   * N-061: не дальше 21 дня вперёд — `scripts/check-availability.mjs`
   * роняет сборку, если дата ушла дальше или уже в прошлом. Раньше здесь
   * стояло 2026-12-31, то есть сайт обещал одни и те же свободные дни
   * весь год.
   *
   * Продлено с 2026-09-22 до 2026-10-05 по просьбе владельца: после 22.09
   * страж начал бы ронять `prebuild`, и выкатить нельзя было бы ничего,
   * включая хотфиксы. Сам список `freeSlotDays` при этом НЕ перепроверен —
   * он подтверждён владельцем на момент прошлой правки. PT-016 убирает
   * необходимость править этот файл руками: даты переезжают в БД и
   * обновляются через защищённый эндпоинт без деплоя.
   */
  validUntil: "2026-10-05",
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
