/**
 * PT-020 (A-13, F-14 · T-326) · Интеграция: настоящая БД + фейковый HTTP доставки.
 *
 * Что здесь проверяется и почему этого не было раньше:
 *
 * 1. **Транзакционность аутбокса (PT-003).** `createLeadWithDeliveries` обещает,
 *    что заявка и задания на доставку появляются вместе или не появляются вовсе.
 *    Существующие тесты проверяли только успешный путь: что при сбое вставки
 *    задания заявка откатывается, не проверял никто.
 * 2. **Идемпотентность (PT-009) насквозь.** Раньше — «в БД одна заявка и одно
 *    задание». Здесь добавлена вторая половина обещания: во внешний канал тоже
 *    уходит ровно одно сообщение, в том числе при двух параллельных отправках.
 * 3. **Крон ретрая против настоящего HTTP.** `POST /api/lead/retry` дёргает
 *    каналы напрямую; до этой задачи каналы в тестах были заглушены, то есть
 *    проверялась только арифметика статусов.
 * 4. **Гонки ретрая.** ТЗ, строка 124 (PT-003), предписывает уникальный индекс
 *    `(lead_id, channel)` и атомарный `claim` (`FOR UPDATE SKIP LOCKED` /
 *    `lease_until`). Ни того, ни другого в БД не было, и тест это показал:
 *    два параллельных прогона крона отправляли одну заявку дважды. После
 *    реализации `claim` те же тесты стали зелёными и остались в репозитории как
 *    страховка от отката.
 *
 * Внешние вызовы запрещены правилом 7 раздела 2 ТЗ, поэтому весь трафик идёт
 * через `tests/helpers/fake-delivery.ts`: реальные сокеты, но на 127.0.0.1.
 */
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeDb, getDb } from "@/db";
import { deliveryAlerts, leadDeliveries, leads } from "@/db/schema";
import { resetEnvCache } from "@/lib/env";
import { DELIVERY_CHANNELS } from "@/lib/lead/deliver-all";
import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { LeadPayloadSchema, type LeadPayload } from "@/lib/lead/schema";
import { setLeadStoreForTests } from "@/lib/lead/store";
import { PgLeadStore } from "@/lib/lead/store-pg";
import type { DeliveryChannel, LeadRecord } from "@/lib/lead/store-types";
import {
  FAKE_TELEGRAM_TOKEN,
  FAKE_WEB3FORMS_KEY,
  startFakeDelivery,
  type FakeDeliveryServer,
} from "./helpers/fake-delivery";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const CRON_SECRET = "ci-test-secret";
const FAKE_CHAT_ID = "-1001234567890";

const MANAGED_ENV = [
  "TELEGRAM_LEADS_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WEB3FORMS_ACCESS_KEY",
  "DELIVERY_ALERT_ENABLED",
  "LEAD_IDEMPOTENCY_ENABLED",
  "LEAD_OUTBOX_CLAIM_ENABLED",
  "CRON_SECRET",
] as const;

const TOTALS = {
  ceilingRaw: 56000,
  minimumApplied: false,
  installExtra: 0,
  lightingRegular: 8000,
  lightingEffective: 6000,
  discountPct: 25,
  grand: 62000,
};

function makePayload(phone = "+79161112233", requestId?: string): LeadPayload {
  return LeadPayloadSchema.parse({
    leadKind: "calculator",
    orderIntent: "ceiling_only",
    name: "Иван",
    phone,
    consent: true,
    source: "home:hero",
    placement: "modal",
    ...(requestId ? { requestId } : {}),
    snapshot: {
      version: 2,
      scenario: "standard",
      scope: "object",
      rooms: [
        { id: "r1", label: "Кухня", area: 12, totalRub: 24000, ceilingTypeLabel: "Простой потолок" },
      ],
      lighting: null,
      totals: TOTALS,
      source: "home:hero",
      entry: "ceiling-first",
    },
    totals: TOTALS,
  });
}

/** Вход хранилища: те же поля, которые пишет маршрут приёма заявок. */
function leadInput(overrides: Partial<Omit<LeadRecord, "id" | "createdAt" | "publicCode">> = {}) {
  return {
    status: "new" as const,
    payload: makePayload(),
    grandTotal: 30_000,
    ipHash: "ip-hash-integration",
    payloadHash: "payload-hash-integration",
    ...overrides,
  };
}

function leadRequest(body: unknown, ip = "203.0.113.77") {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

function retryRequest(secret: string = CRON_SECRET) {
  return new Request("http://localhost/api/lead/retry", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe.skipIf(!TEST_DATABASE_URL)(
  "PT-020 · доставка: настоящая БД + фейковый HTTP-сервер",
  () => {
    let fake: FakeDeliveryServer;
    let store: PgLeadStore;
    let savedEnv: Record<string, string | undefined> = {};

    const db = () => getDb(TEST_DATABASE_URL as string);

    async function deliveriesOf(leadId: number) {
      return db().select().from(leadDeliveries).where(eq(leadDeliveries.leadId, leadId));
    }

    /**
     * Заявка создана, а процесс, который должен был её отправить, умер: аренда
     * истекла, задание снова свободно. `createLeadWithDeliveries` намеренно
     * создаёт строки уже арендованными — иначе крон перехватил бы их прямо
     * из-под приёма заявки. Поэтому тесты крона обязаны снять аренду явно:
     * без этого они проверяли бы не ретрай, а «мы ничего не делаем».
     *
     * Дата в прошлом, а не `null`: заодно проверяется ветка «аренда истекла».
     */
    async function expireLease(leadId: number) {
      await db()
        .update(leadDeliveries)
        .set({ leaseUntil: new Date(Date.now() - 60_000) })
        .where(eq(leadDeliveries.leadId, leadId));
    }

    beforeAll(async () => {
      fake = await startFakeDelivery();
      savedEnv = Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
    });

    afterAll(async () => {
      for (const key of MANAGED_ENV) {
        const value = savedEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      resetEnvCache();
      await fake.close();
      await closeDb();
    });

    beforeEach(async () => {
      fake.reset();
      fake.install();

      process.env.TELEGRAM_LEADS_ENABLED = "1";
      process.env.TELEGRAM_BOT_TOKEN = FAKE_TELEGRAM_TOKEN;
      process.env.TELEGRAM_CHAT_ID = FAKE_CHAT_ID;
      process.env.WEB3FORMS_ACCESS_KEY = FAKE_WEB3FORMS_KEY;
      process.env.LEAD_IDEMPOTENCY_ENABLED = "1";
      process.env.LEAD_OUTBOX_CLAIM_ENABLED = "1";
      process.env.CRON_SECRET = CRON_SECRET;
      // Алерты PT-015 проверяются своими тестами: здесь они только мешали бы.
      process.env.DELIVERY_ALERT_ENABLED = "0";
      resetEnvCache();

      // Файл работает с теми же таблицами, что другие БД-тесты, и чистит их
      // целиком — поэтому он обязан идти в последовательном проекте `db`
      // (см. vitest.config.ts, DB_TESTS).
      await db().delete(leadDeliveries);
      await db().delete(deliveryAlerts);
      await db().delete(leads);

      store = new PgLeadStore(TEST_DATABASE_URL as string);
      setLeadStoreForTests(store);
      resetRateLimitForTests();
    });

    afterEach(() => {
      fake.uninstall();
    });

    describe("транзакционность аутбокса (PT-003)", () => {
      it("заявка и задания на доставку появляются вместе", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);

        // Читаем отдельным запросом: видно только то, что действительно закоммичено.
        const savedLead = await store.getLead(lead.id);
        expect(savedLead?.id).toBe(lead.id);

        const rows = await deliveriesOf(lead.id);
        expect(rows).toHaveLength(DELIVERY_CHANNELS.length);
        for (const row of rows) {
          expect(row.status).toBe("pending");
          expect(row.attempts).toBe(0);
          expect(row.sentAt).toBeNull();
          expect(row.lastAttemptAt).toBeNull();
          // PT-020: строка занята приёмом заявки, крон её не перехватит.
          expect(row.leaseUntil?.getTime()).toBeGreaterThan(Date.now());
        }
        // До первой попытки отправки наружу не ушло ничего.
        expect(fake.requests).toHaveLength(0);
      });

      it("сбой вставки задания откатывает и заявку", async () => {
        /**
         * Второй канал — `null`: колонка `channel` NOT NULL, поэтому вставка
         * заданий падает уже ПОСЛЕ того, как заявка вставлена. Это ровно тот
         * сценарий, ради которого существует транзакция: без отката в базе
         * осталась бы заявка, которую некому доставлять.
         */
        const brokenChannels = ["telegram", null] as unknown as readonly DeliveryChannel[];

        await expect(store.createLeadWithDeliveries(leadInput(), brokenChannels)).rejects.toThrow();

        const [leadRows, deliveryRows] = await Promise.all([
          db().select().from(leads),
          db().select().from(leadDeliveries),
        ]);
        expect(leadRows).toHaveLength(0);
        expect(deliveryRows).toHaveLength(0);
      });

      it("заявка без каналов не создаёт заданий, но сохраняется", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), []);

        expect(await store.getLead(lead.id)).not.toBeNull();
        expect(await deliveriesOf(lead.id)).toHaveLength(0);
      });

      it("уникальный индекс (lead_id, channel) не даёт завести второе задание на канал", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);

        // ТЗ, строка 124: индекс обязан существовать в БД, а не только в коде.
        // Drizzle заворачивает ошибку драйвера в «Failed query», поэтому смотрим
        // и сообщение, и `cause` — ограничение должно быть названо явно.
        const error = await db()
          .insert(leadDeliveries)
          .values({ leadId: lead.id, channel: "telegram", status: "pending", attempts: 0 })
          .then(
            () => null,
            (caught: unknown) => caught
          );

        expect(error).not.toBeNull();
        const details = `${(error as Error).message} ${String((error as { cause?: unknown }).cause ?? "")}`;
        expect(details).toContain("lead_deliveries_lead_channel_key");
        expect(details).toContain("duplicate key");

        expect(await deliveriesOf(lead.id)).toHaveLength(1);
      });
    });

    describe("идемпотентность (PT-009) насквозь", () => {
      it("повтор с тем же requestId не отправляет второе сообщение", async () => {
        const { POST } = await import("@/app/api/lead/route");
        const body = makePayload("+79161112233", "req-integration-1");

        const first = await POST(leadRequest(body));
        expect(first.status).toBe(201);
        // Маршрут не ждёт доставку: ждём, пока фон дойдёт до фейкового сервера.
        await vi.waitFor(() => expect(fake.count("telegram")).toBe(1), { timeout: 3000 });
        await vi.waitFor(() => expect(fake.count("web3forms")).toBe(1), { timeout: 3000 });

        const second = await POST(leadRequest(body));
        expect(second.status).toBe(200);

        // Даём фону шанс отправить дубль, если бы он собирался это сделать.
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(fake.count("telegram")).toBe(1);
        expect(fake.count("web3forms")).toBe(1);
        expect(await db().select().from(leads)).toHaveLength(1);
      });

      it("два параллельных запроса с одним requestId — одна заявка и одна отправка", async () => {
        const { POST } = await import("@/app/api/lead/route");
        const body = makePayload("+79161112234", "req-integration-race");

        const responses = await Promise.all([
          POST(leadRequest(body, "203.0.113.78")),
          POST(leadRequest(body, "203.0.113.79")),
        ]);
        // Кто-то создал заявку (201), второй получил её же код (200) — 500 быть не должно.
        expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);

        const [first, second] = await Promise.all(responses.map((response) => response.json()));
        const codes = new Set([
          (first as { leadId: string }).leadId,
          (second as { leadId: string }).leadId,
        ]);
        expect(codes.size).toBe(1);

        await vi.waitFor(() => expect(fake.count("telegram")).toBe(1), { timeout: 3000 });
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(await db().select().from(leads)).toHaveLength(1);
        // Гонку ловит unique-индекс, поэтому проигравший запрос не создаёт
        // второй набор заданий и не отправляет второе сообщение.
        expect(fake.count("telegram")).toBe(1);
        expect(fake.count("web3forms")).toBe(1);
      });

      it("тот же requestId с другим содержимым — 409 и никакой отправки", async () => {
        const { POST } = await import("@/app/api/lead/route");

        const first = await POST(leadRequest(makePayload("+79161112235", "req-integration-conflict")));
        expect(first.status).toBe(201);
        await vi.waitFor(() => expect(fake.count("telegram")).toBe(1), { timeout: 3000 });

        const second = await POST(
          leadRequest(makePayload("+79169998877", "req-integration-conflict"))
        );
        expect(second.status).toBe(409);

        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(fake.count("telegram")).toBe(1);
        expect(await db().select().from(leads)).toHaveLength(1);
      });
    });

    describe("крон ретрая против настоящего HTTP", () => {
      it("доводит недошедшее задание и закрывает его", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);
        await expireLease(lead.id);

        const { POST } = await import("@/app/api/lead/retry/route");
        const response = await POST(retryRequest());
        expect(response.status).toBe(200);

        const body = (await response.json()) as { ok: boolean; retried: number; sent: number };
        expect(body).toMatchObject({ ok: true, retried: 2, sent: 2 });

        expect(fake.count("telegram")).toBe(1);
        expect(fake.count("web3forms")).toBe(1);

        const rows = await deliveriesOf(lead.id);
        for (const row of rows) {
          expect(row.status).toBe("sent");
          expect(row.attempts).toBe(1);
          expect(row.sentAt).not.toBeNull();
          expect(row.lastError).toBeNull();
          // Попытка завершилась — строка больше никем не занята.
          expect(row.leaseUntil).toBeNull();
        }
      });

      it("сбой канала оставляет задание крону, следующий прогон восстанавливает", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);
        await expireLease(lead.id);
        fake.respond("telegram", { status: 500, text: "telegram is down" });

        const { POST } = await import("@/app/api/lead/retry/route");
        await POST(retryRequest());

        const afterFailure = (await deliveriesOf(lead.id)).find((row) => row.channel === "telegram");
        expect(afterFailure?.status).toBe("failed");
        expect(afterFailure?.attempts).toBe(1);
        expect(afterFailure?.lastError).toContain("500");
        expect(afterFailure?.sentAt).toBeNull();
        // Важно: упавшее задание освобождается сразу, а не ждёт истечения аренды.
        expect(afterFailure?.leaseUntil).toBeNull();

        // Канал ожил — второй прогон обязан доставить то же задание, не плодя новое.
        fake.respond("telegram", { status: 200 });
        const second = await POST(retryRequest());
        const body = (await second.json()) as { sent: number };
        expect(body.sent).toBe(1);

        const rows = await deliveriesOf(lead.id);
        const afterRecovery = rows.find((row) => row.channel === "telegram");
        expect(afterRecovery?.status).toBe("sent");
        expect(afterRecovery?.attempts).toBe(2);
        expect(afterRecovery?.sentAt).not.toBeNull();
        // Две попытки одного задания: первая неудачная, вторая успешная.
        expect(fake.count("telegram")).toBe(2);
        expect(rows.filter((row) => row.channel === "telegram")).toHaveLength(1);
      });

      it("задание с исчерпанными попытками крон больше не трогает", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);
        // MAX_ATTEMPTS в маршруте — 5: шестая попытка не должна состояться.
        // Аренду снимаем, иначе задание не взяли бы по другой причине и тест
        // оказался бы зелёным, не проверив фильтр попыток.
        await db()
          .update(leadDeliveries)
          .set({ status: "failed", attempts: 5, leaseUntil: null })
          .where(eq(leadDeliveries.leadId, lead.id));

        const { POST } = await import("@/app/api/lead/retry/route");
        const response = (await POST(retryRequest()).then((r) => r.json())) as { retried: number };

        expect(response.retried).toBe(0);
        expect(fake.count("telegram")).toBe(0);
      });

      it("крон с неверным CRON_SECRET не отправляет ничего", async () => {
        await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);

        const { POST } = await import("@/app/api/lead/retry/route");
        const response = await POST(retryRequest("wrong-secret"));

        expect(response.status).toBe(401);
        expect(fake.requests).toHaveLength(0);
      });
    });

    describe("приём заявки при недоступных каналах", () => {
      it("заявка сохраняется, а задания падают в failed с текстом ошибки", async () => {
        fake.respond("*", { status: 503, text: "service unavailable" });

        const { POST } = await import("@/app/api/lead/route");
        const response = await POST(leadRequest(makePayload("+79161112236")));
        expect(response.status).toBe(201);

        await vi.waitFor(
          async () => {
            const rows = await db().select().from(leadDeliveries);
            expect(rows).toHaveLength(2);
            expect(rows.every((row) => row.status === "failed")).toBe(true);
          },
          { timeout: 3000 }
        );

        const rows = await db().select().from(leadDeliveries);
        expect(rows.every((row) => (row.lastError ?? "").includes("503"))).toBe(true);
        expect(await db().select().from(leads)).toHaveLength(1);
      });

      it("обрыв соединения у канала не теряет заявку", async () => {
        fake.respond("*", { dropConnection: true });

        const { POST } = await import("@/app/api/lead/route");
        const response = await POST(leadRequest(makePayload("+79161112237")));
        expect(response.status).toBe(201);

        await vi.waitFor(
          async () => {
            const rows = await db().select().from(leadDeliveries);
            expect(rows).toHaveLength(2);
            expect(rows.every((row) => row.status === "failed")).toBe(true);
          },
          { timeout: 3000 }
        );

        expect(await db().select().from(leads)).toHaveLength(1);
      });
    });

    describe("claim: аренда заданий и гонки ретрая (PT-020)", () => {
      it("арендованное задание крон не забирает — его ещё отправляют", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);

        const { POST } = await import("@/app/api/lead/retry/route");
        const body = (await POST(retryRequest()).then((r) => r.json())) as { retried: number };

        expect(body.retried).toBe(0);
        expect(fake.requests).toHaveLength(0);
        expect((await deliveriesOf(lead.id)).every((row) => row.attempts === 0)).toBe(true);
      });

      it("два параллельных claim не отдают одно задание дважды", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), DELIVERY_CHANNELS);
        // Третье задание — чтобы было что делить при лимите 2.
        await store.recordDelivery(lead.id, "telegram", "failed", "HTTP 500");
        await expireLease(lead.id);

        const [first, second] = await Promise.all([
          store.claimDeliveries(2, 5),
          store.claimDeliveries(2, 5),
        ]);

        const ids = [...first, ...second].map((delivery) => delivery.id);
        expect(new Set(ids).size).toBe(ids.length);
        // Всего свободных заданий два (telegram освобождён, web3forms — тоже).
        expect(ids.length).toBe(2);
      });

      it("строка без lease_until (наследие фазы expand) считается свободной", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);
        await db()
          .update(leadDeliveries)
          .set({ leaseUntil: null })
          .where(eq(leadDeliveries.leadId, lead.id));

        const claimed = await store.claimDeliveries(10, 5);

        expect(claimed).toHaveLength(1);
        expect(claimed[0]?.channel).toBe("telegram");
      });

      it("два параллельных прогона крона не отправляют одно задание дважды", async () => {
        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);
        await expireLease(lead.id);

        const { POST } = await import("@/app/api/lead/retry/route");
        const responses = await Promise.all([POST(retryRequest()), POST(retryRequest())]);

        for (const response of responses) expect(response.status).toBe(200);

        const rows = await deliveriesOf(lead.id);
        expect(rows).toHaveLength(1);
        /**
         * Главное assertion задачи: во внешний канал должно уйти ОДНО
         * сообщение. До `claim` здесь было 2 — клиент получал дубль в Telegram.
         */
        expect(fake.count("telegram")).toBe(1);
        expect(rows[0]?.attempts).toBe(1);
      });

      it("приём заявки и крон, запущенные одновременно, не отправляют задание дважды", async () => {
        /**
         * Второй вариант той же гонки, и он не лечится запретом «запускать крон
         * дважды»: `/api/lead` создаёт задания в статусе `pending` и отправляет
         * их фоном, не дожидаясь ответа клиента. Крон в этот момент видит те же
         * строки — окно примерно на время одной доставки.
         */
        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);

        const { deliverAll } = await import("@/lib/lead/deliver-all");
        const { POST } = await import("@/app/api/lead/retry/route");

        await Promise.all([
          deliverAll(store, lead.id, lead.payload, lead.publicCode, ["telegram"]),
          POST(retryRequest()),
        ]);

        expect(fake.count("telegram")).toBe(1);
      });

      it("флаг отката LEAD_OUTBOX_CLAIM_ENABLED=0 возвращает прежнее поведение", async () => {
        /**
         * Проверка самого отката (правило 8 раздела 2 ТЗ): с флагом `0` крон
         * снова читает задания двумя `SELECT` и снова может отправить дубль.
         * Это не «ещё один тест гонки», а гарантия, что аварийный выключатель
         * действительно возвращает поведение до PT-020, а не ломает доставку.
         */
        process.env.LEAD_OUTBOX_CLAIM_ENABLED = "0";
        resetEnvCache();

        const lead = await store.createLeadWithDeliveries(leadInput(), ["telegram"]);
        // С выключенным флагом аренда не проставляется — задание сразу свободное.
        expect((await deliveriesOf(lead.id))[0]?.leaseUntil).toBeNull();

        // Задержка делает сценарий воспроизводимым: оба прогона успевают
        // прочитать строку до того, как первый запишет `sent`.
        fake.respond("telegram", { delayMs: 150 });

        const { POST } = await import("@/app/api/lead/retry/route");
        await Promise.all([POST(retryRequest()), POST(retryRequest())]);

        expect(fake.count("telegram")).toBe(2);
      });
    });
  }
);
