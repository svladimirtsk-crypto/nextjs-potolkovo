/**
 * PT-012 · Единая безопасная обёртка над `localStorage`/`sessionStorage`.
 *
 * Недоступное хранилище — не исключительная ситуация, а нормальный режим
 * работы браузера:
 *
 * - Safari/iOS в приватном режиме: обращение к хранилищу работает, а `setItem`
 *   бросает `QuotaExceededError`, потому что квота равна нулю;
 * - заблокированные сторонние cookie (iframe, корпоративная политика,
 *   Firefox ETP, Safari ITP): само обращение к `window.localStorage` бросает
 *   `SecurityError`;
 * - переполнение квоты на длинном черновике расчёта.
 *
 * Ни один из этих случаев не должен мешать открыть калькулятор или отправить
 * заявку (ТЗ v5, PT-012; сценарий S10): черновик и атрибуция — удобства, а не
 * данные, без которых заявка теряет смысл.
 *
 * До этой обёртки `try/catch` стоял в `lib/calculator/draft.ts` и в
 * `collectLeadAttribution`, а `app/providers.tsx` и
 * `components/calculator-modal/calculator-modal-context.tsx` обращались к
 * `sessionStorage` напрямую. Исключение из `useEffect` — это не «атрибуция не
 * сохранилась», а упавшее React-дерево страницы: человек с заблокированным
 * хранилищем получал белый экран вместо сайта.
 */

export type WebStorageKind = "local" | "session";

/**
 * Доступ к хранилищу. `null` означает «хранилища нет» — либо мы не в браузере
 * (SSR), либо браузер запрещает к нему обращаться.
 */
export function getWebStorage(kind: WebStorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // SecurityError: доступ запрещён политикой браузера или iframe.
    return null;
  }
}

/** Значение из хранилища; `null` — нет значения ИЛИ хранилище недоступно. */
export function readWebStorage(kind: WebStorageKind, key: string): string | null {
  const storage = getWebStorage(kind);
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** Запись. `false` — не записалось (нет хранилища или квота), исключение не летит. */
export function writeWebStorage(kind: WebStorageKind, key: string, value: string): boolean {
  const storage = getWebStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // QuotaExceededError (приватный режим Safari, переполнение) — пишем мимо.
    return false;
  }
}

/**
 * Запись только если ключ ещё не занят.
 *
 * Это first-click attribution: первое значение важнее последующих, иначе
 * повторный визит по другой рекламе перезаписал бы источник, который реально
 * привёл человека. Проверка и запись идут через одну обёртку, поэтому
 * заблокированное хранилище даёт `false`, а не исключение.
 */
export function writeWebStorageIfAbsent(
  kind: WebStorageKind,
  key: string,
  value: string,
): boolean {
  if (readWebStorage(kind, key)) return false;
  return writeWebStorage(kind, key, value);
}

export function removeWebStorage(kind: WebStorageKind, key: string): void {
  const storage = getWebStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // удалять нечего или нечем — значение и так не читается
  }
}
