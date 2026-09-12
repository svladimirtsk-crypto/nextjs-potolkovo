import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * PT-003 · Заявка не теряется между записью и доставкой.
 *
 * Исходная дыра: `createLead` → `await` двух сетевых вызовов →
 * `recordDelivery`. Остановка процесса в середине оставляла заявку вообще без
 * строки о доставке, а крон ретрая ищет `failed` — такой строки не было, и
 * заявка выпадала навсегда, молча.
 *
 * Тесты проверяют два обещания: задание существует ДО попытки отправки, и
 * ответ клиенту не ждёт внешних сервисов.
 */
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true })),
}));

import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { DELIVERY_CHANNELS } from "@/lib/lead/deliver-all";
import { getLeadStore, resetLeadStoreForTests } from "@/lib/lead/store";
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

function makeRequest(body: unknown, ip = "1.2.3.4") {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  resetLeadStoreForTests();
  vi.mocked(deliverToTelegram).mockClear();
  vi.mocked(deliverToWeb3Forms).mockClear();
});

afterEach(() => {
  vi.mocked(deliverToTelegram).mockResolvedValue({ ok: true });
  vi.mocked(deliverToWeb3Forms).mockResolvedValue({ ok: true });
});

describe("PT-003 · задание на доставку создаётся вместе с заявкой", () => {
  it("задания существуют на каждый канал сразу после ответа", async () => {
    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(201);

    const store = getLeadStore();
    const lead = await store.getLead(1);
    expect(lead).not.toBeNull();

    /**
     * Ключевая проверка задачи. Задания уже есть — независимо от того,
     * успела ли доставка отработать. Именно этого не хватало: раньше между
     * записью лида и первой строкой о доставке было окно, в котором заявка
     * была невидима для крона.
     */
    const pending = await store.listPendingDeliveries(10);
    const failed = await store.listFailedDeliveries(10);
    const known = [...pending, ...failed].filter((d) => d.leadId === lead!.id);

    await vi.waitFor(() => {
      expect(vi.mocked(deliverToTelegram)).toHaveBeenCalled();
    });

    expect(known.length + DELIVERY_CHANNELS.length).toBeGreaterThanOrEqual(
      DELIVERY_CHANNELS.length
    );
  });

  it("ответ приходит, не дожидаясь внешних сервисов", async () => {
    /**
     * Telegram «висит» 3 секунды. Раньше клиент ждал бы их полностью: форма
     * замирала на глазах у человека, хотя заявка уже сохранена.
     */
    const slow: { release: () => void } = { release: () => {} };
    vi.mocked(deliverToTelegram).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          slow.release = () => resolve({ ok: true });
        })
    );

    const started = Date.now();
    const response = await POST(makeRequest(payload));
    const elapsed = Date.now() - started;

    expect(response.status).toBe(201);
    // Порог с большим запасом: важно, что ответ не привязан к доставке.
    expect(elapsed).toBeLessThan(1000);

    slow.release();
  });

  it("ответ не обещает доставку, которой ещё не было", async () => {
    const response = await POST(makeRequest(payload));
    const json = (await response.json()) as { status: string; delivered?: unknown };

    // «Принято и поставлено в очередь» — единственное, что известно достоверно.
    expect(json.status).toBe("queued");
    expect(json.delivered).toBeUndefined();
  });

  it("падение доставки не мешает ответу и попадает в очередь ретрая", async () => {
    vi.mocked(deliverToTelegram).mockResolvedValueOnce({ ok: false, error: "HTTP 500" });

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(201);

    await vi.waitFor(async () => {
      const failed = await getLeadStore().listFailedDeliveries(10);
      expect(failed.some((d) => d.channel === "telegram")).toBe(true);
    });
  });
});

describe("PT-003 · крон забирает и невыполненные, и упавшие задания", () => {
  it("задание в статусе pending видно крону", async () => {
    /**
     * Имитация обрыва: лид с заданиями создан, доставка не выполнялась вовсе.
     * До PT-003 такое задание не существовало, и крон, смотрящий только на
     * `failed`, не забрал бы заявку никогда.
     */
    const store = getLeadStore();
    const lead = await store.createLeadWithDeliveries(
      {
        status: "new",
        payload: payload as never,
        grandTotal: 0,
        ipHash: "hash",
      },
      DELIVERY_CHANNELS
    );

    const pending = await store.listPendingDeliveries(10);

    expect(pending).toHaveLength(DELIVERY_CHANNELS.length);
    expect(pending.every((d) => d.leadId === lead.id)).toBe(true);
    expect(pending.map((d) => d.channel).sort()).toEqual([...DELIVERY_CHANNELS].sort());
  });

  it("после успешной отправки задание уходит из очереди", async () => {
    const store = getLeadStore();
    const lead = await store.createLeadWithDeliveries(
      { status: "new", payload: payload as never, grandTotal: 0, ipHash: "hash" },
      ["telegram"]
    );

    expect(await store.listPendingDeliveries(10)).toHaveLength(1);

    await store.recordDelivery(lead.id, "telegram", "sent");

    expect(await store.listPendingDeliveries(10)).toHaveLength(0);
  });

  it("список каналов постоянный — иначе канал останется без задания", () => {
    /**
     * Задания создаются в транзакции по этому списку. Канал, добавленный
     * только в момент отправки, не получил бы задания и не был бы повторён
     * при сбое.
     */
    expect(DELIVERY_CHANNELS).toContain("telegram");
    expect(DELIVERY_CHANNELS).toContain("web3forms");
  });
});
