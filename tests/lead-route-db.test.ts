/**
 * N-001 · Интеграционные тесты роута с БД.
 *
 * Главная проверка — приёмка ТЗ v2: 6-й запрос с одного IP получает 429
 * **после `resetLeadStoreForTests()`**, то есть лимит держится на данных,
 * а не на памяти процесса. Именно это ломалось на serverless.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { setLeadStoreForTests } from "@/lib/lead/store";
import type { LeadStore } from "@/lib/lead/store-types";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

// Доставку наружу не дёргаем никогда: тесты не должны слать реальные сообщения.
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true as const })),
}));

function request(body: unknown, ip = "203.0.113.10") {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const TOTALS = {
  ceilingRaw: 56000,
  minimumApplied: false,
  installExtra: 0,
  lightingRegular: 8000,
  lightingEffective: 6000,
  discountPct: 25,
  grand: 62000,
};

function room(id: string, label: string, area: number, totalRub: number) {
  return { id, label, area, totalRub, ceilingTypeLabel: "Простой потолок" };
}

/** Валидный payload по `LeadPayloadSchema` — форма важна, её проверяет zod. */
function leadBody(phone: string) {
  return {
    leadKind: "calculator",
    orderIntent: "ceiling_only",
    name: "Иван",
    phone,
    consent: true,
    source: "home:hero",
    placement: "modal",
    snapshot: {
      version: 2,
      scenario: "standard",
      scope: "object",
      rooms: [room("r1", "Кухня", 12, 24000), room("r2", "Спальня", 18, 32000)],
      lighting: null,
      totals: TOTALS,
      source: "home:hero",
      entry: "ceiling-first",
    },
    totals: TOTALS,
  };
}

describe.skipIf(!TEST_DATABASE_URL)("N-001 · POST /api/lead с PostgreSQL", () => {
  let store: LeadStore;

  beforeEach(async () => {
    const { PgLeadStore } = await import("@/lib/lead/store-pg");
    const { getDb } = await import("@/db");
    const { leadDeliveries, leads } = await import("@/db/schema");

    const db = getDb(TEST_DATABASE_URL as string);
    await db.delete(leadDeliveries);
    await db.delete(leads);

    store = new PgLeadStore(TEST_DATABASE_URL as string);
    setLeadStoreForTests(store);
    resetRateLimitForTests();
  });

  afterAll(async () => {
    const { closeDb } = await import("@/db");
    await closeDb();
  });

  it("сохраняет заявку в БД со снапшотом из двух комнат", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const response = await POST(request(leadBody("+79161112233")));
    expect(response.status).toBe(201);

    const json = (await response.json()) as { leadId: string };
    expect(json.leadId).toMatch(/^[A-Z2-9]{5}$/);

    const saved = await store.getLeadByPublicCode(json.leadId);
    expect(saved).not.toBeNull();
    const rooms = (saved?.payload.snapshot as { rooms?: unknown[] } | undefined)?.rooms;
    expect(rooms).toHaveLength(2);
  });

  it("дедуп по телефону переживает потерю памяти процесса", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const first = await POST(request(leadBody("+79162223344")));
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { leadId: string };

    // Эмулируем холодный старт serverless: память обнулилась, БД осталась.
    resetRateLimitForTests();

    const second = await POST(request(leadBody("+79162223344")));
    const secondJson = (await second.json()) as { leadId: string; deduped?: boolean };

    expect(secondJson.deduped).toBe(true);
    expect(secondJson.leadId).toBe(firstJson.leadId);
  });

  it("6-й запрос с одного IP → 429 даже после сброса in-memory лимитера", async () => {
    const { POST } = await import("@/app/api/lead/route");
    const ip = "198.51.100.7";

    for (let i = 0; i < 5; i += 1) {
      const response = await POST(request(leadBody(`+7916000${1000 + i}`), ip));
      expect(response.status).toBe(201);
      // Сбрасываем память перед каждым запросом — «холодный старт» на каждый вызов.
      resetRateLimitForTests();
    }

    const sixth = await POST(request(leadBody("+79160009999"), ip));
    expect(sixth.status).toBe(429);

    const json = (await sixth.json()) as { error: string };
    expect(json.error).toBe("rate_limited");
  });

  it("GET /api/lead/:code находит заявку по коду с CRON_SECRET", async () => {
    const { POST } = await import("@/app/api/lead/route");
    const created = await POST(request(leadBody("+79165556677")));
    const { leadId } = (await created.json()) as { leadId: string };

    const { GET } = await import("@/app/api/lead/[code]/route");

    const unauthorized = await GET(new Request("http://localhost/api/lead/X"), {
      params: Promise.resolve({ code: leadId }),
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await GET(
      new Request("http://localhost/api/lead/X", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      }),
      { params: Promise.resolve({ code: leadId }) }
    );
    expect(authorized.status).toBe(200);

    const json = (await authorized.json()) as { lead: { phone: string } };
    expect(json.lead.phone).toBe("+79165556677");
  });
});
