/**
 * N-001 · Тесты хранилища заявок.
 *
 * Тесты `PgLeadStore` требуют настоящую БД и запускаются только при заданном
 * `TEST_DATABASE_URL` — иначе пропускаются (в CI без БД это не должно валить
 * прогон). Контрактные тесты гоняются на in-memory реализации всегда: они
 * фиксируют поведение, на которое опирается роут.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryLeadStore } from "@/lib/lead/store";
import { generatePublicCode } from "@/lib/lead/public-code";
import type { LeadPayload } from "@/lib/lead/schema";
import type { LeadStore } from "@/lib/lead/store-types";

function payload(overrides: Partial<LeadPayload> = {}): LeadPayload {
  return {
    leadKind: "calculator",
    orderIntent: "ceiling_only",
    name: "Иван",
    phone: "+79161234567",
    source: "home:hero",
    placement: "modal",
    attribution: {},
    ...overrides,
  } as LeadPayload;
}

describe("N-001 · публичный код заявки", () => {
  it("5 символов без похожих I/O/0/1 — код диктуют по телефону", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generatePublicCode();
      expect(code).toHaveLength(5);
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
    }
  });
});

/** Контракт, который обязаны выполнять обе реализации LeadStore. */
function describeStoreContract(name: string, makeStore: () => Promise<LeadStore> | LeadStore) {
  describe(name, () => {
    let store: LeadStore;

    beforeEach(async () => {
      store = await makeStore();
    });

    it("создаёт заявку и находит её по короткому коду", async () => {
      const lead = await store.createLead({
        status: "new",
        payload: payload(),
        grandTotal: 44000,
        ipHash: "hash-a",
      });

      expect(lead.publicCode).toMatch(/^[A-Z2-9]{5}$/);

      const found = await store.getLeadByPublicCode(lead.publicCode);
      expect(found?.id).toBe(lead.id);
      expect(found?.payload.phone).toBe("+79161234567");
      expect(found?.grandTotal).toBe(44000);
    });

    it("поиск по коду не зависит от регистра", async () => {
      const lead = await store.createLead({
        status: "new",
        payload: payload(),
        grandTotal: 0,
      });

      const found = await store.getLeadByPublicCode(lead.publicCode.toLowerCase());
      expect(found?.id).toBe(lead.id);
    });

    it("дедуп: находит заявку с тем же телефоном в окне и не находит вне окна", async () => {
      await store.createLead({ status: "new", payload: payload(), grandTotal: 0 });

      const inWindow = await store.findRecentByPhone("+79161234567", 10 * 60 * 1000);
      expect(inWindow).not.toBeNull();

      // Нулевое окно — заявка заведомо «старше» порога.
      const outOfWindow = await store.findRecentByPhone("+79161234567", 0);
      expect(outOfWindow).toBeNull();

      const otherPhone = await store.findRecentByPhone("+79990000000", 10 * 60 * 1000);
      expect(otherPhone).toBeNull();
    });

    it("считает заявки с одного IP — на этом держится серверный rate-limit", async () => {
      for (let i = 0; i < 3; i += 1) {
        await store.createLead({
          status: "new",
          payload: payload({ phone: `+7916000000${i}` }),
          grandTotal: 0,
          ipHash: "hash-b",
        });
      }
      await store.createLead({
        status: "new",
        payload: payload({ phone: "+79997776655" }),
        grandTotal: 0,
        ipHash: "other",
      });

      expect(await store.countRecentByIpHash("hash-b", 10 * 60 * 1000)).toBe(3);
      expect(await store.countRecentByIpHash("other", 10 * 60 * 1000)).toBe(1);
      expect(await store.countRecentByIpHash("unknown", 10 * 60 * 1000)).toBe(0);
    });

    it("запись доставки: повтор по тому же каналу увеличивает attempts, а не плодит строки", async () => {
      const lead = await store.createLead({
        status: "new",
        payload: payload(),
        grandTotal: 0,
      });

      const first = await store.recordDelivery(lead.id, "telegram", "failed", "timeout");
      expect(first.attempts).toBe(1);
      expect(first.status).toBe("failed");

      const second = await store.recordDelivery(lead.id, "telegram", "failed", "timeout again");
      expect(second.id).toBe(first.id);
      expect(second.attempts).toBe(2);
      expect(second.lastError).toBe("timeout again");

      const failed = await store.listFailedDeliveries(10);
      expect(failed).toHaveLength(1);
    });

    it("успешная доставка исчезает из очереди ретраев и получает sentAt", async () => {
      const lead = await store.createLead({
        status: "new",
        payload: payload(),
        grandTotal: 0,
      });

      await store.recordDelivery(lead.id, "telegram", "failed", "boom");
      expect(await store.listFailedDeliveries(10)).toHaveLength(1);

      const sent = await store.recordDelivery(lead.id, "telegram", "sent");
      expect(sent.status).toBe("sent");
      expect(sent.sentAt).toBeTypeOf("number");
      expect(await store.listFailedDeliveries(10)).toHaveLength(0);
    });

    it("исчерпавшие попытки доставки не возвращаются в ретрай", async () => {
      const lead = await store.createLead({
        status: "new",
        payload: payload(),
        grandTotal: 0,
      });

      for (let i = 0; i < 5; i += 1) {
        await store.recordDelivery(lead.id, "web3forms", "failed", `fail ${i}`);
      }

      expect(await store.listFailedDeliveries(10)).toHaveLength(0);
    });
  });
}

describeStoreContract("N-001 · InMemoryLeadStore (контракт)", () => new InMemoryLeadStore());

// PgLeadStore проверяется только при наличии тестовой БД.
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (TEST_DATABASE_URL) {
  // Тот же контракт, но против настоящего PostgreSQL. Каждый прогон чистит
  // таблицы, иначе счётчики по IP поедут от предыдущих запусков.
  describeStoreContract("N-001 · PgLeadStore (реальная БД)", async () => {
    const { PgLeadStore } = await import("@/lib/lead/store-pg");
    const { getDb } = await import("@/db");
    const { leadDeliveries, leads } = await import("@/db/schema");

    const db = getDb(TEST_DATABASE_URL);
    await db.delete(leadDeliveries);
    await db.delete(leads);

    return new PgLeadStore(TEST_DATABASE_URL);
  });

  describe("N-001 · PgLeadStore · специфика БД", () => {
    it("snapshot и totals переживают round-trip через jsonb", async () => {
      const { PgLeadStore } = await import("@/lib/lead/store-pg");
      const store = new PgLeadStore(TEST_DATABASE_URL);

      const totals = {
        ceilingRaw: 56000,
        minimumApplied: false,
        installExtra: 0,
        lightingRegular: 0,
        lightingEffective: 0,
        discountPct: 0,
        grand: 62000,
      };

      const snapshot: NonNullable<LeadPayload["snapshot"]> = {
        version: 2,
        scenario: "standard",
        scope: "object",
        rooms: [
          {
            id: "r1",
            label: "Кухня",
            area: 12,
            totalRub: 24000,
            ceilingTypeLabel: "Простой потолок",
          },
          {
            id: "r2",
            label: "Спальня",
            area: 18,
            totalRub: 32000,
            ceilingTypeLabel: "Простой потолок",
          },
        ],
        lighting: null,
        totals,
        source: "home:hero",
        entry: "ceiling-first",
      };

      const lead = await store.createLead({
        status: "new",
        payload: payload({
          phone: `+7911${Math.floor(Math.random() * 10_000_000)}`,
          snapshot,
        }),
        grandTotal: 62000,
      });

      const found = await store.getLeadByPublicCode(lead.publicCode);
      const rooms = (found?.payload.snapshot as { rooms?: unknown[] } | undefined)?.rooms;
      expect(rooms).toHaveLength(2);
      expect(found?.grandTotal).toBe(62000);
    });
  });
}
