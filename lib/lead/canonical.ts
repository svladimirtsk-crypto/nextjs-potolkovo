/**
 * PT-009 · Каноническое представление payload заявки.
 *
 * Зачем. Идемпотентность держится на сравнении «тот же requestId — тот же
 * payload». Сравнивать объекты напрямую нельзя: `JSON.stringify` обходит ключи
 * в порядке вставки, поэтому `{a:1,b:2}` и `{b:2,a:1}` дают разные строки при
 * одинаковом содержимом. Две отправки одной и той же заявки, собранные разными
 * ветками кода, выглядели бы как разные — и вместо повтора прежнего результата
 * сервер отвечал бы `409`.
 *
 * Модуль намеренно чистый и без импортов: его тянут и сервер (sha256 в
 * `lib/lead/payload-hash.ts`), и браузер (отпечаток для `requestId` в
 * `lib/lead/request-id.ts`). Никакого `node:crypto` здесь быть не должно.
 */

/**
 * Канонический JSON: ключи объектов отсортированы, `undefined` отброшен,
 * порядок элементов массивов сохранён (он содержательный — комнаты и позиции
 * корзины идут в порядке добавления).
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }

  const type = typeof value;

  if (type === "string") return JSON.stringify(value);
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") return Number.isFinite(value) ? String(value) : "null";
  if (type !== "object") return "null";

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);

  return `{${entries.join(",")}}`;
}

/**
 * Поля, которые НЕ входят в отпечаток заявки.
 *
 * `requestId` — это сам ключ идемпотентности: включать его в хеш значит
 * сделать хеш производным от ключа и потерять смысл сравнения.
 */
const FINGERPRINT_EXCLUDED_KEYS = new Set(["requestId", "botcheck"]);

/** Отпечаток payload без ключа идемпотентности. */
export function leadPayloadFingerprint(payload: Record<string, unknown>): string {
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (FINGERPRINT_EXCLUDED_KEYS.has(key)) continue;
    if (value === undefined) continue;
    rest[key] = value;
  }

  return canonicalize(rest);
}

/**
 * FNV-1a, 32 бита — отпечаток для клиента.
 *
 * Криптостойкость здесь не нужна и не достигается: значение сравнивается
 * только с таким же значением в пределах одной вкладки, чтобы понять, изменился
 * ли payload между двумя нажатиями «Отправить». Авторитетный хеш считается на
 * сервере через sha256 (`lib/lead/payload-hash.ts`).
 *
 * `crypto.subtle` не подходит: он асинхронный и работает только в secure
 * context, а отпечаток нужен синхронно в момент отправки.
 */
export function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // `Math.imul` — умножение с обрезкой до 32 бит, без которого на длинных
    // строках точность double ломает младшие разряды.
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
