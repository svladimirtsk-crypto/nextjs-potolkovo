/**
 * PT-015 · Каналы служебного алерта о деградации доставки.
 *
 * Требование ТЗ: уведомление владельцу/разработчику «по каналу, не зависящему
 * от Telegram/Web3Forms». Поэтому здесь намеренно НЕТ ни `deliverToTelegram`,
 * ни `deliverToWeb3Forms`: алерт, отправленный через тот же бот или тот же
 * почтовый ключ, умрёт вместе с тем, о чём он должен сообщить.
 *
 * Поддерживаются два независимых приёмника:
 *  - `DELIVERY_ALERT_WEBHOOK_URL` — любой HTTP-приёмник JSON (Slack, Discord,
 *    ntfy, Apprise, собственная ручка);
 *  - `DELIVERY_ALERT_TELEGRAM_BOT_TOKEN` + `DELIVERY_ALERT_TELEGRAM_CHAT_ID` —
 *    второй бот или отдельный чат (вариант из формулировки ТЗ).
 *
 * Модуль серверный и ничего не знает о заявках: на вход приходит готовый текст.
 */
import { getEnv, type Env } from "@/lib/env";

export type AlertTransport = "webhook" | "telegram-alert";

export type AlertSendResult = {
  transport: AlertTransport;
  ok: boolean;
  /** Обрезанное описание отказа — для журнала и логов. */
  error?: string;
};

export type SendAlertOptions = {
  /** Подстановка в тестах; по умолчанию глобальный `fetch`. */
  fetchImpl?: typeof fetch;
  /** Таймаут одной отправки, мс. Алерт не должен висеть дольше ретрая. */
  timeoutMs?: number;
  /** Окружение — для тестов, которые подменяют `process.env`. */
  env?: Env;
};

/** Таймаут по умолчанию: алерт вторичен, ждать его долго смысла нет. */
export const ALERT_TIMEOUT_MS = 8_000;

/** Какие приёмники настроены. Пустой массив — алерт отправить некуда. */
export function resolveAlertTransports(env: Env = getEnv()): AlertTransport[] {
  const transports: AlertTransport[] = [];

  if (env.DELIVERY_ALERT_WEBHOOK_URL) transports.push("webhook");
  if (env.DELIVERY_ALERT_TELEGRAM_BOT_TOKEN && env.DELIVERY_ALERT_TELEGRAM_CHAT_ID) {
    transports.push("telegram-alert");
  }

  return transports;
}

/**
 * Текст ошибки для журнала: без URL и без длинных последовательностей,
 * похожих на токены.
 *
 * Отказ алерта пишется в БД и попадает в логи. Если вебхук вернул своё тело с
 * подписанным URL или если в сообщении об ошибке окажется фрагмент адреса с
 * ключом, секрет уедет в журнал — а журнал читают не только владелец.
 */
export function sanitizeAlertText(raw: unknown, max = 140): string {
  const text =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw === null || raw === undefined
          ? ""
          : String(raw);

  const cleaned = text
    .replace(/https?:\/\/\S+/gi, "[url]")
    // Почта и телефон — персональные данные: в текст алерта им нельзя, даже
    // если канал доставки вернул их в своём сообщении об ошибке.
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email скрыт]")
    .replace(/(?:\+7|8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-()]?\d{2}[\s\-()]?\d{2}/g, "[телефон скрыт]")
    // Порядок важен: сначала узнаваемые префиксы секретов и длинные смешанные
    // последовательности, и только потом — голые цифры. Наоборот токен из букв
    // и цифр разрезался бы пополам, и его начало уехало бы в журнал.
    .replace(/\b(?:sk|pk|rk|ghp|gho|github_pat|xox[baprs]|AIza)[A-Za-z0-9_\-]{6,}/gi, "[скрыто]")
    .replace(/[A-Za-z0-9_\-]{24,}/g, "[скрыто]")
    .replace(/\d{10,}/g, "[номер скрыт]")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned === "") return "без описания";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

/** Прежнее имя: ошибка отправки алерта для журнала. */
export const sanitizeAlertError = sanitizeAlertText;

function signal(timeoutMs: number): AbortSignal | undefined {
  // `AbortSignal.timeout` есть в Node 18+; если его нет — отправляем без
  // таймаута, но не роняем алерт из-за окружения.
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined;
}

async function sendWebhook(
  url: string,
  message: string,
  options: SendAlertOptions
): Promise<AlertSendResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ALERT_TIMEOUT_MS;

  if (!/^https?:\/\//i.test(url)) {
    return { transport: "webhook", ok: false, error: "DELIVERY_ALERT_WEBHOOK_URL не http(s)" };
  }

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: signal(timeoutMs),
      body: JSON.stringify({
        kind: "delivery_degraded",
        source: "potolkovo",
        at: new Date().toISOString(),
        text: message,
      }),
    });

    if (!response.ok) {
      return { transport: "webhook", ok: false, error: `HTTP ${response.status}` };
    }
    return { transport: "webhook", ok: true };
  } catch (error) {
    return { transport: "webhook", ok: false, error: sanitizeAlertError(error) };
  }
}

async function sendSecondTelegram(
  token: string,
  chatId: string,
  message: string,
  options: SendAlertOptions
): Promise<AlertSendResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? ALERT_TIMEOUT_MS;

  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: signal(timeoutMs),
      // Без `parse_mode`: текст служебный, а ошибка разметки съела бы алерт.
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    });

    if (!response.ok) {
      return { transport: "telegram-alert", ok: false, error: `HTTP ${response.status}` };
    }
    return { transport: "telegram-alert", ok: true };
  } catch (error) {
    return { transport: "telegram-alert", ok: false, error: sanitizeAlertError(error) };
  }
}

/**
 * Отправляет алерт во все настроенные приёмники.
 *
 * Приёмники независимы, поэтому пробуются оба: если вебхук лежит, а второй бот
 * жив, владелец всё равно узнает. Функция не бросает исключений — отказ алерта
 * возвращается значением, и вызывающий пишет его в журнал.
 */
export async function sendDeliveryAlert(
  message: string,
  options: SendAlertOptions = {}
): Promise<AlertSendResult[]> {
  const env = options.env ?? getEnv();
  const results: AlertSendResult[] = [];

  const webhookUrl = env.DELIVERY_ALERT_WEBHOOK_URL;
  if (webhookUrl) {
    results.push(await sendWebhook(webhookUrl, message, options));
  }

  const token = env.DELIVERY_ALERT_TELEGRAM_BOT_TOKEN;
  const chatId = env.DELIVERY_ALERT_TELEGRAM_CHAT_ID;
  if (token && chatId) {
    results.push(await sendSecondTelegram(token, chatId, message, options));
  }

  return results;
}
