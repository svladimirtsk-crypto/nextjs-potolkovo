/**
 * T-027 · Когда мастер перезвонит — по рабочим часам и времени сервера (Europe/Moscow).
 */
export const WORK_START_HOUR = 9;
export const WORK_END_HOUR = 21;

/** Час в Москве для произвольного момента времени. */
export function moscowHour(date: Date = new Date()): number {
  const value = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(value);
}

/** «сегодня до 21:00» или «завтра с 9:00». */
export function resolveCallbackWindow(date: Date = new Date()): string {
  const hour = moscowHour(date);
  if (hour >= WORK_START_HOUR && hour < WORK_END_HOUR) return "сегодня до 21:00";
  return "завтра с 9:00";
}
