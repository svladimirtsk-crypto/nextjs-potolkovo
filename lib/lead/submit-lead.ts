/**
 * PT-004 · Единственный клиентский путь отправки заявки на `POST /api/lead`.
 *
 * Зачем общий сервис. До этой задачи отправку писали дважды и по-разному.
 * Основная форма (`components/home/action-form.tsx`) проверяла
 * `response.ok && body.ok`, а rescue-диалог калькулятора — нет:
 *
 *     try { await fetch("/api/lead", …); markLeadSubmitted(); } catch {}
 *
 * `fetch` не бросает исключение на HTTP 4xx/5xx, поэтому `markLeadSubmitted()`
 * вызывался после любого ответа сервера, включая `422/429/500`. Модалка
 * закрывалась, человек был уверен, что заявка ушла и ему перезвонят, а в базе
 * не было ничего. Молчаливый «успех» хуже явного отказа: клиент не
 * перезванивает сам и заявка потеряна окончательно.
 *
 * Контракт сервиса: функция НЕ бросает исключений. Любой исход — значение
 * `LeadSubmitResult`, и успешная ветка существует только при `ok: true`.
 * «Забыть проверить ответ» становится технически невозможным: чтобы получить
 * `leadId`, вызывающий код обязан сузить тип через `result.ok`.
 *
 * Модуль клиентский и не импортирует ничего серверного: ни `lib/env.ts`,
 * ни zod-схему, ни `content/*` — иначе он утянет их в бандл главной.
 */

/** Почему отправка не удалась. От вида зависит и текст пользователю, и аналитика. */
export type LeadSubmitFailureKind =
  /** 422 — сервер не принял payload (обычно номер телефона). */
  | "validation"
  /** 429 — сработал rate-limit; есть смысл показать `Retry-After`. */
  | "ratelimit"
  /** 503 — приём заявок выключен флагом или недоступно хранилище (PT-002). */
  | "unavailable"
  /** Прочие 4xx/5xx и `ok: false` без распознаваемого статуса. */
  | "server"
  /** `fetch` отвергнут: офлайн, DNS, обрыв соединения. */
  | "network"
  /** Превышен лимит ожидания ответа. */
  | "timeout";

export type LeadSubmitSuccess = {
  ok: true;
  status: number;
  /** Короткий код заявки (`K7F3Q`). `null` при срабатывании honeypot. */
  leadId: string | null;
  callbackWindow: string;
  /** Сервер нашёл недавнюю заявку с тем же телефоном и не стал плодить дубль. */
  deduped: boolean;
};

export type LeadSubmitFailure = {
  ok: false;
  kind: LeadSubmitFailureKind;
  status: number | null;
  /** Пути полей из zod-ответа `422` — для подсветки конкретного поля (PT-013). */
  issues: string[];
  /** `Retry-After` в секундах, если сервер его отдал. */
  retryAfterSec: number | null;
};

export type LeadSubmitResult = LeadSubmitSuccess | LeadSubmitFailure;

/**
 * Лимит ожидания ответа.
 *
 * PT-003 убрал из запроса синхронную доставку в Telegram/Web3Forms, поэтому
 * `/api/lead` отвечает за миллисекунды. 15 секунд — с большим запасом на
 * холодный старт контейнера; ждать дольше значит оставить человека с
 * «зависшей» кнопкой.
 */
export const LEAD_SUBMIT_TIMEOUT_MS = 15_000;

export const LEAD_API_PATH = "/api/lead";

type LeadApiBody = {
  ok?: unknown;
  leadId?: unknown;
  callbackWindow?: unknown;
  deduped?: unknown;
  error?: unknown;
  issues?: unknown;
};

export type SubmitLeadOptions = {
  timeoutMs?: number;
  /** Подмена транспорта в тестах. По умолчанию — глобальный `fetch`. */
  fetchImpl?: typeof fetch;
};

function classify(response: Response, body: LeadApiBody | null): LeadSubmitFailureKind {
  const error = typeof body?.error === "string" ? body.error : "";

  // Сервер отдаёт `storage_unavailable` (PT-002) и `disabled` (LEAD_API_ENABLED=0)
  // с 503: принимать заявку всё равно некуда, повторять её бессмысленно.
  if (response.status === 503 || error === "storage_unavailable" || error === "disabled") {
    return "unavailable";
  }
  if (response.status === 429 || error === "rate_limited") return "ratelimit";
  if (response.status === 422 || error === "validation") return "validation";
  return "server";
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header.trim());
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds);
}

function readIssues(body: LeadApiBody | null): string[] {
  if (!Array.isArray(body?.issues)) return [];
  return body.issues.map((issue) => String(issue)).slice(0, 20);
}

/**
 * Отправляет заявку и всегда возвращает результат — никогда не бросает.
 *
 * `payload` намеренно `unknown`: сервис не владеет формой лида, схема живёт в
 * `lib/lead/schema.ts` и проверяется сервером. Клиентская валидация — на
 * стороне формы, здесь только транспорт и честная классификация ответа.
 */
export async function submitLead(
  payload: unknown,
  options: SubmitLeadOptions = {}
): Promise<LeadSubmitResult> {
  const timeoutMs = options.timeoutMs ?? LEAD_SUBMIT_TIMEOUT_MS;
  const doFetch = options.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(LEAD_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Битый/пустой JSON не должен ронять отправку: статус важнее тела.
    const body = (await response.json().catch(() => null)) as LeadApiBody | null;

    if (response.ok && body?.ok === true) {
      return {
        ok: true,
        status: response.status,
        leadId: typeof body.leadId === "string" && body.leadId ? body.leadId : null,
        callbackWindow: typeof body.callbackWindow === "string" ? body.callbackWindow : "",
        deduped: body.deduped === true,
      };
    }

    return {
      ok: false,
      kind: classify(response, body),
      status: response.status,
      issues: readIssues(body),
      retryAfterSec: parseRetryAfter(response.headers.get("Retry-After")),
    };
  } catch {
    // `controller.signal.aborted` отличает наш таймаут от обрыва связи.
    return {
      ok: false,
      kind: controller.signal.aborted ? "timeout" : "network",
      status: null,
      issues: [],
      retryAfterSec: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * PT-004 · Короткая человеческая причина отказа.
 *
 * Без телефона и без обещаний: конкретный призыв к действию добавляет форма,
 * которая знает свои контакты. Текст намеренно не раскрывает технические
 * детали (имя канала доставки, текст ошибки провайдера) — PT-013.
 */
export function leadSubmitFailureReason(result: {
  kind: LeadSubmitFailureKind;
  retryAfterSec?: number | null;
}): string {
  switch (result.kind) {
    case "validation":
      return "Сервер не принял данные заявки — проверьте номер телефона.";
    case "ratelimit":
      return result.retryAfterSec
        ? `Слишком много попыток. Повторите через ${Math.max(1, Math.ceil(result.retryAfterSec / 60))} мин.`
        : "Слишком много попыток отправки. Повторите позже.";
    case "unavailable":
      return "Приём заявок временно недоступен.";
    case "timeout":
      return "Сервер не ответил вовремя.";
    case "network":
      return "Нет связи с сервером.";
    default:
      return "Не удалось отправить заявку.";
  }
}

/** Вид отказа в словаре цели `lead_error` Яндекс.Метрики. */
export type LeadErrorMetricKind = "validation" | "network" | "server" | "ratelimit";

/**
 * PT-004 · Сопоставление транспортного отказа и метрики.
 *
 * Метрика знает четыре вида (Приложение В ТЗ), транспорт — шесть: `timeout`
 * для аналитики неотличим от обрыва связи, а `unavailable` (выключенный приём
 * заявок или недоступная БД) — это отказ сервера. Без общей функции каждая
 * форма сопоставляет по-своему, и `lead_error` перестаёт сходиться между
 * каналами.
 */
export function toLeadErrorMetricKind(kind: LeadSubmitFailureKind): LeadErrorMetricKind {
  switch (kind) {
    case "validation":
      return "validation";
    case "ratelimit":
      return "ratelimit";
    case "network":
    case "timeout":
      return "network";
    default:
      return "server";
  }
}

/**
 * PT-004 · Порядок выбора `orderIntent` — один на все формы.
 *
 * Логика была продублирована в `action-form.tsx` и отсутствовала в rescue:
 * короткая заявка уходила с дефолтным `ceiling_only` даже когда в корзине был
 * только свет. Мастер видел «Потолок» в теме письма при заказе освещения.
 */
export type LeadOrderIntent = "ceiling_only" | "lighting_with_ceiling" | "lighting_only" | "advanced";

export function resolveOrderIntent(input: {
  discountMode?: string | null;
  lightingItemsCount?: number;
  hasRooms?: boolean;
}): LeadOrderIntent {
  const mode = String(input.discountMode ?? "none");
  const items = Number(input.lightingItemsCount ?? 0);
  const hasRooms = Boolean(input.hasRooms);

  if (mode === "with-ceiling") return "lighting_with_ceiling";
  if (mode === "lighting-only" || (items > 0 && !hasRooms)) return "lighting_only";
  return "ceiling_only";
}

/**
 * PT-004 · Как человек вошёл в расчёт.
 *
 * `entry` в `LeadSnapshotV2` описывает точку входа, а не место отправки.
 * Rescue-заявка теперь честная: вход «сначала свет» больше не записывается как
 * `ceiling-first` только потому, что форма открыта из модалки.
 */
export type LeadEntry = "ceiling-first" | "lighting-first" | "direct";

export function resolveLeadEntry(input: {
  placement: string;
  entryMode?: string | null;
}): LeadEntry {
  if (input.entryMode === "lighting-first") return "lighting-first";
  return input.placement === "modal" || input.placement === "rescue" ? "ceiling-first" : "direct";
}

/** Ключи атрибуции, которые кладём в лид. Всё остальное из storage не берём. */
const ATTRIBUTION_KEYS = [
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

/**
 * PT-004 · Общий сбор атрибуции.
 *
 * `sessionStorage` обёрнут в try/catch: в приватном режиме Safari и при
 * корпоративной политике доступ к хранилищу бросает исключение, и заявка не
 * должна теряться из-за необязательного поля (полностью задача — PT-012).
 */
export function collectLeadAttribution(
  extra?: Record<string, string>
): Record<string, string> {
  const attribution: Record<string, string> = {};

  if (typeof window !== "undefined") {
    try {
      for (const key of ATTRIBUTION_KEYS) {
        const value = window.sessionStorage.getItem(key);
        if (value && value.trim()) attribution[key] = value.trim();
      }
      const firstLanding = window.sessionStorage.getItem("first_landing");
      if (firstLanding && firstLanding.trim()) attribution.first_landing = firstLanding.trim();
      const firstReferrer = window.sessionStorage.getItem("first_referrer");
      if (firstReferrer && firstReferrer.trim()) attribution.first_referrer = firstReferrer.trim();
    } catch {
      // Хранилище недоступно — уходим без атрибуции, но с заявкой.
    }
  }

  return extra ? { ...attribution, ...extra } : attribution;
}
