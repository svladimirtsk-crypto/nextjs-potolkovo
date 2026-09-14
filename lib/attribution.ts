/**
 * PT-012 · Атрибуция заявки: единый allowlist и нормализация.
 *
 * Модуль чистый и изоморфный: его использует и клиент (при захвате атрибуции и
 * сборке payload), и сервер (при валидации `POST /api/lead`). Один список ключей
 * на оба конца — иначе клиент складывает в хранилище то, что сервер потом
 * выбрасывает, и расхождение находится только в проде.
 *
 * Зачем нормализация на сервере, а не «просто поднять лимит»:
 *
 * - атрибуция — поле непринципиальное, заявка без неё полноценна. До PT-012
 *   схема требовала `z.string().max(200)` для каждого значения, и длинная
 *   рекламная ссылка в `first_landing` роняла весь запрос в `422`: человек,
 *   пришедший из Директа с километровыми UTM, не мог оставить заявку именно
 *   потому, что пришёл из рекламы;
 * - в URL первого визита попадают не только UTM: рекламные платформы и
 *   партнёрские ссылки дописывают `email`, `phone`, `order_id`, токены. Хранить
 *   это в лиде и показывать в Telegram-уведомлении нельзя, поэтому параметры
 *   чистятся по allowlist, а фрагмент (`#…`) снимается целиком;
 * - лимит на URL один и на весь URL (2048), а не 200 на значение.
 */

/** Параметры рекламной ссылки, которые имеет смысл хранить. */
export const ATTRIBUTION_PARAM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "yclid",
  "gclid",
  "_openstat",
  "fbclid",
] as const;

/** Значения-URL: для них действует отдельный лимит и чистка параметров. */
export const ATTRIBUTION_URL_KEYS = ["first_landing", "first_referrer"] as const;

export type AttributionParamKey = (typeof ATTRIBUTION_PARAM_KEYS)[number];
export type AttributionUrlKey = (typeof ATTRIBUTION_URL_KEYS)[number];
export type AttributionKey = AttributionParamKey | AttributionUrlKey;

/** Полный allowlist ключей атрибуции. Всё, чего здесь нет, в лид не попадает. */
export const ATTRIBUTION_ALLOWED_KEYS: readonly AttributionKey[] = [
  ...ATTRIBUTION_PARAM_KEYS,
  ...ATTRIBUTION_URL_KEYS,
];

/** Лимит обычного значения: utm-метка или идентификатор клика. */
export const ATTRIBUTION_VALUE_MAX = 200;

/** Лимит URL целиком — ориентир из ТЗ PT-012. */
export const ATTRIBUTION_URL_MAX = 2048;

const URL_PARAM_ALLOWLIST: ReadonlySet<string> = new Set<string>(ATTRIBUTION_PARAM_KEYS);
const ALLOWED_KEYS: ReadonlySet<string> = new Set<string>(ATTRIBUTION_ALLOWED_KEYS);
/** База для разбора относительного пути: сам результат наружу не уходит. */
const RELATIVE_URL_BASE = "https://relative.invalid";

export function isAttributionUrlKey(key: string): key is AttributionUrlKey {
  return (ATTRIBUTION_URL_KEYS as readonly string[]).includes(key);
}

export function isAttributionKeyAllowed(key: string): key is AttributionKey {
  return ALLOWED_KEYS.has(key);
}

export function truncateAttributionValue(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/**
 * URL атрибуции: без фрагмента, без параметров вне allowlist, с лимитом длины.
 *
 * Относительные пути (`/uslugi/tenevye-potolki?utm_source=yandex`) разбираются
 * через фиктивную базу и собираются обратно в том же относительном виде —
 * дописывать к первому визиту чужой origin было бы неправдой.
 *
 * Если строка вообще не разбирается как URL, она всё равно не должна валить
 * заявку: обрезаем и возвращаем как есть.
 */
export function normalizeAttributionUrl(raw: string, max: number = ATTRIBUTION_URL_MAX): string {
  const withoutFragment = (raw.split("#")[0] ?? "").trim();
  if (!withoutFragment) return "";

  const isRelative = withoutFragment.startsWith("/");

  let url: URL;
  try {
    url = isRelative
      ? new URL(withoutFragment, RELATIVE_URL_BASE)
      : new URL(withoutFragment);
  } catch {
    return truncateAttributionValue(withoutFragment, max);
  }

  const kept = new URLSearchParams();
  for (const key of url.searchParams.keys()) {
    if (!URL_PARAM_ALLOWLIST.has(key)) continue;
    for (const value of url.searchParams.getAll(key)) kept.append(key, value);
  }
  url.search = kept.toString();

  const result = isRelative ? `${url.pathname}${url.search}` : url.toString();
  return truncateAttributionValue(result, max);
}

/**
 * Нормализация одной пары «ключ → значение».
 *
 * `null` означает «в лид не берём»: ключ вне allowlist, значение не строка,
 * пустая строка или URL, который после чистки схлопнулся в пустоту.
 */
export function normalizeAttributionEntry(key: string, raw: unknown): string | null {
  if (!isAttributionKeyAllowed(key)) return null;
  if (typeof raw !== "string") return null;

  const value = raw.trim();
  if (!value) return null;

  if (isAttributionUrlKey(key)) {
    const normalizedUrl = normalizeAttributionUrl(value);
    return normalizedUrl || null;
  }

  return truncateAttributionValue(value, ATTRIBUTION_VALUE_MAX);
}

/**
 * Нормализация всего словаря атрибуции, пришедшего от клиента.
 *
 * Вход — `unknown`: поле необязательное и непринципиальное, поэтому битый
 * клиент (строка вместо объекта, массив, `null`) не должен получать `422`.
 * Любые невалидные входные данные превращаются в пустой словарь.
 */
export function normalizeAttribution(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const normalized = normalizeAttributionEntry(key, value);
    if (normalized === null) continue;
    result[key] = normalized;
  }
  return result;
}
