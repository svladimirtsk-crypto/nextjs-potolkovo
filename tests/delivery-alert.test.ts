/**
 * PT-015 · Алерт при систематических сбоях доставки.
 *
 * Проверяются три слоя:
 *  1. чистое решение — когда алерт срабатывает, а когда нет (порог, оба канала,
 *     окно, охлаждение, флаг);
 *  2. текст уведомления — что в нём есть и чего в нём быть не должно
 *     (персональные данные, URL, токены);
 *  3. отправка — что алерт уходит на независимый приёмник и что отказ приёмника
 *     не превращается в исключение на денежном пути.
 *
 * Реальная БД здесь не нужна: решение принимает чистая функция, а журнал
 * алертов проверяется на in-memory реализации того же контракта.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Внешние каналы доставки подменяются: правило 7 раздела 2 ТЗ — реальных
// запросов в Telegram/Web3Forms из тестов быть не должно.
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true as const })),
}));

import {
  ALERT_TIMEOUT_MS,
  resolveAlertTransports,
  sanitizeAlertError,
  sendDeliveryAlert,
} from "@/lib/lead/alert-notify";
import { DELIVERY_CHANNELS } from "@/lib/lead/deliver-all";
import {
  buildDeliveryAlertMessage,
  computeDeliveryHealth,
  evaluateDeliveryHealth,
  maybeAlertDeliveryDegradation,
  resetDeliveryAlertWarningsForTests,
  resolveDeliveryAlertConfig,
  sanitizeDeliveryError,
  type DeliveryAlertConfig,
} from "@/lib/lead/delivery-alert";
import { POST as postLead } from "@/app/api/lead/route";
import { POST as postRetry } from "@/app/api/lead/retry/route";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { InMemoryLeadStore, resetLeadStoreForTests, setLeadStoreForTests } from "@/lib/lead/store";
import type { LeadPayload } from "@/lib/lead/schema";
import type { DeliveryChannel, DeliveryRecord, DeliveryStatus } from "@/lib/lead/store-types";

/** Момент «сейчас» в тестах: фиксированный, чтобы окно и охлаждение были детерминированы. */
const NOW = Date.parse("2026-09-14T12:00:00.000Z");
const MIN = 60_000;

const CONFIG: DeliveryAlertConfig = {
  enabled: true,
  threshold: 4,
  windowMs: 30 * MIN,
  cooldownMs: 60 * MIN,
  lookback: 50,
  channels: DELIVERY_CHANNELS,
};

let seq = 100;

/** Задание доставки: время попытки по умолчанию — «только что». */
function row(
  channel: DeliveryChannel,
  status: DeliveryStatus,
  options: { agoMs?: number; leadId?: number; attempts?: number; lastError?: string } = {}
): DeliveryRecord {
  const at = NOW - (options.agoMs ?? 0);
  return {
    id: seq++,
    leadId: options.leadId ?? 1,
    channel,
    status,
    attempts: options.attempts ?? 1,
    lastError: options.lastError,
    sentAt: status === "sent" ? at : undefined,
    createdAt: at,
    lastAttemptAt: at,
  };
}

/** Две упавшие попытки одной заявки — типичный след «лежат оба канала». */
function failedLead(leadId: number, agoMs: number, error = "network error"): DeliveryRecord[] {
  return [
    row("telegram", "failed", { leadId, agoMs, lastError: error }),
    row("web3forms", "failed", { leadId, agoMs, lastError: error }),
  ];
}

/** Фейковый fetch: пишет вызовы и отвечает тем, что скажет тест. */
function fakeFetch(
  responder: (url: string, init: RequestInit) => Response = () => new Response("", { status: 200 })
) {
  const calls: { url: string; body: Record<string, unknown> | undefined; init: RequestInit }[] = [];
  const impl = (async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String((input as Request).url ?? input);
    let body: Record<string, unknown> | undefined;
    try {
      body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    } catch {
      body = undefined;
    }
    calls.push({ url, body, init: init ?? {} });
    return responder(url, init ?? {});
  }) as unknown as typeof fetch;

  return { impl, calls };
}

const ORIGINAL_ENV = { ...process.env };

function withEnv(patch: Record<string, string | undefined>) {
  resetEnvCache();
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  resetDeliveryAlertWarningsForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  resetEnvCache();
  vi.restoreAllMocks();
});

describe("PT-015 · решение об алерте", () => {
  it("N подряд неудач в оба канала — алерт", () => {
    const rows = [...failedLead(1, 0), ...failedLead(2, 2 * MIN)];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision.alert).toBe(true);
    if (decision.alert) {
      expect(decision.health.streak).toBe(4);
      expect(decision.health.streakChannels.sort()).toEqual(["telegram", "web3forms"]);
      expect(decision.health.stuckLeads).toBe(2);
    }
  });

  it("серия короче порога — молчим: одна неудачная заявка ещё не сбой", () => {
    const rows = [...failedLead(1, 0), row("telegram", "failed", { leadId: 2, agoMs: MIN })];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision).toMatchObject({ alert: false, reason: "streak-below-threshold" });
  });

  it("успешная отправка обнуляет серию", () => {
    const rows = [
      row("telegram", "sent", { leadId: 9, agoMs: 0 }),
      ...failedLead(1, MIN),
      ...failedLead(2, 2 * MIN),
    ];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision.alert).toBe(false);
    if (!decision.alert) {
      expect(decision.health.streak).toBe(0);
      expect(decision.reason).toBe("no-attempts");
    }
  });

  it("успех в середине ряда обрезает серию до попыток после него", () => {
    const rows = [
      ...failedLead(1, 0),
      ...failedLead(2, MIN),
      row("web3forms", "sent", { leadId: 3, agoMs: 2 * MIN }),
      ...failedLead(3, 3 * MIN),
      ...failedLead(4, 4 * MIN),
    ];

    const health = computeDeliveryHealth(rows, CONFIG, NOW);

    expect(health.streak).toBe(4);
    expect(health.stuckLeads).toBe(2);
  });

  it("лежит только один канал — не алерт: заявки доходят почтой", () => {
    // Почта отработала раньше, затем четыре попытки Telegram подряд упали:
    // серия длинная, но второй канал жив, значит владелец заявки получает.
    const rows = [
      row("telegram", "failed", { leadId: 4, agoMs: 0 }),
      row("telegram", "failed", { leadId: 3, agoMs: MIN }),
      row("telegram", "failed", { leadId: 2, agoMs: 2 * MIN }),
      row("telegram", "failed", { leadId: 1, agoMs: 3 * MIN }),
      row("web3forms", "sent", { leadId: 4, agoMs: 4 * MIN }),
      row("web3forms", "sent", { leadId: 3, agoMs: 5 * MIN }),
      row("web3forms", "sent", { leadId: 2, agoMs: 6 * MIN }),
      row("web3forms", "sent", { leadId: 1, agoMs: 7 * MIN }),
    ];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision).toMatchObject({ alert: false, reason: "not-all-channels-down" });
  });

  it("серия началась раньше окна наблюдения — это старый инцидент", () => {
    const rows = [
      ...failedLead(1, 5 * MIN),
      ...failedLead(2, 40 * MIN),
      ...failedLead(3, 41 * MIN),
    ];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision).toMatchObject({ alert: false, reason: "streak-too-old" });
  });

  it("охлаждение: второй алерт в пределах часа не отправляется", () => {
    const rows = [...failedLead(1, 0), ...failedLead(2, MIN)];
    const options = { now: NOW, notifierConfigured: true, lastAlertAt: NOW - 10 * MIN };

    expect(evaluateDeliveryHealth(rows, CONFIG, options)).toMatchObject({
      alert: false,
      reason: "cooldown",
    });

    // Тот же ряд, но прошлый алерт был больше часа назад — снова срабатывает.
    expect(
      evaluateDeliveryHealth(rows, CONFIG, { ...options, lastAlertAt: NOW - 61 * MIN }).alert
    ).toBe(true);
  });

  it("выключенный флаг гасит проверку целиком", () => {
    const rows = [...failedLead(1, 0), ...failedLead(2, MIN)];

    const decision = evaluateDeliveryHealth(rows, { ...CONFIG, enabled: false }, {
      now: NOW,
      notifierConfigured: true,
    });

    expect(decision).toMatchObject({ alert: false, reason: "disabled" });
  });

  it("канал алерта не настроен — отправлять некуда", () => {
    const rows = [...failedLead(1, 0), ...failedLead(2, MIN)];

    const decision = evaluateDeliveryHealth(rows, CONFIG, {
      now: NOW,
      notifierConfigured: false,
    });

    expect(decision).toMatchObject({ alert: false, reason: "no-notifier" });
  });

  it("пустая очередь доставки — не повод будить владельца", () => {
    expect(evaluateDeliveryHealth([], CONFIG, { now: NOW, notifierConfigured: true })).toMatchObject({
      alert: false,
      reason: "no-attempts",
    });
  });

  it("задание без попыток (pending) не рвёт серию", () => {
    const rows = [
      row("telegram", "pending", { leadId: 9, agoMs: 0, attempts: 0 }),
      row("web3forms", "pending", { leadId: 9, agoMs: 0, attempts: 0 }),
      ...failedLead(1, MIN),
      ...failedLead(2, 2 * MIN),
    ];

    const decision = evaluateDeliveryHealth(rows, CONFIG, { now: NOW, notifierConfigured: true });

    expect(decision.alert).toBe(true);
    if (decision.alert) expect(decision.health.streak).toBe(4);
  });

  it("порядок строк на входе не важен — серия считается по времени попытки", () => {
    const ordered = [...failedLead(1, 3 * MIN), ...failedLead(2, MIN), ...failedLead(3, 2 * MIN)];
    const shuffled = [ordered[3], ordered[0], ordered[5], ordered[2], ordered[4], ordered[1]];

    const a = computeDeliveryHealth(ordered, CONFIG, NOW);
    const b = computeDeliveryHealth(shuffled, CONFIG, NOW);

    expect(b.streak).toBe(a.streak);
    expect(b.streakStartedAt).toBe(a.streakStartedAt);
    expect(b.streakEndsAt).toBe(a.streakEndsAt);
  });

  it("ретрай старого задания входит в серию: сортировка по времени попытки, а не создания", () => {
    // Задание создано вчера, но попытка была минуту назад — именно так выглядит
    // затянувшийся сбой, который крон продолжает безуспешно ретраить.
    const stale: DeliveryRecord[] = [
      {
        id: 1,
        leadId: 1,
        channel: "telegram",
        status: "failed",
        attempts: 4,
        lastError: "HTTP 401",
        createdAt: NOW - 24 * 60 * MIN,
        lastAttemptAt: NOW - MIN,
      },
      {
        id: 2,
        leadId: 1,
        channel: "web3forms",
        status: "failed",
        attempts: 4,
        lastError: "HTTP 500",
        createdAt: NOW - 24 * 60 * MIN,
        lastAttemptAt: NOW - MIN,
      },
    ];
    const fresh = failedLead(2, 0);

    const health = computeDeliveryHealth([...stale, ...fresh], CONFIG, NOW);

    expect(health.streak).toBe(4);
    // Начало серии — самое старое время ПОПЫТКИ (минута назад), не создания.
    expect(health.streakStartedAt).toBe(NOW - MIN);
  });

  it("считает успехи и неудачи внутри окна наблюдения", () => {
    const rows = [
      ...failedLead(1, 0),
      ...failedLead(2, MIN),
      row("telegram", "sent", { leadId: 3, agoMs: 5 * MIN }),
      row("telegram", "failed", { leadId: 4, agoMs: 90 * MIN }),
    ];

    const health = computeDeliveryHealth(rows, CONFIG, NOW);

    expect(health.failuresInWindow).toBe(4);
    expect(health.sentInWindow).toBe(1);
  });

  it("порог настраивается: threshold=2 срабатывает на одной заявке", () => {
    const rows = failedLead(1, 0);

    expect(
      evaluateDeliveryHealth(rows, { ...CONFIG, threshold: 2 }, {
        now: NOW,
        notifierConfigured: true,
      }).alert
    ).toBe(true);
  });
});

describe("PT-015 · конфигурация из окружения", () => {
  it("значения по умолчанию и перевод минут в миллисекунды", () => {
    withEnv({});

    const config = resolveDeliveryAlertConfig();

    expect(config).toMatchObject({
      enabled: true,
      threshold: 4,
      windowMs: 30 * MIN,
      cooldownMs: 60 * MIN,
      lookback: 50,
    });
    expect(config.channels).toEqual(["telegram", "web3forms"]);
  });

  it("приёмники: вебхук, второй бот, оба или ни одного", () => {
    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: undefined,
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: undefined,
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: undefined,
    });
    expect(resolveAlertTransports()).toEqual([]);

    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    expect(resolveAlertTransports()).toEqual(["webhook"]);

    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: undefined,
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot",
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: "-100500",
    });
    expect(resolveAlertTransports()).toEqual(["telegram-alert"]);

    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook",
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot",
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: "-100500",
    });
    expect(resolveAlertTransports()).toEqual(["webhook", "telegram-alert"]);
  });
});

describe("PT-015 · текст алерта", () => {
  const health = computeDeliveryHealth([...failedLead(1, 0), ...failedLead(2, MIN)], CONFIG, NOW);

  it("сообщает масштаб, каналы, время и причину", () => {
    const message = buildDeliveryAlertMessage(health, { config: CONFIG, trigger: "retry-cron", now: NOW });

    expect(message).toContain("4 попыток подряд");
    expect(message).toContain("telegram");
    expect(message).toContain("web3forms");
    expect(message).toContain("Заявок в серии: 2");
    expect(message).toContain("retry-cron");
    expect(message).toContain("МСК");
    expect(message).toContain("/api/lead/retry");
  });

  it("не содержит персональных данных и секретов", () => {
    const rows = [
      row("telegram", "failed", {
        leadId: 1,
        agoMs: 0,
        lastError:
          'HTTP 401 {"description":"bot 123456:AAEhBP-secret-token-value-abcdef0123456789 rejected"} ' +
          "https://api.telegram.org/botAAAABBBBCCCCDDDDEEEEFFFFGGGG/sendMessage +7 916 123-45-67",
      }),
      row("web3forms", "failed", { leadId: 1, agoMs: 0, lastError: "network error" }),
      ...failedLead(2, MIN),
    ];

    const message = buildDeliveryAlertMessage(computeDeliveryHealth(rows, CONFIG, NOW), {
      config: CONFIG,
      trigger: "lead",
      now: NOW,
    });

    expect(message).not.toContain("https://api.telegram.org");
    expect(message).not.toContain("AAAABBBBCCCC");
    expect(message).not.toContain("+7 916");
    // Каналы и сама фактура отказа при этом остаются.
    expect(message).toContain("telegram:");
    expect(message).toContain("network error");
  });

  it("ошибка канала обрезается и чистится", () => {
    expect(sanitizeDeliveryError("  HTTP\n500   oops ")).toBe("HTTP 500 oops");
    expect(sanitizeDeliveryError("см. https://example.com/hook?a=1")).toBe("см. [url]");
    expect(sanitizeDeliveryError("ключ AAEhBPsecretTokenValue1234567890xx не принят")).toBe(
      "ключ [скрыто] не принят"
    );
    // Длинный текст обрезается…
    expect(sanitizeDeliveryError("ошибка доставки ".repeat(30))).toHaveLength(120);
    // …а длинная последовательность без пробелов похожа на секрет и скрывается
    // целиком, а не частично: обрывок токена в журнале не лучше целого.
    expect(sanitizeDeliveryError("x".repeat(200))).toBe("[скрыто]");
    expect(sanitizeDeliveryError("")).toBe("без описания");
    // Телефон и почта не должны уехать на внешний приёмник.
    expect(sanitizeDeliveryError("отказ при отправке на +7 916 123-45-67")).not.toContain("916");
    expect(sanitizeDeliveryError("контакт ivan@example.com недоступен")).not.toContain("ivan@");
    expect(sanitizeDeliveryError(undefined)).toBe("без описания");
  });

  it("sanitizeAlertError чистит текст исключения", () => {
    expect(sanitizeAlertError(new Error("fetch failed https://hooks.example/abc"))).toBe(
      "fetch failed [url]"
    );
    expect(sanitizeAlertError(null)).toBe("без описания");
  });
});

describe("PT-015 · отправка на независимый приёмник", () => {
  it("вебхук получает JSON с текстом алерта", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const { impl, calls } = fakeFetch();

    const results = await sendDeliveryAlert("каналы лежат", { fetchImpl: impl });

    expect(results).toEqual([{ transport: "webhook", ok: true }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://alerts.example/hook");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].body).toMatchObject({ kind: "delivery_degraded", text: "каналы лежат" });
    expect(ALERT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("второй Telegram-бот — отдельный токен, не бот заявок", async () => {
    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: undefined,
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot-token",
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: "-100500",
      TELEGRAM_BOT_TOKEN: "leads-bot-token",
      TELEGRAM_CHAT_ID: "111",
    });
    const { impl, calls } = fakeFetch();

    const results = await sendDeliveryAlert("каналы лежат", { fetchImpl: impl });

    expect(results).toEqual([{ transport: "telegram-alert", ok: true }]);
    expect(calls[0].url).toBe("https://api.telegram.org/botalert-bot-token/sendMessage");
    expect(calls[0].body).toMatchObject({ chat_id: "-100500", text: "каналы лежат" });
    expect(calls[0].url).not.toContain("leads-bot-token");
  });

  it("пробует оба приёмника, даже если первый отказал", async () => {
    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook",
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: "alert-bot",
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: "-100500",
    });
    const { impl, calls } = fakeFetch((url) =>
      url.includes("alerts.example") ? new Response("boom", { status: 500 }) : new Response("{}", { status: 200 })
    );

    const results = await sendDeliveryAlert("текст", { fetchImpl: impl });

    expect(calls).toHaveLength(2);
    expect(results).toEqual([
      { transport: "webhook", ok: false, error: "HTTP 500" },
      { transport: "telegram-alert", ok: true },
    ]);
  });

  it("сетевое исключение — отказ с очищенным текстом, не брошенное исключение", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const { impl } = fakeFetch(() => {
      throw new Error("fetch failed https://alerts.example/hook");
    });

    const results = await sendDeliveryAlert("текст", { fetchImpl: impl });

    expect(results).toEqual([{ transport: "webhook", ok: false, error: "fetch failed [url]" }]);
  });

  it("ничего не настроено — сетевых вызовов нет вовсе", async () => {
    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: undefined,
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: undefined,
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: undefined,
    });
    const { impl, calls } = fakeFetch();

    expect(await sendDeliveryAlert("текст", { fetchImpl: impl })).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("вебхук не http(s) — отказ без запроса", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "ftp://alerts.example/hook" });
    const { impl, calls } = fakeFetch();

    const results = await sendDeliveryAlert("текст", { fetchImpl: impl });

    expect(calls).toHaveLength(0);
    expect(results[0]).toMatchObject({ ok: false });
  });
});

describe("PT-015 · проверка на хранилище (полный цикл)", () => {
  /**
   * Хранилище ставит время попытки само (`Date.now()`), поэтому подменяются
   * только часы — между записями время двигается на секунду. Без этого все
   * попытки попадают в одну миллисекунду и их порядок становится произвольным.
   */
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW - 10_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const store = () => new InMemoryLeadStore();

  async function withFailedDelivery(
    target: InMemoryLeadStore,
    leads: number
  ): Promise<void> {
    for (let i = 1; i <= leads; i += 1) {
      await target.recordDelivery(i, "telegram", "failed", "HTTP 500");
      vi.advanceTimersByTime(1_000);
      await target.recordDelivery(i, "web3forms", "failed", "network error");
      vi.advanceTimersByTime(1_000);
    }
  }

  it("серия из двух заявок — алерт отправлен и записан в журнал", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    await withFailedDelivery(target, 2);
    const { impl, calls } = fakeFetch();

    const outcome = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW,
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: true, deliveredVia: "webhook" });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].body?.text)).toContain("4 попыток подряд");

    const logged = await target.findLastDeliveryAlert();
    expect(logged).toMatchObject({
      trigger: "retry-cron",
      streak: 4,
      failures: 4,
      windowMinutes: 30,
      deliveredVia: "webhook",
      lastError: null,
    });
    // Порядок каналов в строке зависит от сортировки — сравниваем как множество.
    expect(logged?.channels.split("+").sort()).toEqual(["telegram", "web3forms"]);
    expect(logged?.message).toContain("4 попыток подряд");
    expect(logged?.oldestFailureAt).not.toBeNull();
  });

  it("повторная проверка в пределах охлаждения — второго алерта нет", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    await withFailedDelivery(target, 2);
    const { impl, calls } = fakeFetch();

    await maybeAlertDeliveryDegradation(target, { trigger: "lead", now: NOW, fetchImpl: impl });
    const second = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW + 5 * MIN,
      fetchImpl: impl,
    });

    expect(second).toMatchObject({ alerted: false, reason: "cooldown" });
    expect(calls).toHaveLength(1);
  });

  it("все приёмники отказали — запись в журнале всё равно есть (иначе шторм)", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    await withFailedDelivery(target, 2);
    const { impl } = fakeFetch(() => new Response("down", { status: 502 }));

    const outcome = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW,
      fetchImpl: impl,
    });
    const second = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW + MIN,
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: true, deliveredVia: null });
    const logged = await target.findLastDeliveryAlert();
    expect(logged?.deliveredVia).toBeNull();
    expect(logged?.lastError).toContain("webhook: HTTP 502");
    // Охлаждение считается и по неудачной отправке.
    expect(second).toMatchObject({ alerted: false, reason: "cooldown" });
  });

  it("доставка работает — алерта нет и запросов наружу нет", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    await target.recordDelivery(1, "telegram", "sent");
    await target.recordDelivery(1, "web3forms", "sent");
    const { impl, calls } = fakeFetch();

    const outcome = await maybeAlertDeliveryDegradation(target, {
      trigger: "lead",
      now: NOW,
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "no-attempts" });
    expect(calls).toHaveLength(0);
  });

  it("лежит один канал — алерта нет", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    // Сначала почта отправила все три заявки, затем Telegram четыре раза упал.
    for (let i = 1; i <= 3; i += 1) {
      await target.recordDelivery(i, "web3forms", "sent");
      vi.advanceTimersByTime(1_000);
    }
    for (let i = 1; i <= 4; i += 1) {
      await target.recordDelivery(i, "telegram", "failed", "HTTP 401");
      vi.advanceTimersByTime(1_000);
    }
    const { impl, calls } = fakeFetch();

    const outcome = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW,
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "not-all-channels-down" });
    expect(calls).toHaveLength(0);
  });

  it("флаг выключен — хранилище вообще не опрашивается", async () => {
    withEnv({ DELIVERY_ALERT_ENABLED: "0", DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    await withFailedDelivery(target, 2);
    const spy = vi.spyOn(target, "listRecentDeliveries");
    const { impl, calls } = fakeFetch();

    const outcome = await maybeAlertDeliveryDegradation(target, {
      trigger: "retry-cron",
      now: NOW,
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "disabled" });
    expect(spy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("канал алерта не настроен — предупреждение в лог, записи в журнале нет", async () => {
    withEnv({
      DELIVERY_ALERT_WEBHOOK_URL: undefined,
      DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: undefined,
      DELIVERY_ALERT_TELEGRAM_CHAT_ID: undefined,
    });
    const target = store();
    await withFailedDelivery(target, 2);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const outcome = await maybeAlertDeliveryDegradation(target, { trigger: "lead", now: NOW });

    expect(outcome).toMatchObject({ alerted: false, reason: "no-notifier" });
    expect(warn.mock.calls.flat().join(" ")).toContain("канал алерта не настроен");
    expect(await target.findLastDeliveryAlert()).toBeNull();
  });

  it("сломанное хранилище не роняет вызывающий код", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    vi.spyOn(target, "listRecentDeliveries").mockRejectedValue(new Error("connection terminated"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const outcome = await maybeAlertDeliveryDegradation(target, { trigger: "lead", now: NOW });

    expect(outcome).toMatchObject({ alerted: false, reason: "error" });
    expect(error.mock.calls.flat().join(" ")).toContain("connection terminated");
  });

  it("алерт не содержит телефон заявителя, даже если он есть в ошибке канала", async () => {
    withEnv({ DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook" });
    const target = store();
    for (const entry of [
      [1, "telegram", "не удалось отправить +7 916 123-45-67 и на ivan@example.com"],
      [1, "web3forms", "не удалось отправить +7 916 123-45-67 и на ivan@example.com"],
      [2, "telegram", "HTTP 500"],
      [2, "web3forms", "HTTP 500"],
    ] as const) {
      await target.recordDelivery(entry[0], entry[1], "failed", entry[2]);
      vi.advanceTimersByTime(1_000);
    }
    const { impl, calls } = fakeFetch();

    await maybeAlertDeliveryDegradation(target, { trigger: "lead", now: NOW, fetchImpl: impl });

    const text = String(calls[0]?.body?.text ?? "");
    expect(text).not.toContain("+7 916");
    expect(text).not.toContain("ivan@example.com");
    expect(text).toContain("4 попыток подряд");
  });
});

describe("PT-015 · проверка встроена в оба места отправки", () => {
  const ALERT_ENV = {
    CRON_SECRET: "ci-secret",
    DATABASE_URL: undefined,
    LEAD_API_ENABLED: "1",
    DELIVERY_ALERT_WEBHOOK_URL: "https://alerts.example/hook",
    DELIVERY_ALERT_TELEGRAM_BOT_TOKEN: undefined,
    DELIVERY_ALERT_TELEGRAM_CHAT_ID: undefined,
  };

  function leadPayload(): LeadPayload {
    return {
      name: "Иван",
      phone: "+7 905 521 99 09",
      consent: true,
      source: "home",
      placement: "home",
      pagePath: "/",
      leadKind: "direct",
    } as unknown as LeadPayload;
  }

  /**
   * Роуты вызывают `sendDeliveryAlert` без инъекции `fetchImpl`, поэтому
   * подменяется глобальный `fetch`. Без этого алерт ушёл бы настоящим запросом
   * наружу — а правило 7 раздела 2 ТЗ запрещает сетевые вызовы в тестах.
   */
  function stubAlertWebhook(status = 200) {
    const { impl, calls } = fakeFetch(() => new Response(status === 200 ? "" : "boom", { status }));
    vi.stubGlobal("fetch", impl);
    return calls;
  }

  beforeEach(() => {
    vi.mocked(deliverToTelegram).mockReset();
    vi.mocked(deliverToWeb3Forms).mockReset();
    resetRateLimitForTests();
  });

  afterEach(() => {
    resetLeadStoreForTests();
    vi.unstubAllGlobals();
  });

  it("крон: серия неудач в оба канала — алерт отправлен, прежние поля ответа не изменились", async () => {
    withEnv(ALERT_ENV);
    vi.mocked(deliverToTelegram).mockResolvedValue({ ok: false, error: "HTTP 500" });
    vi.mocked(deliverToWeb3Forms).mockResolvedValue({ ok: false, error: "HTTP 502" });

    const target = new InMemoryLeadStore();
    setLeadStoreForTests(target);
    // Две заявки, у которых ни один канал не сработал: 4 попытки подряд.
    for (let i = 0; i < 2; i += 1) {
      await target.createLeadWithDeliveries(
        { status: "new", payload: leadPayload(), grandTotal: 0 },
        DELIVERY_CHANNELS
      );
    }
    /**
     * PT-020: задания рождаются арендованными — их отправляет приём заявки.
     * Этот тест моделирует «процесс умер до отправки», поэтому аренду снимаем:
     * иначе крон честно пройдёт мимо и алерту будет нечего считать.
     */
    target.releaseLeasesForTests();
    const calls = stubAlertWebhook();

    const response = await postRetry(
      new Request("http://localhost/api/lead/retry", {
        method: "POST",
        headers: { authorization: "Bearer ci-secret" },
      })
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ ok: true, retried: 4, sent: 0, failed: 4, recovered: 0 });
    expect(body.alert).toMatchObject({ fired: true, via: "webhook" });
    expect(calls).toHaveLength(1);
    expect(String((await target.findLastDeliveryAlert())?.trigger)).toBe("retry-cron");
  });

  it("крон без сбоев: доставка прошла — alert.fired=false с причиной", async () => {
    withEnv(ALERT_ENV);
    vi.mocked(deliverToTelegram).mockResolvedValue({ ok: true });
    vi.mocked(deliverToWeb3Forms).mockResolvedValue({ ok: true });

    const target = new InMemoryLeadStore();
    setLeadStoreForTests(target);
    await target.createLeadWithDeliveries(
      { status: "new", payload: leadPayload(), grandTotal: 0 },
      DELIVERY_CHANNELS
    );
    // PT-020: см. комментарий выше — крон берёт только освобождённые задания.
    target.releaseLeasesForTests();

    const response = await postRetry(
      new Request("http://localhost/api/lead/retry", {
        method: "POST",
        headers: { authorization: "Bearer ci-secret" },
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toMatchObject({ ok: true, retried: 2, sent: 2, failed: 0 });
    expect(body.alert).toMatchObject({ fired: false, reason: "no-attempts" });
    expect(await target.findLastDeliveryAlert()).toBeNull();
  });

  it("POST /api/lead: упавшая доставка запускает проверку, не задерживая ответ клиенту", async () => {
    withEnv({ ...ALERT_ENV, DELIVERY_ALERT_THRESHOLD: "2" });
    vi.mocked(deliverToTelegram).mockResolvedValue({ ok: false, error: "HTTP 500" });
    vi.mocked(deliverToWeb3Forms).mockResolvedValue({ ok: false, error: "network error" });

    const target = new InMemoryLeadStore();
    setLeadStoreForTests(target);
    const calls = stubAlertWebhook();

    const response = await postLead(
      new Request("http://localhost/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" },
        body: JSON.stringify(leadPayload()),
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, status: "queued" });

    // Доставка и проверка идут после ответа: ждём запись в журнале.
    await vi.waitFor(async () => {
      const logged = await target.findLastDeliveryAlert();
      expect(logged?.trigger).toBe("lead");
      expect(logged?.streak).toBe(2);
      expect(logged?.deliveredVia).toBe("webhook");
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://alerts.example/hook");
    expect(String(calls[0].body?.text)).toContain("2 попыток подряд");
    // Персональные данные заявки на внешний приёмник не уходят.
    expect(String(calls[0].body?.text)).not.toContain("905 521");
  });

  it("POST /api/lead: доставка прошла — проверки алерта не происходит", async () => {
    withEnv({ ...ALERT_ENV, DELIVERY_ALERT_THRESHOLD: "2" });
    vi.mocked(deliverToTelegram).mockResolvedValue({ ok: true });
    vi.mocked(deliverToWeb3Forms).mockResolvedValue({ ok: true });

    const target = new InMemoryLeadStore();
    setLeadStoreForTests(target);
    const calls = stubAlertWebhook();
    const spy = vi.spyOn(target, "listRecentDeliveries");

    const response = await postLead(
      new Request("http://localhost/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.78" },
        body: JSON.stringify(leadPayload()),
      })
    );

    expect(response.status).toBe(201);
    // Даём fire-and-forget цепочке завершиться.
    await vi.waitFor(() => expect(spy).not.toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(spy).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(await target.findLastDeliveryAlert()).toBeNull();
  });
});
