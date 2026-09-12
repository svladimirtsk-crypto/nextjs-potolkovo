/**
 * PT-004 · Общий клиентский сервис отправки заявки.
 *
 * Ключевое свойство, которое здесь закреплено: `submitLead` не бросает
 * исключений ни при каком исходе. Именно отсутствие проверки ответа в
 * rescue-диалоге приводило к «успеху» после `500` — тесты ниже делают
 * возврат к прежнему поведению заметным.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LEAD_API_PATH,
  collectLeadAttribution,
  leadSubmitFailureReason,
  resolveLeadEntry,
  resolveOrderIntent,
  submitLead,
  toLeadErrorMetricKind,
  type LeadSubmitFailure,
} from "@/lib/lead/submit-lead";

const PAYLOAD = { phone: "+79001234567", consent: true, placement: "rescue" };

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Транспорт, который просто отдаёт заранее заданный ответ и пишет запрос. */
function stubFetch(response: Response | (() => Response)) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return typeof response === "function" ? response() : response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PT-004 - submitLead: uspeh", () => {
  it("201 + ok:true -> ok, leadId, callbackWindow", async () => {
    const { fetchImpl, calls } = stubFetch(
      jsonResponse({ ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00", status: "queued" }, { status: 201 })
    );

    const result = await submitLead(PAYLOAD, { fetchImpl });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leadId).toBe("K7F3Q");
    expect(result.callbackWindow).toBe("сегодня до 21:00");
    expect(result.deduped).toBe(false);
    expect(result.status).toBe(201);

    // Контракт транспорта: тот же путь, метод и JSON-заголовок, что и раньше.
    expect(calls[0].url).toBe(LEAD_API_PATH);
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual(PAYLOAD);
  });

  it("dedup: ok:true + deduped:true остаётся успехом", async () => {
    const { fetchImpl } = stubFetch(jsonResponse({ ok: true, leadId: "OLD01", deduped: true }));
    const result = await submitLead(PAYLOAD, { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.deduped).toBe(true);
    expect(result.leadId).toBe("OLD01");
  });

  it("honeypot: leadId null — всё ещё успех, а не ошибка", async () => {
    const { fetchImpl } = stubFetch(jsonResponse({ ok: true, leadId: null, callbackWindow: "" }));
    const result = await submitLead(PAYLOAD, { fetchImpl });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leadId).toBeNull();
  });
});

describe("PT-004 - submitLead: otkaz ne schitaetsya uspehom", () => {
  const cases: Array<[string, number, unknown, LeadSubmitFailure["kind"]]> = [
    ["422 validaciya", 422, { ok: false, error: "validation", issues: ["phone"] }, "validation"],
    ["429 rate-limit", 429, { ok: false, error: "rate_limited" }, "ratelimit"],
    ["500 server", 500, { ok: false, error: "internal" }, "server"],
    ["503 hrabilische (PT-002)", 503, { ok: false, error: "storage_unavailable" }, "unavailable"],
    ["503 priem vyklyuchen", 503, { ok: false, error: "disabled" }, "unavailable"],
    ["400 bitiy JSON", 400, { ok: false, error: "invalid_json" }, "server"],
  ];

  it.each(cases)("%s -> ok:false, kind=%s", async (_label, status, body, expectedKind) => {
    const { fetchImpl } = stubFetch(jsonResponse(body, { status }));
    const result = await submitLead(PAYLOAD, { fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe(expectedKind);
    expect(result.status).toBe(status);
  });

  it("200 s ok:false — тоже отказ (HTTP-статуса недостаточно)", async () => {
    const { fetchImpl } = stubFetch(jsonResponse({ ok: false, error: "weird" }, { status: 200 }));
    const result = await submitLead(PAYLOAD, { fetchImpl });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("server");
  });

  it("422 prinosit spisok poley iz issues", async () => {
    const { fetchImpl } = stubFetch(
      jsonResponse({ ok: false, error: "validation", issues: ["phone", "snapshot.totals.grand"] }, { status: 422 })
    );
    const result = await submitLead(PAYLOAD, { fetchImpl });
    if (result.ok) throw new Error("ожидался отказ");
    expect(result.issues).toEqual(["phone", "snapshot.totals.grand"]);
  });

  it("429 otdaet Retry-After v sekundah", async () => {
    const { fetchImpl } = stubFetch(
      jsonResponse(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "600" } }
      )
    );
    const result = await submitLead(PAYLOAD, { fetchImpl });
    if (result.ok) throw new Error("ожидался отказ");
    expect(result.retryAfterSec).toBe(600);
    expect(leadSubmitFailureReason(result)).toContain("10 мин");
  });

  it("nevalidnyy Retry-After ne ronjaet razbor", async () => {
    const { fetchImpl } = stubFetch(
      jsonResponse(
        { ok: false, error: "rate_limited" },
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" } }
      )
    );
    const result = await submitLead(PAYLOAD, { fetchImpl });
    if (result.ok) throw new Error("ожидался отказ");
    expect(result.retryAfterSec).toBeNull();
  });

  it("setevaya oshibka -> kind network, bez isklyucheniya naruzhu", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const result = await submitLead(PAYLOAD, { fetchImpl });
    expect(result).toEqual({
      ok: false,
      kind: "network",
      status: null,
      issues: [],
      retryAfterSec: null,
    });
  });

  it("tamaut -> kind timeout", async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      })) as unknown as typeof fetch;

    const result = await submitLead(PAYLOAD, { fetchImpl: hanging, timeoutMs: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.kind).toBe("timeout");
  });

  it("bitoe telo pri 200 ne schitaetsya uspehom", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>not json</html>", { status: 200 })
    ) as unknown as typeof fetch;

    const result = await submitLead(PAYLOAD, { fetchImpl });
    expect(result.ok).toBe(false);
  });
});

describe("PT-004 - slovar oshibok", () => {
  it("lead_error: timeout -> network, unavailable -> server", () => {
    expect(toLeadErrorMetricKind("timeout")).toBe("network");
    expect(toLeadErrorMetricKind("network")).toBe("network");
    expect(toLeadErrorMetricKind("unavailable")).toBe("server");
    expect(toLeadErrorMetricKind("server")).toBe("server");
    expect(toLeadErrorMetricKind("validation")).toBe("validation");
    expect(toLeadErrorMetricKind("ratelimit")).toBe("ratelimit");
  });

  it("prichina otaza ne raskryvaet tekhnicheskie detali", () => {
    for (const kind of ["validation", "ratelimit", "unavailable", "server", "network", "timeout"] as const) {
      const reason = leadSubmitFailureReason({ kind });
      expect(reason.length).toBeGreaterThan(10);
      expect(reason.toLowerCase()).not.toContain("telegram");
      expect(reason.toLowerCase()).not.toContain("web3forms");
      expect(reason.toLowerCase()).not.toContain("database");
    }
  });
});

describe("PT-004 - resolveOrderIntent / resolveLeadEntry", () => {
  it("intent: svet s potolkom, tolko svet, tolko potolok", () => {
    expect(resolveOrderIntent({ discountMode: "with-ceiling" })).toBe("lighting_with_ceiling");
    expect(resolveOrderIntent({ discountMode: "lighting-only" })).toBe("lighting_only");
    expect(resolveOrderIntent({ discountMode: "none", lightingItemsCount: 3, hasRooms: false })).toBe(
      "lighting_only"
    );
    expect(resolveOrderIntent({ discountMode: "none", lightingItemsCount: 3, hasRooms: true })).toBe(
      "ceiling_only"
    );
    expect(resolveOrderIntent({})).toBe("ceiling_only");
  });

  it("entry: lighting-first vyigryvaet u placement", () => {
    expect(resolveLeadEntry({ placement: "rescue", entryMode: "lighting-first" })).toBe("lighting-first");
    expect(resolveLeadEntry({ placement: "modal", entryMode: "lighting-first" })).toBe("lighting-first");
    expect(resolveLeadEntry({ placement: "rescue", entryMode: "default" })).toBe("ceiling-first");
    expect(resolveLeadEntry({ placement: "modal" })).toBe("ceiling-first");
    expect(resolveLeadEntry({ placement: "home" })).toBe("direct");
    expect(resolveLeadEntry({ placement: "service-page", entryMode: null })).toBe("direct");
  });
});

describe("PT-004 - collectLeadAttribution", () => {
  function stubStorage(values: Record<string, string>) {
    vi.stubGlobal("window", {
      sessionStorage: { getItem: (key: string) => values[key] ?? null },
    } as unknown as Window);
  }

  it("beryot tolko allowlist kljuchey", () => {
    stubStorage({
      utm_source: "yandex",
      utm_campaign: "potolki",
      first_landing: "/?utm_source=yandex",
      first_referrer: "https://example.com",
      phone: "+79001234567",
      password: "secret",
    });

    const attribution = collectLeadAttribution();
    expect(attribution).toEqual({
      utm_source: "yandex",
      utm_campaign: "potolki",
      first_landing: "/?utm_source=yandex",
      first_referrer: "https://example.com",
    });
  });

  it("zablokirovannoe hranilische ne srivaet otpravku", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem() {
          throw new DOMException("Denied", "SecurityError");
        },
      },
    } as unknown as Window);

    expect(collectLeadAttribution()).toEqual({});
    expect(collectLeadAttribution({ fulfilment: "pickup" })).toEqual({ fulfilment: "pickup" });
  });

  it("extra perekryvaet znacheniya iz hranilischa", () => {
    stubStorage({ utm_source: "yandex" });
    expect(collectLeadAttribution({ utm_source: "manual", fulfilment: "delivery" })).toEqual({
      utm_source: "manual",
      fulfilment: "delivery",
    });
  });
});
