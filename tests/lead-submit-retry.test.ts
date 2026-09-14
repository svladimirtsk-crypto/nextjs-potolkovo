/**
 * PT-013 · Повтор отправки после обрыва связи — с тем же `requestId`.
 *
 * Замер на сборке до правки: при имитации обрыва связи форма делала ровно один
 * запрос (`ABORT_REQUESTS: 1`) и показывала общий текст. При этом `timeout` —
 * отказ с неизвестным исходом: запрос мог дойти, и заявка могла сохраниться.
 * Тесты ниже закрепляют и повтор, и главное свойство повтора — тот же ключ
 * идемпотентности (PT-009), без которого вторая попытка создала бы дубль.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { peekRequestId, releaseRequestId } from "@/lib/lead/request-id";
import {
  LEAD_MAX_ATTEMPTS,
  shouldRetryAfter,
  submitLeadWithRetry,
} from "@/lib/lead/submit-retry";
import type { LeadSubmitFailureKind } from "@/lib/lead/submit-lead";

const PAYLOAD = { phone: "+79001234567", name: "Пётр", consent: true };

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

const SUCCESS_BODY = { ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" };

type Call = { requestId: string | null; body: Record<string, unknown> };

/** Транспорт по сценарию: каждый вызов берёт следующий элемент очереди. */
function scriptedFetch(
  steps: Array<
    | { kind: "response"; response: Response }
    | { kind: "throw" }
    | { kind: "hang" }
  >
) {
  const calls: Call[] = [];
  let index = 0;

  const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
    const parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({
      requestId: typeof parsed.requestId === "string" ? parsed.requestId : null,
      body: parsed,
    });

    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;

    if (step.kind === "throw") throw new TypeError("Failed to fetch");
    if (step.kind === "hang") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError"))
        );
      });
    }
    return step.response;
  }) as unknown as typeof fetch;

  return { fetchImpl, calls };
}

afterEach(() => {
  releaseRequestId();
  vi.unstubAllGlobals();
});

describe("PT-013 · повтор при обрыве связи", () => {
  it("сетевая ошибка повторяется один раз, ключ тот же", async () => {
    const { fetchImpl, calls } = scriptedFetch([{ kind: "throw" }, { kind: "throw" }]);

    const { result, attempts, retried } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(2);
    expect(retried).toBe(true);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[0].requestId).toBeTruthy();
    expect(calls[1].requestId).toBe(calls[0].requestId);
    // Содержимое не меняется между попытками — иначе сервер ответил бы 409.
    expect(calls[1].body).toEqual(calls[0].body);
  });

  it("таймаут повторяется, и заявка не дублируется", async () => {
    const { fetchImpl, calls } = scriptedFetch([{ kind: "hang" }, { kind: "hang" }]);

    const { result, attempts } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      timeoutMs: 5,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(2);
    if (result.ok) throw new Error("ожидался отказ");
    expect(result.kind).toBe("timeout");
    expect(calls[1].requestId).toBe(calls[0].requestId);
  });

  it("первая попытка оборвалась, вторая дошла — человек видит номер заявки", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { kind: "throw" },
      { kind: "response", response: jsonResponse(SUCCESS_BODY, { status: 201 }) },
    ]);

    const { result, attempts, retried } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(2);
    expect(retried).toBe(true);
    if (!result.ok) throw new Error("ожидался успех");
    expect(result.leadId).toBe("K7F3Q");
    expect(calls[1].requestId).toBe(calls[0].requestId);
    // Успех освобождает ключ: следующая заявка того же человека — новая запись.
    expect(peekRequestId()).toBeNull();
  });

  it("первый ответ — повтор уже сохранённой заявки (идемпотентный replay)", async () => {
    const { fetchImpl } = scriptedFetch([
      { kind: "hang" },
      {
        kind: "response",
        response: jsonResponse(
          { ...SUCCESS_BODY, idempotentReplay: true },
          { status: 200 }
        ),
      },
    ]);

    const { result } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      timeoutMs: 5,
      retryDelayMs: 0,
    });

    if (!result.ok) throw new Error("ожидался успех");
    expect(result.leadId).toBe("K7F3Q");
    expect(result.status).toBe(200);
  });

  it("число попыток ограничено: maxAttempts=3 делает три запроса", async () => {
    const { fetchImpl, calls } = scriptedFetch([{ kind: "throw" }]);

    const { attempts } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      maxAttempts: 3,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(3);
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.requestId)).size).toBe(1);
  });

  it("maxAttempts=1 выключает повтор", async () => {
    const { fetchImpl, calls } = scriptedFetch([{ kind: "throw" }]);

    const { attempts, retried } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      maxAttempts: 1,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(1);
    expect(retried).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("по умолчанию две попытки", () => {
    expect(LEAD_MAX_ATTEMPTS).toBe(2);
  });
});

describe("PT-013 · повтор бессмысленен — запрос один", () => {
  const cases: Array<{ kind: LeadSubmitFailureKind; status: number; body: unknown }> = [
    { kind: "validation", status: 422, body: { ok: false, error: "validation", issues: ["phone"] } },
    { kind: "ratelimit", status: 429, body: { ok: false, error: "rate_limited" } },
    { kind: "unavailable", status: 503, body: { ok: false, error: "storage_unavailable" } },
    { kind: "server", status: 409, body: { ok: false, error: "request_id_conflict" } },
  ];

  for (const testCase of cases) {
    it(`${testCase.status} → ${testCase.kind}: один запрос`, async () => {
      const { fetchImpl, calls } = scriptedFetch([
        { kind: "response", response: jsonResponse(testCase.body, { status: testCase.status }) },
      ]);

      const { result, attempts } = await submitLeadWithRetry(PAYLOAD, {
        fetchImpl,
        retryDelayMs: 0,
      });

      expect(attempts).toBe(1);
      expect(calls).toHaveLength(1);
      if (result.ok) throw new Error("ожидался отказ");
      expect(result.kind).toBe(testCase.kind);
    });
  }

  it("успех с первой попытки не повторяется", async () => {
    const { fetchImpl, calls } = scriptedFetch([
      { kind: "response", response: jsonResponse(SUCCESS_BODY, { status: 201 }) },
    ]);

    const { result, attempts, retried } = await submitLeadWithRetry(PAYLOAD, {
      fetchImpl,
      retryDelayMs: 0,
    });

    expect(attempts).toBe(1);
    expect(retried).toBe(false);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe("PT-013 · shouldRetryAfter", () => {
  it("повторяются только timeout и network", () => {
    const base = {
      ok: false as const,
      status: null,
      issues: [],
      retryAfterSec: null,
      serverMessage: null,
    };

    expect(shouldRetryAfter({ ...base, kind: "network" })).toBe(true);
    expect(shouldRetryAfter({ ...base, kind: "timeout" })).toBe(true);
    // Серверный отказ (500) сознательно не повторяется автоматически: ответ
    // получен, а повтор вручную есть в плашке ошибки.
    expect(shouldRetryAfter({ ...base, kind: "server", status: 500 })).toBe(false);
    expect(shouldRetryAfter({ ...base, kind: "validation", status: 422 })).toBe(false);
    expect(shouldRetryAfter({ ...base, kind: "ratelimit", status: 429 })).toBe(false);
    expect(shouldRetryAfter({ ...base, kind: "unavailable", status: 503 })).toBe(false);
    expect(
      shouldRetryAfter({ ok: true, status: 201, leadId: "K7F3Q", callbackWindow: "", deduped: false })
    ).toBe(false);
  });
});
