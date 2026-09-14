/**
 * PT-015 · Алерт при систематических сбоях доставки.
 *
 * Задача ТЗ: «Если N подряд попыток доставки в **оба** канала завершились
 * неудачей — служебное уведомление владельцу/разработчику по каналу, не
 * зависящему от Telegram/Web3Forms. Иначе деградация каналов доставки может
 * остаться незамеченной сколь угодно долго, при этом заявки формально
 * "сохраняются" (после PT-002/PT-003), но никто их не увидит вовремя».
 *
 * После PT-003 заявка сохраняется в БД до попытки отправки, а отказ канала не
 * влияет на ответ пользователю: он видит «Заявка №K7F3Q сохранена». Это
 * правильное поведение для человека — и слепая зона для владельца. Лог пишет
 * `failed`, но логи на Amvera никто не читает, пока не станет поздно.
 *
 * Как считается «N подряд». Из БД берутся последние `DELIVERY_ALERT_LOOKBACK`
 * заданий в порядке времени ПОСЛЕДНЕЙ попытки (не создания: ретрай старого
 * задания иначе встал бы в хвост и разорвал серию там, где сбоя нет). Серия —
 * идущие с самого свежего попытки со статусом `failed`; первая же успешная
 * отправка обнуляет её. Алерт срабатывает, только если серия не короче порога,
 * покрывает ВСЕ настроенные каналы и началась внутри окна наблюдения.
 *
 * Охлаждение хранится в таблице `delivery_alerts`, а не в памяти процесса:
 * контейнер перезапускается, и «не чаще раза в час» должно это переживать.
 */
import { getEnv, type Env } from "@/lib/env";

import {
  resolveAlertTransports,
  sanitizeAlertText,
  sendDeliveryAlert,
  type AlertSendResult,
} from "./alert-notify";
import { DELIVERY_CHANNELS } from "./deliver-all";
import type {
  DeliveryChannel,
  DeliveryRecord,
  LeadStore,
} from "./store-types";

export type DeliveryAlertConfig = {
  enabled: boolean;
  /** Сколько неудачных попыток подряд считается сбоем. */
  threshold: number;
  /** Окно наблюдения, мс. */
  windowMs: number;
  /** Охлаждение между алертами, мс. */
  cooldownMs: number;
  /** Сколько последних заданий читать из БД. */
  lookback: number;
  /** Каналы, которые обязаны лежать вместе, чтобы алерт имел смысл. */
  channels: readonly DeliveryChannel[];
};

export function resolveDeliveryAlertConfig(env: Env = getEnv()): DeliveryAlertConfig {
  return {
    enabled: env.DELIVERY_ALERT_ENABLED,
    threshold: env.DELIVERY_ALERT_THRESHOLD,
    windowMs: env.DELIVERY_ALERT_WINDOW_MIN * 60_000,
    cooldownMs: env.DELIVERY_ALERT_COOLDOWN_MIN * 60_000,
    lookback: env.DELIVERY_ALERT_LOOKBACK,
    channels: DELIVERY_CHANNELS,
  };
}

/** Состояние доставки, посчитанное по последним попыткам. */
export type DeliveryHealth = {
  /** Подряд идущих неудачных попыток, считая от самой свежей. */
  streak: number;
  /** Какие каналы участвуют в серии. */
  streakChannels: DeliveryChannel[];
  /** Время самой старой неудачи в серии — начало инцидента. */
  streakStartedAt: number | null;
  /** Время самой свежей неудачи в серии. */
  streakEndsAt: number | null;
  /** Сколько заявок затронуто серией. */
  stuckLeads: number;
  /** Успешных отправок в окне наблюдения. */
  sentInWindow: number;
  /** Неудачных заданий в окне наблюдения. */
  failuresInWindow: number;
  /** По одному образцу ошибки на канал — обрезанные, без URL и токенов. */
  errorSamples: string[];
};

export type AlertSkipReason =
  | "disabled"
  | "no-notifier"
  | "no-attempts"
  | "streak-below-threshold"
  | "not-all-channels-down"
  | "streak-too-old"
  | "cooldown";

export type DeliveryAlertDecision =
  | { alert: true; health: DeliveryHealth }
  | { alert: false; reason: AlertSkipReason; health: DeliveryHealth };

/** Время, по которому задание сортируется в серии. */
function attemptTime(record: DeliveryRecord): number {
  return record.lastAttemptAt ?? record.sentAt ?? record.createdAt;
}

/** Задание, по которому была хотя бы одна попытка отправки. */
function wasAttempted(record: DeliveryRecord): boolean {
  return record.attempts > 0 || record.status !== "pending";
}

/**
 * Текст ошибки для алерта: одна строка, без URL, без длинных последовательностей
 * (похожих на токены) и без данных заявки.
 *
 * `lastError` каналов доставки — это чужой текст: Telegram возвращает тело
 * ответа API, Web3Forms — своё сообщение, сетевая ошибка — текст исключения.
 * Алерт уходит на внешний приёмник, поэтому вырезается всё лишнее: URL,
 * длинные последовательности (похожие на токены), а также телефон и email —
 * на случай, если канал вернул их в своём сообщении. Реализация одна
 * (`sanitizeAlertText`), и она же чистит ошибки самих приёмников алерта.
 */
export function sanitizeDeliveryError(raw?: string | null, max = 120): string {
  return sanitizeAlertText(raw, max);
}

/**
 * Считает состояние доставки по последним заданиям.
 *
 * Функция чистая: порядок строк на входе не важен (сортировка своя), время
 * передаётся аргументом. Именно поэтому её можно проверить на фикстурах без БД.
 */
export function computeDeliveryHealth(
  records: readonly DeliveryRecord[],
  config: DeliveryAlertConfig,
  now: number = Date.now()
): DeliveryHealth {
  const attempted = records
    .filter(wasAttempted)
    .sort((a, b) => attemptTime(b) - attemptTime(a) || b.id - a.id);

  const streakRows: DeliveryRecord[] = [];
  for (const record of attempted) {
    if (record.status !== "failed") break;
    streakRows.push(record);
  }

  const cutoff = now - config.windowMs;
  const inWindow = attempted.filter((record) => attemptTime(record) > cutoff);

  const streakChannels: DeliveryChannel[] = [];
  const stuckLeadIds = new Set<number>();
  const errorSamples: string[] = [];

  for (const record of streakRows) {
    if (!streakChannels.includes(record.channel)) streakChannels.push(record.channel);
    stuckLeadIds.add(record.leadId);
    if (!errorSamples.some((sample) => sample.startsWith(`${record.channel}:`))) {
      errorSamples.push(`${record.channel}: ${sanitizeDeliveryError(record.lastError)}`);
    }
  }

  return {
    streak: streakRows.length,
    streakChannels,
    streakStartedAt:
      streakRows.length > 0 ? attemptTime(streakRows[streakRows.length - 1]) : null,
    streakEndsAt: streakRows.length > 0 ? attemptTime(streakRows[0]) : null,
    stuckLeads: stuckLeadIds.size,
    sentInWindow: inWindow.filter((record) => record.status === "sent").length,
    failuresInWindow: inWindow.filter((record) => record.status === "failed").length,
    errorSamples,
  };
}

/**
 * Решение: слать алерт или нет.
 *
 * Все внешние факторы (время, момент последнего алерта, настроенность канала)
 * приходят аргументами — проверка остаётся чистой и тестируемой без БД и сети.
 */
export function evaluateDeliveryHealth(
  records: readonly DeliveryRecord[],
  config: DeliveryAlertConfig,
  options: {
    now?: number;
    /** Момент последнего алерта, `null` — алертов ещё не было. */
    lastAlertAt?: number | null;
    /** Настроен ли хотя бы один независимый приёмник. */
    notifierConfigured?: boolean;
  } = {}
): DeliveryAlertDecision {
  const now = options.now ?? Date.now();
  const health = computeDeliveryHealth(records, config, now);

  if (!config.enabled) return { alert: false, reason: "disabled", health };
  if (options.notifierConfigured === false) {
    return { alert: false, reason: "no-notifier", health };
  }
  if (health.streak === 0) return { alert: false, reason: "no-attempts", health };
  if (health.streak < config.threshold) {
    return { alert: false, reason: "streak-below-threshold", health };
  }

  // Оба канала (а не «какие-то два»): если почта работает, владелец получит
  // заявку, и будить его из-за одного лежащего бота — шум, а не сигнал.
  const missing = config.channels.filter((channel) => !health.streakChannels.includes(channel));
  if (missing.length > 0) return { alert: false, reason: "not-all-channels-down", health };

  // Серия, начавшаяся раньше окна наблюдения, — это уже не «сломалось сейчас»:
  // про неё либо алертили, либо она тянется с прошлого инцидента.
  if (health.streakStartedAt !== null && health.streakStartedAt < now - config.windowMs) {
    return { alert: false, reason: "streak-too-old", health };
  }

  const lastAlertAt = options.lastAlertAt ?? null;
  if (lastAlertAt !== null && now - lastAlertAt < config.cooldownMs) {
    return { alert: false, reason: "cooldown", health };
  }

  return { alert: true, health };
}

/** Дата в Москве — время в алерте должно совпадать с часами владельца. */
function formatMoscow(timestamp: number): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(timestamp))
    .replace(", ", " ");
}

/**
 * Текст уведомления.
 *
 * Намеренно БЕЗ персональных данных: ни телефона, ни имени, ни состава заказа.
 * Алерт уходит на внешний сервис, который не входит в контур обработки
 * персональных данных сайта (в отличие от Telegram-бота заявок, о котором
 * человек предупреждён в политике). В тексте — счётчики, каналы, время и
 * обрезанные ошибки: этого достаточно, чтобы понять масштаб и причину.
 */
export function buildDeliveryAlertMessage(
  health: DeliveryHealth,
  options: { config: DeliveryAlertConfig; trigger: string; now?: number }
): string {
  const now = options.now ?? Date.now();
  const { config } = options;
  const windowMin = Math.round(config.windowMs / 60_000);

  const lines = [
    `Доставка заявок не работает: ${health.streak} попыток подряд во все каналы упали.`,
    "",
    `Каналы: ${health.streakChannels.join(", ")}`,
    `Заявок в серии: ${health.stuckLeads}`,
    `Успешных отправок за последние ${windowMin} мин: ${health.sentInWindow}`,
  ];

  if (health.streakStartedAt !== null) {
    lines.push(`Серия началась: ${formatMoscow(health.streakStartedAt)} (МСК)`);
  }
  lines.push(`Проверка: ${formatMoscow(now)} (МСК), источник — ${options.trigger}`);

  if (health.errorSamples.length > 0) {
    lines.push("", "Ошибки каналов:");
    for (const sample of health.errorSamples.slice(0, config.channels.length)) {
      lines.push(`  • ${sample}`);
    }
  }

  lines.push(
    "",
    "Заявки сохранены в БД и будут повторно отправлены кроном /api/lead/retry, но сейчас их никто не видит.",
    "Проверьте TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID и WEB3FORMS_ACCESS_KEY."
  );

  return lines.join("\n");
}

export type DeliveryAlertOutcome =
  | { alerted: false; reason: AlertSkipReason | "error"; detail?: string }
  | { alerted: true; deliveredVia: string | null; transports: AlertSendResult[] };

let warnedNoNotifier = false;

/**
 * Проверить состояние доставки и отправить алерт, если каналы лежат.
 *
 * Вызывается из двух мест: после отправки заявки (когда упал хотя бы один
 * канал) и в конце крона ретраев. Функция НЕ БРОСАЕТ исключений и не влияет на
 * ответ пользователю: заявка уже сохранена, а сломанный вебхук алерта не
 * должен превращаться в 500 на денежном пути.
 */
export async function maybeAlertDeliveryDegradation(
  store: LeadStore,
  options: {
    trigger?: string;
    now?: number;
    fetchImpl?: typeof fetch;
    env?: Env;
  } = {}
): Promise<DeliveryAlertOutcome> {
  const trigger = options.trigger ?? "unknown";

  try {
    const env = options.env ?? getEnv();
    const config = resolveDeliveryAlertConfig(env);

    if (!config.enabled) return { alerted: false, reason: "disabled" };

    const transports = resolveAlertTransports(env);
    const rows = await store.listRecentDeliveries(config.lookback);
    const lastAlert = await store.findLastDeliveryAlert();

    const decision = evaluateDeliveryHealth(rows, config, {
      now: options.now,
      lastAlertAt: lastAlert?.createdAt ?? null,
      notifierConfigured: transports.length > 0,
    });

    if (!decision.alert) {
      // Канал не настроен — единственная причина, о которой стоит сказать вслух:
      // иначе деградация молча не алертится, и это выглядит как «всё работает».
      if (decision.reason === "no-notifier" && decision.health.streak > 0 && !warnedNoNotifier) {
        warnedNoNotifier = true;
        console.warn(
          `[delivery-alert] ${decision.health.streak} неудачных попыток доставки подряд, ` +
            "но канал алерта не настроен (DELIVERY_ALERT_WEBHOOK_URL или " +
            "DELIVERY_ALERT_TELEGRAM_BOT_TOKEN/CHAT_ID) — уведомление не отправлено."
        );
      }
      return { alerted: false, reason: decision.reason };
    }

    const { health } = decision;
    const message = buildDeliveryAlertMessage(health, { config, trigger, now: options.now });
    const results = await sendDeliveryAlert(message, { fetchImpl: options.fetchImpl, env });
    const delivered = results.find((result) => result.ok);
    const failures = results
      .filter((result) => !result.ok)
      .map((result) => `${result.transport}: ${result.error ?? "неизвестная ошибка"}`)
      .join("; ");

    // Запись пишется и при неудачной отправке: иначе сломанный приёмник дал бы
    // новый алерт на каждом прогоне крона — шторм вместо сигнала.
    await store.recordDeliveryAlert({
      trigger,
      streak: health.streak,
      failures: health.failuresInWindow,
      channels: health.streakChannels.join("+"),
      windowMinutes: Math.round(config.windowMs / 60_000),
      message,
      deliveredVia: delivered?.transport ?? null,
      lastError: delivered ? null : failures || null,
      oldestFailureAt: health.streakStartedAt,
    });

    if (!delivered) {
      console.error(
        `[delivery-alert] алерт о сбое доставки НЕ доставлен (${failures || "приёмники не ответили"}): ` +
          `${health.streak} неудачных попыток подряд в каналы ${health.streakChannels.join(", ")}`
      );
      return { alerted: true, deliveredVia: null, transports: results };
    }

    console.warn(
      `[delivery-alert] отправлен алерт через ${delivered.transport}: ` +
        `${health.streak} неудачных попыток подряд, заявок в серии ${health.stuckLeads}`
    );
    return { alerted: true, deliveredVia: delivered.transport, transports: results };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[delivery-alert] проверка не выполнена:", detail);
    return { alerted: false, reason: "error", detail };
  }
}

/** Только для тестов: разрешить повторное предупреждение о ненастроенном канале. */
export function resetDeliveryAlertWarningsForTests(): void {
  warnedNoNotifier = false;
}
