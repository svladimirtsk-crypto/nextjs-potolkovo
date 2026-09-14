/**
 * N-001 · Интеграционные тесты роута с БД.
 *
 * Главная проверка — приёмка ТЗ v2: 6-й запрос с одного IP получает 429
 * **после `resetLeadStoreForTests()`**, то есть лимит держится на данных,
 * а не на памяти процесса. Именно это ломалось на serverless.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ATTRIBUTION_URL_MAX } from "@/lib/attribution";
import { PRIVACY_POLICY_VERSION } from "@/content/legal";
import { resetEnvCache } from "@/lib/env";
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

    /**
     * PT-010 · в БД лежит серверная сумма, а не присланная клиентом.
     *
     * В payload выше `totals.grand: 62000` и `totalRub` комнат 24 000/32 000 —
     * цифры с потолка. Сервер пересчитывает комнаты по прайсу: две комнаты
     * «простой потолок» 12 и 18 м² × 1 000 ₽ = 30 000 ₽, света в заявке нет.
     * Заодно проверяется, что расширенный снапшот (`priceCheck`) помещается в
     * jsonb, а сумма — в целочисленный `grand_total`.
     */
    expect(saved?.grandTotal).toBe(30_000);
    const priceCheck = (
      saved?.payload.snapshot as
        | { priceCheck?: { status: string; clientGrand: number; serverGrand: number | null } }
        | undefined
    )?.priceCheck;
    expect(priceCheck?.status).toBe("mismatch");
    expect(priceCheck?.clientGrand).toBe(62_000);
    expect(priceCheck?.serverGrand).toBe(30_000);
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

  /**
   * PT-009 · Идемпотентность на реальной БД.
   *
   * In-memory тесты (`tests/lead-idempotency.test.ts`) покрывают логику роута,
   * но уникальность `request_id` гарантирует именно индекс PostgreSQL — его и
   * проверяем здесь, включая гонку двух параллельных вставок.
   */
  it("PT-009: повтор requestId возвращает прежний код и не создаёт вторую строку", async () => {
    const { POST } = await import("@/app/api/lead/route");
    const body = { ...leadBody("+79167778899"), requestId: "db-req-repeat" };

    const first = await POST(request(body));
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { leadId: string };

    // Холодный старт: памяти процесса нет, идемпотентность держится только на БД.
    resetRateLimitForTests();

    const second = await POST(request(body));
    const secondJson = (await second.json()) as {
      leadId: string;
      idempotentReplay?: boolean;
      deduped?: boolean;
    };

    expect(second.status).toBe(200);
    expect(secondJson.idempotentReplay).toBe(true);
    expect(secondJson.leadId).toBe(firstJson.leadId);

    const stored = await store.findLeadByRequestId("db-req-repeat");
    expect(stored?.payloadHash).toBeTruthy();
  });

  it("PT-009: тот же requestId с другим payload → 409", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const first = await POST(request({ ...leadBody("+79167770011"), requestId: "db-req-conflict" }));
    expect(first.status).toBe(201);

    const conflict = await POST(
      request({ ...leadBody("+79167770011"), name: "Пётр", requestId: "db-req-conflict" })
    );
    expect(conflict.status).toBe(409);

    const json = (await conflict.json()) as { error: string };
    expect(json.error).toBe("request_id_conflict");
  });

  it("PT-009: unique-индекс ловит параллельную вставку с одним requestId", async () => {
    const { POST } = await import("@/app/api/lead/route");
    const body = { ...leadBody("+79167772233"), requestId: "db-req-race" };

    const responses = await Promise.all([POST(request(body)), POST(request(body))]);
    const statuses = responses.map((response) => response.status).sort();
    const bodies = await Promise.all(
      responses.map(async (response) => (await response.json()) as { ok: boolean; leadId: string })
    );

    // Один запрос создал заявку, второй получил повтор — но оба успешны.
    expect(statuses).toEqual([200, 201]);
    expect(bodies.every((body) => body.ok)).toBe(true);
    expect(bodies[0].leadId).toBe(bodies[1].leadId);
  });

  it("PT-009: rescue → полная заявка с тем же телефоном создаёт вторую запись", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const rescue = await POST(
      request({
        leadKind: "rescue",
        orderIntent: "ceiling_only",
        phone: "+79167774455",
        consent: true,
        source: "calculator",
        placement: "rescue",
        grandTotal: 62000,
        requestId: "db-req-rescue",
      })
    );
    expect(rescue.status).toBe(201);
    const rescueJson = (await rescue.json()) as { leadId: string };

    const full = await POST(request({ ...leadBody("+79167774455"), requestId: "db-req-full" }));
    expect(full.status).toBe(201);
    const fullJson = (await full.json()) as { leadId: string };

    expect(fullJson.leadId).not.toBe(rescueJson.leadId);

    const fullLead = await store.getLeadByPublicCode(fullJson.leadId);
    expect(fullLead?.payload.name).toBe("Иван");
    expect(fullLead?.payload.snapshot).toBeTruthy();
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

  /**
   * PT-012 · Атрибуция не должна валить заявку.
   *
   * До правки схема требовала `max(200)` на каждое значение, и рекламная ссылка
   * первого визита (`first_landing` с километровыми UTM) давала `422` на весь
   * запрос: заявка терялась именно у того, кто пришёл из рекламы. Проверяем на
   * настоящей БД, что запрос проходит, а в `payload.attribution` лежит
   * нормализованное значение — без фрагмента, без персональных параметров и в
   * пределах лимита на URL целиком.
   */
  it("PT-012: длинная рекламная ссылка в атрибуции не даёт 422 и нормализуется в БД", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const longLanding =
      "/uslugi/tenevye-potolki?utm_source=yandex&utm_medium=cpc&utm_campaign=" +
      "c".repeat(3000) +
      "&email=ivan@example.com&phone=%2B79000000000#price";
    expect(longLanding.length).toBeGreaterThan(ATTRIBUTION_URL_MAX);

    const response = await POST(
      request({
        ...leadBody("+79167778899"),
        attribution: {
          utm_source: "yandex",
          first_landing: longLanding,
          // Ключ вне allowlist: в лид попасть не должен.
          password: "secret",
        },
      })
    );

    expect(response.status).toBe(201);

    const { leadId } = (await response.json()) as { leadId: string };
    const saved = await store.getLeadByPublicCode(leadId);
    const attribution = (saved?.payload.attribution ?? {}) as Record<string, string>;

    expect(attribution.utm_source).toBe("yandex");
    expect(attribution.first_landing.length).toBeLessThanOrEqual(ATTRIBUTION_URL_MAX);
    expect(attribution.first_landing).not.toContain("email");
    expect(attribution.first_landing).not.toContain("#");
    expect(attribution.password).toBeUndefined();
  });
  /**
   * PT-014 · Согласие — это факт с редакцией и моментом, а не `consent: true`.
   *
   * До задачи в `leads` не было ни версии политики, ни времени согласия: по базе
   * нельзя было ответить, с каким текстом человек согласился. Проверяем на
   * настоящей БД, что значения из запроса доезжают до отдельных колонок.
   */
  it("PT-014: версия и момент согласия сохраняются в отдельных колонках", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const consentAt = new Date(Date.now() - 60_000).toISOString();
    const response = await POST(
      request({
        ...leadBody("+79161110001"),
        consentVersion: PRIVACY_POLICY_VERSION,
        consentAt,
      })
    );

    expect(response.status).toBe(201);

    const { leadId } = (await response.json()) as { leadId: string };
    const saved = await store.getLeadByPublicCode(leadId);

    expect(saved?.consentVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(saved?.consentAt).toBe(Date.parse(consentAt));
  });

  it("PT-014: без версии клиента — NULL, момент ставит сервер", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const before = Date.now();
    const response = await POST(request(leadBody("+79161110002")));
    const after = Date.now();

    expect(response.status).toBe(201);

    const { leadId } = (await response.json()) as { leadId: string };
    const saved = await store.getLeadByPublicCode(leadId);

    // Неизвестность честнее подставленной текущей редакции.
    expect(saved?.consentVersion).toBeNull();
    expect(saved?.consentAt).toBeGreaterThanOrEqual(before - 1000);
    expect(saved?.consentAt).toBeLessThanOrEqual(after + 1000);
  });

  it("PT-014: невозможное время согласия заменяется серверным", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const before = Date.now();
    const response = await POST(
      request({
        ...leadBody("+79161110003"),
        consentVersion: "2020-01-01",
        consentAt: "1999-01-01T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(201);

    const { leadId } = (await response.json()) as { leadId: string };
    const saved = await store.getLeadByPublicCode(leadId);

    // Часы клиента соврали на 27 лет — пишем серверное время.
    expect(saved?.consentAt).toBeGreaterThanOrEqual(before - 1000);
    // Старая редакция сохраняется как есть: человек видел именно её.
    expect(saved?.consentVersion).toBe("2020-01-01");
  });

  it("PT-014: мусор в consentVersion не доезжает до БД", async () => {
    const { POST } = await import("@/app/api/lead/route");

    const response = await POST(
      request({
        ...leadBody("+79161110004"),
        consentVersion: "'; DROP TABLE leads;--",
        consentAt: "вчера",
      })
    );

    expect(response.status).toBe(201);

    const { leadId } = (await response.json()) as { leadId: string };
    const saved = await store.getLeadByPublicCode(leadId);
    expect(saved?.consentVersion).toBeNull();
    expect(saved?.consentAt).not.toBeNull();
  });

  /**
   * PT-014 · Флаг аварийного отката (правило 8 раздела 2 ТЗ).
   *
   * По умолчанию расхождение версий только логируется: деплой новой редакции
   * политики не должен терять посетителей со старой вкладкой. С флагом `1`
   * такая заявка отклоняется `422` с человеческим текстом.
   */
  it("PT-014: LEAD_CONSENT_VERSION_REQUIRED=1 отклоняет устаревшую версию", async () => {
    const { POST } = await import("@/app/api/lead/route");

    process.env.LEAD_CONSENT_VERSION_REQUIRED = "1";
    resetEnvCache();

    try {
      const stale = await POST(
        request({ ...leadBody("+79161110005"), consentVersion: "2020-01-01" })
      );
      expect(stale.status).toBe(422);
      const staleBody = (await stale.json()) as { error: string; code?: string; message?: string };
      expect(staleBody.code).toBe("consent_version_stale");
      expect(staleBody.message).toMatch(/Политика конфиденциальности обновилась/);

      // Текущая редакция проходит, а заявка без версии — нет: строго значит строго.
      const current = await POST(
        request({ ...leadBody("+79161110006"), consentVersion: PRIVACY_POLICY_VERSION })
      );
      expect(current.status).toBe(201);

      const missing = await POST(request(leadBody("+79161110007")));
      expect(missing.status).toBe(422);
    } finally {
      delete process.env.LEAD_CONSENT_VERSION_REQUIRED;
      resetEnvCache();
    }
  });

  it("PT-014: по умолчанию устаревшая версия принимается и логируется", async () => {
    const { POST } = await import("@/app/api/lead/route");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const response = await POST(
        request({ ...leadBody("+79161110008"), consentVersion: "2020-01-01" })
      );
      expect(response.status).toBe(201);
      expect(warn.mock.calls.some((call) => String(call[0]).includes("consent") || String(call[0]).includes("политикой"))).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});
