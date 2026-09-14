/**
 * PT-014 · Версия политики конфиденциальности: формат и разбор.
 *
 * Значение живёт в `content/legal.ts` (`PRIVACY_POLICY_VERSION`) — один
 * источник для страницы политики, для текста согласия и для записи в заявке.
 * Здесь только чистые функции разбора, чтобы и страница, и сервер проверяли
 * версию одинаково.
 *
 * Формат: `ГГГГ-ММ-ДД` — дата последней правки текста политики, при второй
 * правке в тот же день добавляется номер ревизии: `ГГГГ-ММ-ДД.N`.
 */

/** `2026-09-10` или `2026-09-10.2`. */
export const POLICY_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}(?:\.\d{1,3})?$/;

/** Является ли значение версией политики (формат + реальная календарная дата). */
export function isPolicyVersion(value: unknown): value is string {
  return normalizePolicyVersion(value) !== null;
}

/**
 * Версия из произвольного входа: `null`, если это не версия.
 *
 * Клиент присылает значение, которое ему отдала сборка, но доверять строке из
 * тела запроса нельзя: в БД должна попадать либо узнаваемая версия, либо `null`
 * («неизвестно»), но не произвольный текст. Проверяется и календарь — `2026-13-45`
 * подходит под регулярное выражение, но датой не является.
 */
export function normalizePolicyVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!POLICY_VERSION_PATTERN.test(trimmed)) return null;

  const [datePart, revision] = trimmed.split(".");
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Обратная проверка: 30 февраля JS может перенести на март — такое не версия.
  if (parsed.toISOString().slice(0, 10) !== datePart) return null;

  return revision ? `${datePart}.${revision}` : datePart;
}

/** Дата версии для человека: `2026-09-10` → `10.09.2026`. */
export function formatPolicyVersionDate(version: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(version.trim());
  if (!match) return version;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Дата версии как `Date` (UTC) — `null`, если строка не версия. */
export function policyVersionDate(version: unknown): Date | null {
  const normalized = normalizePolicyVersion(version);
  if (!normalized) return null;

  const [datePart] = normalized.split(".");
  const parsed = new Date(`${datePart}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
