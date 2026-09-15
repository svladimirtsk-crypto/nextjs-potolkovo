/**
 * PT-016 · Разбор тела `PUT /api/admin/availability`.
 *
 * Проверки вынесены из роута в чистую функцию по двум причинам. Первая —
 * правило 8 раздела 2 ТЗ: календарь видят все посетители, и ошибка в разборе
 * даты превращается в ложное обещание на главной. Вторая — тесты: список
 * правил проверяется без поднятия Next и PostgreSQL.
 *
 * Ответы сформулированы так, чтобы их можно было показать владельцу в админке
 * как есть: он правит календарь с телефона и не должен разбираться, что такое
 * `slots.2.date`.
 */
import {
  MAX_DAYS_AHEAD,
  addDaysIso,
  daysBetweenIso,
  isIsoDate,
  moscowTodayIso,
  sortSlots,
} from "./format";
import type { AvailabilitySlot } from "./types";

/** Сколько дат можно занести одним сохранением. */
export const MAX_SLOTS_PER_UPDATE = 60;
/** Префикс «чт 18.09 (утро)» — длинная подпись в строке формы не нужна. */
export const MAX_NOTE_LENGTH = 40;

export type AvailabilityIssue = {
  /** Человекочитаемое имя места, а не JSON-path: его показывают в админке. */
  path: string;
  message: string;
};

export type NormalizeResult =
  | { ok: true; slots: AvailabilitySlot[] }
  | { ok: false; issues: AvailabilityIssue[] };

type RawEntry = Record<string, unknown>;

function asRecord(value: unknown): RawEntry | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RawEntry)
    : null;
}

/**
 * Приводит тело запроса к списку слотов.
 *
 * Пустой список — валиден и означает «свободных окон нет»: блок срочности на
 * сайте скроется. Это осознанное поведение, а не ошибка владельца.
 */
export function normalizeAvailabilityInput(
  raw: unknown,
  now: Date = new Date()
): NormalizeResult {
  const body = asRecord(raw);
  if (!body) {
    return {
      ok: false,
      issues: [{ path: "body", message: "Ожидался JSON вида { \"slots\": [ { \"date\": \"2026-09-18\" } ] }." }],
    };
  }

  const rawSlots = body.slots;
  if (!Array.isArray(rawSlots)) {
    return {
      ok: false,
      issues: [{ path: "slots", message: "Поле slots должно быть списком дат." }],
    };
  }

  if (rawSlots.length > MAX_SLOTS_PER_UPDATE) {
    return {
      ok: false,
      issues: [
        {
          path: "slots",
          message: `Слишком много дат: ${rawSlots.length} при лимите ${MAX_SLOTS_PER_UPDATE}.`,
        },
      ],
    };
  }

  const today = moscowTodayIso(now);
  const horizon = addDaysIso(today, MAX_DAYS_AHEAD);
  const issues: AvailabilityIssue[] = [];
  const slots: AvailabilitySlot[] = [];
  const seen = new Set<string>();

  rawSlots.forEach((entry, index) => {
    const path = `Дата №${index + 1}`;
    const record = asRecord(entry);

    if (!record) {
      issues.push({ path, message: "Нужен объект с полем date, например { \"date\": \"2026-09-18\" }." });
      return;
    }

    const date = typeof record.date === "string" ? record.date.trim() : "";
    if (!isIsoDate(date)) {
      issues.push({
        path,
        message: date
          ? `«${date}» не похоже на дату в формате ГГГГ-ММ-ДД.`
          : "Не указана дата (date).",
      });
      return;
    }

    if (date < today) {
      issues.push({ path, message: `${date} уже прошла — уберите её из списка.` });
      return;
    }

    if (daysBetweenIso(today, date) > MAX_DAYS_AHEAD) {
      issues.push({
        path,
        message: `${date} дальше ${MAX_DAYS_AHEAD} дней (можно до ${horizon}).`,
      });
      return;
    }

    if (seen.has(date)) {
      issues.push({ path, message: `${date} встречается дважды — оставьте одну строку.` });
      return;
    }

    const rawNote = record.note;
    let note: string | null = null;
    if (rawNote !== undefined && rawNote !== null) {
      if (typeof rawNote !== "string") {
        issues.push({ path, message: "Подпись окна (note) должна быть текстом." });
        return;
      }
      const trimmed = rawNote.trim();
      if (trimmed.length > MAX_NOTE_LENGTH) {
        issues.push({
          path,
          message: `Подпись окна длиннее ${MAX_NOTE_LENGTH} символов — сократите до «утро» / «после 17:00».`,
        });
        return;
      }
      note = trimmed.length > 0 ? trimmed : null;
    }

    seen.add(date);
    slots.push({ date, note });
  });

  if (issues.length > 0) return { ok: false, issues };

  return { ok: true, slots: sortSlots(slots) };
}
