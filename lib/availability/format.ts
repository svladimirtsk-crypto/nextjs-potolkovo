/**
 * PT-016 · Чистые функции календаря дат замера.
 *
 * Всё, что здесь написано, не ходит ни в БД, ни в сеть — поэтому поведение
 * «просроченные даты скрывают блок» проверяется тестами без PostgreSQL
 * (`tests/availability-slots.test.ts`), а не только в интеграции.
 *
 * Часовой пояс зафиксирован на Europe/Moscow: мастер и клиенты в Москве, а
 * сервер на Amvera живёт в UTC. Без явной зоны «сегодня» в 00:30 мск
 * оказывалось вчерашним днём, и вечерняя дата замера считалась бы будущей
 * (или, наоборот, сегодняшнее окно пропадало бы из блока на полдня).
 */
import { availability } from "@/content/availability";

import type { AvailabilitySlot, AvailabilitySlotView } from "./types";

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

/** Сколько ближайших окон показывать в строке. Больше — уже не «ближайшие», а простыня текста в форме. */
export const MAX_SLOTS_IN_LABEL = 3;

/**
 * Горизонт календаря в БД.
 *
 * Страж `scripts/check-availability.mjs` ограничивает запасной файл 21 днём:
 * список, который правят руками раз в две-три недели, дальше просто неверен.
 * Для БД горизонт шире (60 дней) — обновление больше не требует деплоя, и
 * владелец может занести месяц вперёд одним заходом. Но безграничным он не
 * делается по той же причине: дата «через полгода» — это обещание, которое
 * невозможно сдержать.
 */
export const MAX_DAYS_AHEAD = 60;

/** Валидна ли строка как календарная дата `YYYY-MM-DD` (не `2026-02-31`). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Сегодняшний день в Москве, строкой `YYYY-MM-DD`. */
export function moscowTodayIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const pick = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

/** Дата `YYYY-MM-DD` плюс `days` суток, той же строкой. */
export function addDaysIso(iso: string, days: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** Короткий русский день недели: «чт». Полдень UTC — сутки не «съезжают» ни в одной зоне. */
export function weekdayShort(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return WEEKDAYS_SHORT[day] ?? "";
}

/** Подпись одной даты: «чт 18.09» или «чт 18.09 (утро)». */
export function formatSlot(iso: string, note?: string | null): string {
  const base = `${weekdayShort(iso)} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const trimmed = note?.trim() ?? "";
  return trimmed ? `${base} (${trimmed})` : base;
}

/** Слоты по возрастанию даты. Для строк `YYYY-MM-DD` лексика совпадает с хронологией. */
export function sortSlots<T extends AvailabilitySlot>(slots: readonly T[]): T[] {
  return [...slots].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

/**
 * Только будущие даты (сегодняшняя включительно), по возрастанию.
 *
 * Это и есть «автоскрытие просроченных дат»: прошедшее окно не попадает ни в
 * список, ни в строку, и если будущих не осталось вовсе — `buildAvailabilityLabel`
 * вернёт `null`, а блок срочности исчезнет со страницы без единого деплоя.
 */
export function upcomingSlots(
  slots: readonly AvailabilitySlot[],
  now: Date = new Date()
): AvailabilitySlot[] {
  const today = moscowTodayIso(now);
  return sortSlots(slots.filter((slot) => isIsoDate(slot.date) && slot.date >= today));
}

/** Слот с готовой подписью — то, что уходит в публичный API. */
export function toSlotView(slot: AvailabilitySlot): AvailabilitySlotView {
  return { ...slot, display: formatSlot(slot.date, slot.note) };
}

export type BuildLabelOptions = {
  now?: Date;
  prefix?: string;
  limit?: number;
};

/**
 * Строка для формы и блока доверия либо `null`, если показывать нечего.
 *
 * Префикс берётся из `content/availability.ts`, чтобы формулировка осталась
 * одной и той же независимо от источника дат (БД или запасной файл) — её
 * проверяет `tests/availability-legal.test.ts`.
 */
export function buildAvailabilityLabel(
  slots: readonly AvailabilitySlot[],
  options: BuildLabelOptions = {}
): string | null {
  const upcoming = upcomingSlots(slots, options.now ?? new Date());
  if (upcoming.length === 0) return null;

  const prefix = options.prefix ?? availability.labelPrefix;
  const limit = Math.max(1, options.limit ?? MAX_SLOTS_IN_LABEL);
  const shown = upcoming.slice(0, limit).map((slot) => formatSlot(slot.date, slot.note));

  return `${prefix} ${shown.join(", ")}`;
}

/**
 * Сколько суток от `fromIso` до `toIso` (знак сохраняется).
 * Нужно для проверки горизонта: «не дальше 60 дней вперёд».
 */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T12:00:00Z`);
  const to = Date.parse(`${toIso}T12:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.NaN;
  return Math.round((to - from) / MS_IN_DAY);
}
