/**
 * PT-015 · Интеграционные тесты алерта о сбоях доставки с настоящей БД.
 *
 * Проверяется то, что нельзя проверить на in-memory реализации:
 *  - колонка `last_attempt_at` и сортировка серии по времени ПОПЫТКИ (не создания);
 *  - журнал `delivery_alerts` как хранилище охлаждения — оно обязано переживать
 *    рестарт контейнера, иначе «не чаще раза в час» не работает;
 *  - что в записанном тексте алерта нет персональных данных реальной заявки.
 *
 * Пропускается без `TEST_DATABASE_URL` (правило 7 раздела 2 ТЗ: наружу — ни
 * одного реального запроса, приёмник алерта подменяется).
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { DELIVERY_CHANNELS } from "@/lib/lead/deliver-all";
import { maybeAlertDeliveryDegradation } from "@/lib/lead/delivery-alert";
import { resetEnvCache } from "@/lib/env";
import type { LeadPayload } from "@/lib/lead/schema";
import type { LeadStore } from "@/lib/lead/store-types";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const PHONE = "+79161234567";

function payload(): LeadPayload {
  return {
    leadKind: "calculator",
    orderIntent: "ceiling_only",
    name: "Иван",
    phone: PHONE,
    source: "home:hero",
    placement: "modal",
    attribution: {},
  } as LeadPayload;
}

/**
 * Пауза между попытками. `recordDelivery` ставит время сам, с точностью до
 * миллисекунды; без паузы несколько строк получают одинаковое время, и порядок
 * серии начинает зависеть от id — тест проверял бы не то, что нужно.
 */
function tick(ms = 4): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Фейковый приёмник алерта: пишет вызовы, отвечает тем, что скажет тест. */
function fakeWebhook(status = 200) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
    return new Response(status === 200 ? "" : "boom", { status });
  }) as unknown as typeof fetch;

  return { impl, calls };
}

describe.skipIf(!TEST_DATABASE_URL)("PT-015 · алерт о сбоях доставки на PostgreSQL", () => {
  let store: LeadStore;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    const { PgLeadStore } = await import("@/lib/lead/store-pg");
    const { getDb } = await import("@/db");
    const { deliveryAlerts, leadDeliveries, leads } = await import("@/db/schema");

    const db = getDb(TEST_DATABASE_URL as string);
    await db.delete(deliveryAlerts);
    await db.delete(leadDeliveries);
    await db.delete(leads);

    store = new PgLeadStore(TEST_DATABASE_URL as string);

    process.env.DELIVERY_ALERT_ENABLED = "1";
    process.env.DELIVERY_ALERT_WEBHOOK_URL = "https://alerts.example/hook";
    process.env.DELIVERY_ALERT_THRESHOLD = "4";
    process.env.DELIVERY_ALERT_WINDOW_MIN = "30";
    process.env.DELIVERY_ALERT_COOLDOWN_MIN = "60";
    process.env.DELIVERY_ALERT_TELEGRAM_BOT_TOKEN = "";
    process.env.DELIVERY_ALERT_TELEGRAM_CHAT_ID = "";
    resetEnvCache();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEnvCache();
  });

  afterAll(async () => {
    const { closeDb } = await import("@/db");
    await closeDb();
  });

  /** Заявка с заданиями доставки и двумя упавшими попытками. */
  async function failedLead(error = "network error") {
    const lead = await store.createLeadWithDeliveries(
      { status: "new", payload: payload(), grandTotal: 44000 },
      DELIVERY_CHANNELS
    );
    for (const channel of DELIVERY_CHANNELS) {
      await store.recordDelivery(lead.id, channel, "failed", error);
      await tick();
    }
    return lead;
  }

  it("до первой попытки last_attempt_at пустой, после — заполнен", async () => {
    const lead = await store.createLeadWithDeliveries(
      { status: "new", payload: payload(), grandTotal: 44000 },
      DELIVERY_CHANNELS
    );

    const fresh = await store.listRecentDeliveries(10);
    expect(fresh).toHaveLength(2);
    // Фаза expand: у существующих (и ещё не отправленных) строк значения нет.
    expect(fresh.every((row) => row.lastAttemptAt === undefined)).toBe(true);

    await store.recordDelivery(lead.id, "telegram", "failed", "HTTP 500");
    const afterAttempt = await store.listRecentDeliveries(10);
    const telegram = afterAttempt.find((row) => row.channel === "telegram");

    expect(telegram?.attempts).toBe(1);
    expect(telegram?.lastAttemptAt).toBeGreaterThan(Date.now() - 60_000);
    // Вторая попытка обновляет строку на месте и двигает время.
    await store.recordDelivery(lead.id, "telegram", "failed", "HTTP 500");
    const second = (await store.listRecentDeliveries(10)).find((r) => r.channel === "telegram");
    expect(second?.attempts).toBe(2);
    expect(second?.id).toBe(telegram?.id);
    expect(second?.lastAttemptAt).toBeGreaterThanOrEqual(telegram?.lastAttemptAt as number);
  });

  it("серия читается по времени последней попытки: ретрай старого задания поднимается наверх", async () => {
    const old = await failedLead("старый сбой");
    const recent = await failedLead("свежий сбой");

    let rows = await store.listRecentDeliveries(10);
    expect(rows.slice(0, 2).map((row) => row.leadId)).toEqual([recent.id, recent.id]);

    // Крон повторно отправил СТАРОЕ задание — оно стало самой свежей попыткой.
    await tick();
    await store.recordDelivery(old.id, "telegram", "failed", "старый сбой");

    rows = await store.listRecentDeliveries(10);
    expect(rows[0].leadId).toBe(old.id);
    expect(rows[0].channel).toBe("telegram");
    expect(rows[0].attempts).toBe(2);
  });

  it("журнал алертов пишет и отдаёт последнюю запись", async () => {
    const oldest = Date.now() - 5 * 60_000;

    await store.recordDeliveryAlert({
      trigger: "lead",
      streak: 4,
      failures: 4,
      channels: "telegram+web3forms",
      windowMinutes: 30,
      message: "первый алерт",
      deliveredVia: "webhook",
      lastError: null,
      oldestFailureAt: oldest,
    });
    await store.recordDeliveryAlert({
      trigger: "retry-cron",
      streak: 6,
      failures: 5,
      channels: "telegram+web3forms",
      windowMinutes: 30,
      message: "второй алерт",
      deliveredVia: null,
      lastError: "webhook: HTTP 502",
      oldestFailureAt: null,
    });

    const last = await store.findLastDeliveryAlert();
    expect(last?.message).toBe("второй алерт");
    expect(last?.trigger).toBe("retry-cron");
    expect(last?.streak).toBe(6);
    expect(last?.deliveredVia).toBeNull();
    expect(last?.lastError).toBe("webhook: HTTP 502");
    expect(last?.oldestFailureAt).toBeNull();
    expect(last?.createdAt).toBeGreaterThan(Date.now() - 60_000);
  });

  it("оба канала упали N раз подряд — алерт отправлен и записан в журнал", async () => {
    await failedLead("HTTP 500");
    await failedLead("HTTP 500");
    const { impl, calls } = fakeWebhook();

    const outcome = await maybeAlertDeliveryDegradation(store, {
      trigger: "retry-cron",
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: true, deliveredVia: "webhook" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://alerts.example/hook");
    expect(String(calls[0].body.text)).toContain("4 попыток подряд");
    // Персональные данные заявки не уходят на внешний приёмник.
    expect(String(calls[0].body.text)).not.toContain(PHONE);
    expect(String(calls[0].body.text)).not.toContain("Иван");

    const logged = await store.findLastDeliveryAlert();
    expect(logged?.channels.split("+").sort()).toEqual(["telegram", "web3forms"]);
    expect(logged?.deliveredVia).toBe("webhook");
    expect(logged?.lastError).toBeNull();
    expect(logged?.message).not.toContain(PHONE);
  });

  it("охлаждение хранится в БД и переживает новый экземпляр хранилища", async () => {
    await failedLead("HTTP 500");
    await failedLead("HTTP 500");
    const { impl, calls } = fakeWebhook();

    await maybeAlertDeliveryDegradation(store, { trigger: "lead", fetchImpl: impl });

    // Рестарт контейнера: другой экземпляр хранилища, память процесса пуста.
    const { PgLeadStore } = await import("@/lib/lead/store-pg");
    const restarted = new PgLeadStore(TEST_DATABASE_URL as string);

    const second = await maybeAlertDeliveryDegradation(restarted, {
      trigger: "retry-cron",
      fetchImpl: impl,
    });

    expect(second).toMatchObject({ alerted: false, reason: "cooldown" });
    expect(calls).toHaveLength(1);

    const { getDb } = await import("@/db");
    const { deliveryAlerts } = await import("@/db/schema");
    const rows = await getDb(TEST_DATABASE_URL as string).select().from(deliveryAlerts);
    expect(rows).toHaveLength(1);
  });

  it("приёмник алерта отказал — запись всё равно есть, шторма нет", async () => {
    await failedLead("HTTP 500");
    await failedLead("HTTP 500");
    const { impl, calls } = fakeWebhook(502);

    const first = await maybeAlertDeliveryDegradation(store, { trigger: "lead", fetchImpl: impl });
    const second = await maybeAlertDeliveryDegradation(store, {
      trigger: "retry-cron",
      fetchImpl: impl,
    });

    expect(first).toMatchObject({ alerted: true, deliveredVia: null });
    expect(second).toMatchObject({ alerted: false, reason: "cooldown" });
    // Ровно один запрос наружу: охлаждение срабатывает ДО отправки, поэтому
    // сломанный приёмник не получает по запросу на каждый прогон крона.
    expect(calls).toHaveLength(1);

    const logged = await store.findLastDeliveryAlert();
    expect(logged?.deliveredVia).toBeNull();
    expect(logged?.lastError).toContain("webhook: HTTP 502");
  });

  it("один упавший канал — алерта нет: второй канал заявки доставляет", async () => {
    const leads = [];
    for (let i = 0; i < 4; i += 1) {
      leads.push(
        await store.createLeadWithDeliveries(
          { status: "new", payload: payload(), grandTotal: 44000 },
          DELIVERY_CHANNELS
        )
      );
    }
    // Почта отработала по всем заявкам раньше, чем Telegram начал падать:
    // четыре самые свежие попытки — telegram, и все неудачные.
    for (const lead of leads) {
      await store.recordDelivery(lead.id, "web3forms", "sent");
      await tick();
    }
    for (const lead of leads) {
      await store.recordDelivery(lead.id, "telegram", "failed", "HTTP 401");
      await tick();
    }
    const { impl, calls } = fakeWebhook();

    const outcome = await maybeAlertDeliveryDegradation(store, {
      trigger: "retry-cron",
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "not-all-channels-down" });
    expect(calls).toHaveLength(0);
    expect(await store.findLastDeliveryAlert()).toBeNull();
  });

  it("серия короче порога — алерта нет", async () => {
    await failedLead("HTTP 500");
    const { impl, calls } = fakeWebhook();

    const outcome = await maybeAlertDeliveryDegradation(store, {
      trigger: "lead",
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "streak-below-threshold" });
    expect(calls).toHaveLength(0);
  });

  it("флаг DELIVERY_ALERT_ENABLED=0 гасит проверку", async () => {
    await failedLead("HTTP 500");
    await failedLead("HTTP 500");
    process.env.DELIVERY_ALERT_ENABLED = "0";
    resetEnvCache();
    const { impl, calls } = fakeWebhook();

    const outcome = await maybeAlertDeliveryDegradation(store, {
      trigger: "retry-cron",
      fetchImpl: impl,
    });

    expect(outcome).toMatchObject({ alerted: false, reason: "disabled" });
    expect(calls).toHaveLength(0);
  });
});
