import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { getLeadStore, resetLeadStoreForTests } from "@/lib/lead/store";

// Моки внешних каналов — сеть в тестах не трогаем.
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true }) as const),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true }) as const),
}));

import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { POST } from "@/app/api/lead/route";

function makeRequest(body: unknown, ip = "10.0.0.1"): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

const payload = {
  name: "Иван",
  phone: "+7 905 521 99 09",
  consent: true,
  source: "home",
  placement: "home",
  pagePath: "/",
  leadKind: "direct",
};

beforeEach(() => {
  resetRateLimitForTests();
  resetLeadStoreForTests();
  vi.mocked(deliverToTelegram).mockClear();
  vi.mocked(deliverToWeb3Forms).mockClear();
});

describe("T-027 - POST /api/lead", () => {
  it("201 + zapis v hranilishche + dostavka v oba kanala", async () => {
    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(201);

    const json = (await response.json()) as {
      ok: boolean;
      leadId: string;
      callbackWindow: string;
      delivered: { telegram: boolean; web3forms: boolean };
    };
    expect(json.ok).toBe(true);
    expect(json.leadId).toMatch(/^[A-Z2-9]{5}$/);
    expect(json.callbackWindow).toBeTruthy();
    expect(json.delivered).toEqual({ telegram: true, web3forms: true });

    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
    expect(deliverToWeb3Forms).toHaveBeenCalledTimes(1);

    const stored = await getLeadStore().getLead(1);
    expect(stored?.payload.phone).toBe("+79055219909");
    expect(stored?.status).toBe("new");
    expect(stored?.ipHash).toBeTruthy();
  });

  it("422 na nevalidnom telefone", async () => {
    const response = await POST(makeRequest({ ...payload, phone: "123" }));
    expect(response.status).toBe(422);
    const json = (await response.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe("validation");
  });

  it("honeypot: otvechaem ok, no lead ne sozdaetsya", async () => {
    const response = await POST(makeRequest({ ...payload, botcheck: "spam" }));
    expect(response.status).toBe(200);
    const json = (await response.json()) as { ok: boolean; leadId: null };
    expect(json.ok).toBe(true);
    expect(json.leadId).toBeNull();
    expect(deliverToTelegram).not.toHaveBeenCalled();
  });

  it("dedup: povtor s tem zhe telefonom vozvrashchaet tot zhe leadId", async () => {
    const first = await POST(makeRequest(payload));
    const firstJson = (await first.json()) as { leadId: string };

    const second = await POST(makeRequest(payload));
    const secondJson = (await second.json()) as { leadId: string; deduped?: boolean };

    expect(secondJson.leadId).toBe(firstJson.leadId);
    expect(secondJson.deduped).toBe(true);
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });

  it("6-y zapros za 10 min -> 429 s Retry-After", async () => {
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(makeRequest({ ...payload, phone: `+790552199${10 + i}` }, "5.5.5.5"));
      expect(r.status, `запрос ${i + 1}`).toBe(201);
    }
    const blocked = await POST(makeRequest({ ...payload, phone: "+79055219999" }, "5.5.5.5"));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    const json = (await blocked.json()) as { error: string };
    expect(json.error).toBe("rate_limited");
  });

  it("upavshaya dostavka ne roniaet otvet i pishetsya kak failed", async () => {
    vi.mocked(deliverToTelegram).mockResolvedValueOnce({ ok: false, error: "HTTP 500" });

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(201);
    const json = (await response.json()) as { delivered: { telegram: boolean } };
    expect(json.delivered.telegram).toBe(false);

    const failed = await getLeadStore().listFailedDeliveries(10);
    expect(failed).toHaveLength(1);
    expect(failed[0].channel).toBe("telegram");
    expect(failed[0].lastError).toBe("HTTP 500");
  });

  it("rescue-lead sohranyaetsya so statusom rescue", async () => {
    const response = await POST(
      makeRequest({
        phone: "+79001234567",
        consent: true,
        source: "modal",
        placement: "rescue",
        leadKind: "rescue",
        pagePath: "/",
        grandTotal: 72000,
      })
    );
    expect(response.status).toBe(201);
    const stored = await getLeadStore().getLead(1);
    expect(stored?.status).toBe("rescue");
    expect(stored?.grandTotal).toBe(72000);
  });

  it("bitiy JSON -> 400", async () => {
    const request = new Request("http://localhost/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
