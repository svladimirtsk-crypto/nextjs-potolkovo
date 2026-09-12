/**
 * PT-009 · Отпечаток payload и жизненный цикл клиентского ключа.
 *
 * Здесь закреплены свойства, на которых держится идемпотентность:
 *
 *  - отпечаток не зависит от порядка ключей (иначе две отправки одной заявки,
 *    собранные разными ветками кода, выглядели бы разными и сервер отвечал 409);
 *  - отпечаток чувствителен к составу заказа (иначе дедуп снова поглощал бы
 *    содержательно другую заявку);
 *  - ключ живёт до успеха и меняется вместе с payload (иначе форма вставала бы
 *    намертво после 409).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { canonicalize, fnv1a32, leadPayloadFingerprint } from "@/lib/lead/canonical";
import { hashLeadPayload } from "@/lib/lead/payload-hash";
import {
  acquireRequestId,
  createRequestId,
  peekRequestId,
  releaseRequestId,
} from "@/lib/lead/request-id";
import { submitLead } from "@/lib/lead/submit-lead";

const PAYLOAD = {
  phone: "+79001234567",
  consent: true,
  source: "home",
  placement: "home",
  leadKind: "direct",
  orderIntent: "ceiling_only",
};

beforeEach(() => {
  releaseRequestId();
});

describe("PT-009 - canonicalize", () => {
  it("порядок ключей не влияет на результат", () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
    expect(canonicalize({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  it("вложенные объекты тоже сортируются", () => {
    expect(canonicalize({ x: { b: 1, a: 2 } })).toBe(canonicalize({ x: { a: 2, b: 1 } }));
  });

  it("undefined отбрасывается, null сохраняется", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(canonicalize({ a: 1, b: null })).toBe('{"a":1,"b":null}');
  });

  it("порядок элементов массива содержателен и сохраняется", () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("не конечные числа не ломают сравнение", () => {
    expect(canonicalize(Number.NaN)).toBe("null");
    expect(canonicalize(Number.POSITIVE_INFINITY)).toBe("null");
  });
});

describe("PT-009 - отпечаток payload", () => {
  it("не включает requestId: ключ не должен влиять на хеш содержимого", () => {
    expect(leadPayloadFingerprint({ ...PAYLOAD, requestId: "req-1" })).toBe(
      leadPayloadFingerprint({ ...PAYLOAD, requestId: "req-2" })
    );
  });

  it("не включает honeypot", () => {
    expect(leadPayloadFingerprint({ ...PAYLOAD, botcheck: "" })).toBe(
      leadPayloadFingerprint(PAYLOAD)
    );
  });

  it("hashLeadPayload одинаков для одинакового состава", () => {
    expect(hashLeadPayload({ ...PAYLOAD, requestId: "a-12345678" })).toBe(
      hashLeadPayload({ ...PAYLOAD, requestId: "b-87654321" })
    );
  });

  it("hashLeadPayload различает состав заказа", () => {
    const base = hashLeadPayload(PAYLOAD);
    expect(hashLeadPayload({ ...PAYLOAD, name: "Иван" })).not.toBe(base);
    expect(hashLeadPayload({ ...PAYLOAD, phone: "+79001234568" })).not.toBe(base);
    expect(hashLeadPayload({ ...PAYLOAD, leadKind: "rescue" })).not.toBe(base);
  });

  it("различие в одной позиции корзины света меняет хеш", () => {
    const lighting = {
      mode: "catalog",
      items: [{ sku: "A", name: "Точечный", qty: 4, priceRub: 350 }],
      regularTotalRub: 1400,
      effectiveTotalRub: 1400,
      discountMode: "none",
      discountPercentApplied: 0,
      discountAmountRub: 0,
    };

    const withFour = hashLeadPayload({ ...PAYLOAD, snapshot: { lighting } });
    const withFive = hashLeadPayload({
      ...PAYLOAD,
      snapshot: { lighting: { ...lighting, items: [{ ...lighting.items[0], qty: 5 }] } },
    });

    expect(withFive).not.toBe(withFour);
  });

  it("fnv1a32 детерминирован и различает вход", () => {
    expect(fnv1a32("abc")).toBe(fnv1a32("abc"));
    expect(fnv1a32("abc")).not.toBe(fnv1a32("abd"));
    expect(fnv1a32("")).toMatch(/^[0-9a-f]{8}$/);
    // Длинные строки: без Math.imul точность double ломала бы младшие разряды.
    expect(fnv1a32("x".repeat(5000))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("PT-009 - createRequestId", () => {
  it("форма UUID v4 и уникальность", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const id = createRequestId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
      seen.add(id);
    }
    expect(seen.size).toBe(200);
  });

  /**
   * `crypto.randomUUID` существует только в secure context. На `http://` в
   * локальной разработке его нет, и фолбэк обязан давать ту же форму — иначе
   * идемпотентность молча исчезала бы у всех, кто разрабатывает без HTTPS.
   */
  it("работает без crypto.randomUUID", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: { getRandomValues: original.getRandomValues.bind(original) },
    });

    try {
      expect(createRequestId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    } finally {
      Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
    }
  });
});

describe("PT-009 - жизненный цикл ключа", () => {
  it("тот же payload -> тот же ключ (двойной клик и повтор после сбоя)", () => {
    const first = acquireRequestId(PAYLOAD);
    const second = acquireRequestId(PAYLOAD);
    expect(second).toBe(first);
  });

  it("порядок ключей в payload не меняет ключ", () => {
    const first = acquireRequestId({ phone: "+79001234567", consent: true });
    const second = acquireRequestId({ consent: true, phone: "+79001234567" });
    expect(second).toBe(first);
  });

  it("изменившийся payload -> новый ключ, иначе сервер ответил бы 409 навсегда", () => {
    const first = acquireRequestId(PAYLOAD);
    const second = acquireRequestId({ ...PAYLOAD, name: "Иван" });
    expect(second).not.toBe(first);
  });

  it("requestId в payload не влияет на выбор ключа", () => {
    const first = acquireRequestId(PAYLOAD);
    const second = acquireRequestId({ ...PAYLOAD, requestId: "посторонний-ключ" });
    expect(second).toBe(first);
  });

  it("после release ключ новый — успешная отправка завершает попытку", () => {
    const first = acquireRequestId(PAYLOAD);
    releaseRequestId();
    expect(peekRequestId()).toBeNull();

    const second = acquireRequestId(PAYLOAD);
    expect(second).not.toBe(first);
  });
});

describe("PT-009 - submitLead подставляет ключ", () => {
  /**
   * Транспорт-заглушка.
   *
   * `Response` одноразовый: `json()` можно прочитать один раз, поэтому на
   * несколько вызовов отдаём фабрику, а не готовый объект.
   */
  function stubFetch(response: Response | (() => Response)) {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return typeof response === "function" ? response() : response;
    }) as unknown as typeof fetch;
    return { fetchImpl, bodies };
  }

  const okResponse = () =>
    new Response(JSON.stringify({ ok: true, leadId: "K7F3Q", callbackWindow: "" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });

  const rateLimited = () =>
    new Response(JSON.stringify({ ok: false, error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });

  it("две попытки одного payload уходят с одним ключом", async () => {
    const { fetchImpl, bodies } = stubFetch(rateLimited);

    await submitLead(PAYLOAD, { fetchImpl });
    await submitLead(PAYLOAD, { fetchImpl });

    expect(bodies[0].requestId).toBeTruthy();
    expect(bodies[1].requestId).toBe(bodies[0].requestId);
  });

  it("поправка в форме после неудачи уходит с новым ключом", async () => {
    const { fetchImpl, bodies } = stubFetch(rateLimited);

    await submitLead(PAYLOAD, { fetchImpl });
    await submitLead({ ...PAYLOAD, name: "Иван" }, { fetchImpl });

    expect(bodies[1].requestId).not.toBe(bodies[0].requestId);
  });

  it("после успеха ключ сбрасывается — следующая заявка создаётся заново", async () => {
    const { fetchImpl, bodies } = stubFetch(okResponse);

    await submitLead(PAYLOAD, { fetchImpl });
    await submitLead(PAYLOAD, { fetchImpl });

    expect(bodies[1].requestId).not.toBe(bodies[0].requestId);
    expect(peekRequestId()).toBeNull();
  });

  it("после 409 ключ сбрасывается, иначе форма встала бы намертво", async () => {
    const conflict = stubFetch(
      new Response(JSON.stringify({ ok: false, error: "request_id_conflict" }), { status: 409 })
    );
    const first = await submitLead(PAYLOAD, { fetchImpl: conflict.fetchImpl });

    expect(first.ok).toBe(false);
    expect(peekRequestId()).toBeNull();

    const retry = stubFetch(okResponse);
    await submitLead(PAYLOAD, { fetchImpl: retry.fetchImpl });
    expect(retry.bodies[0].requestId).not.toBe(conflict.bodies[0].requestId);
  });

  it("явно переданный requestId уважаем — путь для повтора после таймаута", async () => {
    const { fetchImpl, bodies } = stubFetch(rateLimited);

    await submitLead({ ...PAYLOAD, requestId: "свой-ключ-12345" }, { fetchImpl });
    expect(bodies[0].requestId).toBe("свой-ключ-12345");
  });

  it("сетевой сбой сохраняет ключ — повтор уходит тем же", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const first = await submitLead(PAYLOAD, { fetchImpl });
    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.kind).toBe("network");

    // Попытка не завершена — ключ обязан сохраниться до успеха.
    const pendingKey = peekRequestId();
    expect(pendingKey).not.toBeNull();

    const retry = stubFetch(okResponse);
    await submitLead(PAYLOAD, { fetchImpl: retry.fetchImpl });
    expect(retry.bodies[0].requestId).toBe(pendingKey);
    // Успех закрывает попытку.
    expect(peekRequestId()).toBeNull();
  });
});
