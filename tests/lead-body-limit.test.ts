/**
 * PT-021 · Лимит тела заявки и IP под нагрузкой — на живом роуте.
 *
 * Сеть не трогаем: каналы доставки замоканы. Хранилище — in-memory, поэтому
 * можно проверить главное требование: при `413` заявка не сохраняется и не
 * отправляется.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_MAX_BODY_BYTES } from "@/lib/lead/read-json-body";
import { checkRateLimit, resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { getLeadStore, resetLeadStoreForTests } from "@/lib/lead/store";

vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true }) as const),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true }) as const),
}));

import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { POST } from "@/app/api/lead/route";

const payload = {
  name: "Иван",
  phone: "+7 905 521 99 09",
  consent: true,
  source: "home",
  placement: "home",
  pagePath: "/",
  leadKind: "direct",
};

function jsonRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimitForTests();
  resetLeadStoreForTests();
  vi.mocked(deliverToTelegram).mockClear();
  vi.mocked(deliverToWeb3Forms).mockClear();
});

describe("PT-021 · лимит тела", () => {
  it("обычная заявка проходит как раньше", async () => {
    const response = await POST(jsonRequest(payload));
    expect(response.status).toBe(201);
  });

  it("честный Content-Length больше лимита → 413 без записи и доставки", async () => {
    const response = await POST(
      jsonRequest(payload, { "content-length": String(LEAD_MAX_BODY_BYTES + 1) })
    );

    expect(response.status).toBe(413);
    const json = (await response.json()) as { error: string; limitBytes: number };
    expect(json.error).toBe("payload_too_large");
    expect(json.limitBytes).toBe(LEAD_MAX_BODY_BYTES);

    // Заявка не дошла до хранилища: искать по телефону нечего.
    const store = getLeadStore();
    expect(await store.findRecentDuplicate("+79055219909", null, 10 * 60 * 1000)).toBeNull();
    expect(deliverToTelegram).not.toHaveBeenCalled();
    expect(deliverToWeb3Forms).not.toHaveBeenCalled();
  });

  it("заниженный Content-Length не обходит лимит: считаются фактические байты", async () => {
    const padded = { ...payload, padding: "x".repeat(LEAD_MAX_BODY_BYTES) };
    const response = await POST(jsonRequest(padded, { "content-length": "10" }));
    expect(response.status).toBe(413);
  });

  it("chunked-тело без Content-Length обрывается на превышении", async () => {
    const encoder = new TextEncoder();
    const chunk = encoder.encode("x".repeat(64 * 1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 8) {
          controller.close();
          return;
        }
        sent += 1;
        controller.enqueue(chunk);
      },
    });

    const request = new Request("http://localhost/api/lead", {
      method: "POST",
      // @ts-expect-error — Node требует duplex для потокового тела запроса
      duplex: "half",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.11" },
      body: stream,
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    // Поток оборван — оставшиеся чанки не дочитываются.
    expect(sent).toBeLessThan(8);
  });

  it("битый JSON — 400, как и раньше", async () => {
    const request = new Request("http://localhost/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.12" },
      body: "{ не json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("invalid_json");
  });

  it("многобайтная кириллица, разрезанная между чанками, читается без порчи", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ ...payload, name: "Иван Ёлкин" }));
    // Режем ровно внутрь двухбайтовой «И» (0xD0 0x98).
    const cut = bytes.indexOf(0xd0) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, cut));
        controller.enqueue(bytes.slice(cut));
        controller.close();
      },
    });

    const request = new Request("http://localhost/api/lead", {
      method: "POST",
      // @ts-expect-error — Node требует duplex для потокового тела запроса
      duplex: "half",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.13" },
      body: stream,
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("валидная заявка чуть меньше лимита проходит", async () => {
    const almost = { ...payload, padding: "x".repeat(1024) };
    const size = new TextEncoder().encode(JSON.stringify(almost)).byteLength;
    expect(size).toBeLessThan(LEAD_MAX_BODY_BYTES);

    const response = await POST(jsonRequest(almost));
    expect(response.status).toBe(201);
  });
});

describe("PT-021 · ключ лимита не подделывается заголовком", () => {
  it("разные подделанные XFF при одном реальном адресе — один лимит", async () => {
    // Клиент меняет «свой» первый элемент, прокси всегда дописывает один и тот
    // же реальный адрес справа.
    for (let i = 0; i < 5; i += 1) {
      const response = await POST(
        jsonRequest({ ...payload, phone: `+7916000000${i}` }, {
          "x-forwarded-for": `10.9.9.${i}, 198.51.100.77`,
        })
      );
      expect(response.status).toBe(201);
    }

    const sixth = await POST(
      jsonRequest({ ...payload, phone: "+79160000009" }, { "x-forwarded-for": "10.9.9.99, 198.51.100.77" })
    );
    expect(sixth.status).toBe(429);
  });

  it("лимит привязан к доверенному адресу, а не к подделке", async () => {
    expect(checkRateLimit("198.51.100.78").allowed).toBe(true);
  });
});
