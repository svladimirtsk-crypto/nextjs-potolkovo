/**
 * PT-009 · Идемпотентность вместо дедупа по телефону.
 *
 * Два критерия приёмки из раздела 6 ТЗ, которые проверяются здесь напрямую:
 *
 *  1. «Двойной клик „Отправить“ с одинаковым payload создаёт одну запись и одно
 *     задание доставки»;
 *  2. «Rescue → полная заявка с тем же телефоном в течение 10 минут создаёт
 *     вторую, полную запись, не возвращает код rescue-заявки».
 *
 * Второй критерий — это ровно та дыра, которую закрывала задача: прежний
 * `findRecentByPhone` возвращал любую недавнюю заявку с этим номером, поэтому
 * состав полного расчёта не сохранялся нигде.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCache } from "@/lib/env";
import { resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { getLeadStore, resetLeadStoreForTests } from "@/lib/lead/store";

// Моки внешних каналов — сеть в тестах не трогаем и в боевые каналы не шлём.
vi.mock("@/lib/lead/deliver-telegram", () => ({
  deliverToTelegram: vi.fn(async () => ({ ok: true }) as const),
}));
vi.mock("@/lib/lead/deliver-web3forms", () => ({
  deliverToWeb3Forms: vi.fn(async () => ({ ok: true }) as const),
}));

import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { POST } from "@/app/api/lead/route";

const IP = "10.0.0.7";

function makeRequest(body: unknown, ip = IP): Request {
  return new Request("http://localhost/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

/** Полная заявка из основной формы. */
const fullPayload = {
  name: "Иван",
  phone: "+7 905 521 99 09",
  consent: true as const,
  source: "home",
  placement: "home" as const,
  pagePath: "/",
  leadKind: "direct" as const,
  orderIntent: "ceiling_only" as const,
};

/** Короткая rescue-заявка: тот же телефон, другой состав. */
const rescuePayload = {
  phone: "+7 905 521 99 09",
  consent: true as const,
  source: "calculator",
  placement: "rescue" as const,
  pagePath: "/",
  leadKind: "rescue" as const,
  grandTotal: 62000,
};

type LeadResponse = {
  ok: boolean;
  leadId?: string | null;
  status?: number;
  deduped?: boolean;
  idempotentReplay?: boolean;
  error?: string;
  issues?: string[];
};

async function send(body: unknown): Promise<{ status: number; json: LeadResponse }> {
  const response = await POST(makeRequest(body));
  return { status: response.status, json: (await response.json()) as LeadResponse };
}

/**
 * Доставка запускается через `void deliverAll(...)` и ответ её не ждёт (PT-003),
 * поэтому перед подсчётом вызовов нужно дать микрозадачам завершиться.
 */
async function flushDelivery(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  resetRateLimitForTests();
  resetLeadStoreForTests();
  vi.mocked(deliverToTelegram).mockClear();
  vi.mocked(deliverToWeb3Forms).mockClear();
});

describe("PT-009 - идемпотентность: один requestId", () => {
  it("двойная отправка одного payload -> одна запись и один комплект доставки", async () => {
    const first = await send({ ...fullPayload, requestId: "req-double-click" });
    const second = await send({ ...fullPayload, requestId: "req-double-click" });

    expect(first.status).toBe(201);
    expect(first.json.ok).toBe(true);

    // Повтор — не создание: 200 и явный признак, что это прежняя заявка.
    expect(second.status).toBe(200);
    expect(second.json.ok).toBe(true);
    expect(second.json.idempotentReplay).toBe(true);
    expect(second.json.leadId).toBe(first.json.leadId);

    await flushDelivery();

    // Критерий приёмки: задание доставки ровно одно, несмотря на два запроса.
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
    expect(deliverToWeb3Forms).toHaveBeenCalledTimes(1);
  });

  it("повтор после таймаута отдаёт тот же код заявки, а не новую строку", async () => {
    const first = await send({ ...fullPayload, requestId: "req-timeout-retry" });

    // Имитация клиента, который не дождался ответа и отправил снова.
    const retry = await send({ ...fullPayload, requestId: "req-timeout-retry" });

    expect(retry.json.ok).toBe(true);
    expect(retry.json.leadId).toBe(first.json.leadId);
    expect(retry.json.idempotentReplay).toBe(true);
  });

  it("тот же requestId с другим payload -> 409, второй записи нет", async () => {
    const first = await send({ ...fullPayload, requestId: "req-conflict" });
    const conflict = await send({
      ...fullPayload,
      name: "Пётр",
      requestId: "req-conflict",
    });

    expect(first.status).toBe(201);
    expect(conflict.status).toBe(409);
    expect(conflict.json.ok).toBe(false);
    expect(conflict.json.error).toBe("request_id_conflict");

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });

  /**
   * Гонка, которую не ловит проверка «существует ли заявка»: оба запроса
   * проходят её до вставки. Ловит unique-индекс, а проигравший обязан отдать
   * успешный ответ — заявка-то создана.
   */
  it("два параллельных запроса с одним requestId -> одна запись, оба ответа успешны", async () => {
    const body = { ...fullPayload, requestId: "req-race" };

    const [a, b] = await Promise.all([send(body), send(body)]);

    expect(a.json.ok).toBe(true);
    expect(b.json.ok).toBe(true);
    expect(a.json.leadId).toBe(b.json.leadId);
    // Ровно один из двух — первоначальное принятие, второй — повтор.
    expect([a.status, b.status].sort()).toEqual([200, 201]);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
    expect(deliverToWeb3Forms).toHaveBeenCalledTimes(1);
  });

  it("повтор не тратит бюджет серверного rate-limit", async () => {
    // RATE_LIMIT_MAX = 5: если бы повтор считался новой заявкой, шестой запрос
    // с тем же ключом получил бы 429 при всего одной реальной заявке.
    const body = { ...fullPayload, requestId: "req-budget" };

    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await send(body)).status);
    }

    expect(statuses[0]).toBe(201);
    expect(statuses.slice(1)).toEqual([200, 200, 200, 200]);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });

  it("разные requestId при одном payload -> дедуп по телефону и отпечатку", async () => {
    const first = await send({ ...fullPayload, requestId: "req-alpha" });
    const second = await send({ ...fullPayload, requestId: "req-bravo" });

    expect(first.status).toBe(201);
    // Ключ другой, значит идемпотентность не при чём — срабатывает анти-спам
    // эвристика: тот же телефон и то же содержимое в пределах окна.
    expect(second.status).toBe(200);
    expect(second.json.deduped).toBe(true);
    expect(second.json.idempotentReplay).toBeUndefined();
    expect(second.json.leadId).toBe(first.json.leadId);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });
});

describe("PT-009 - тот же телефон, другой состав", () => {
  it("rescue -> полная заявка в течение 10 минут создаёт вторую запись", async () => {
    const rescue = await send({ ...rescuePayload, requestId: "req-rescue" });
    const full = await send({ ...fullPayload, requestId: "req-full" });

    expect(rescue.status).toBe(201);
    expect(full.status).toBe(201);
    // Ключевой критерий приёмки: код полной заявки — НЕ код rescue-заявки.
    expect(full.json.leadId).not.toBe(rescue.json.leadId);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(2);
    expect(deliverToWeb3Forms).toHaveBeenCalledTimes(2);
  });

  it("полная заявка сохраняет свой состав, а не подменяется rescue", async () => {
    const rescue = await send({ ...rescuePayload, requestId: "req-rescue-2" });
    const full = await send({ ...fullPayload, requestId: "req-full-2" });

    const store = getLeadStore();
    const rescueLead = await store.getLeadByPublicCode(String(rescue.json.leadId));
    const fullLead = await store.getLeadByPublicCode(String(full.json.leadId));

    expect(rescueLead?.payload.leadKind).toBe("rescue");
    expect(fullLead?.payload.leadKind).toBe("direct");
    expect(fullLead?.payload.name).toBe("Иван");
    expect(fullLead?.payloadHash).toBeTruthy();
    expect(fullLead?.payloadHash).not.toBe(rescueLead?.payloadHash);
  });

  it("изменившийся состав заказа с тем же телефоном -> новая запись", async () => {
    const first = await send({
      ...fullPayload,
      address: "Ленина 1",
      requestId: "req-order-1",
    });
    const changed = await send({
      ...fullPayload,
      address: "Ленина 2",
      requestId: "req-order-2",
    });

    expect(first.status).toBe(201);
    expect(changed.status).toBe(201);
    expect(changed.json.leadId).not.toBe(first.json.leadId);
  });
});

describe("PT-009 - совместимость со старым клиентом", () => {
  /**
   * Раздел 3.8: на время миграции API обязан принимать запросы от JS,
   * собранного до деплоя. Такой клиент не шлёт `requestId`, и заявка всё равно
   * не должна дублироваться.
   */
  it("без requestId дедуп по телефону и содержимому продолжает работать", async () => {
    const first = await send(fullPayload);
    const second = await send(fullPayload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.json.deduped).toBe(true);
    expect(second.json.leadId).toBe(first.json.leadId);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });

  it("без requestId заявка с другим составом всё равно создаётся", async () => {
    const first = await send(fullPayload);
    const second = await send({ ...fullPayload, name: "Мария" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.json.leadId).not.toBe(first.json.leadId);
  });

  it("requestId короче 8 символов отклоняется как невалидное поле", async () => {
    const response = await send({ ...fullPayload, requestId: "abc" });
    expect(response.status).toBe(422);
    expect(response.json.issues).toContain("requestId");
  });
});

/**
 * PT-009 · Аварийный откат флагом `LEAD_IDEMPOTENCY_ENABLED=0`.
 *
 * Правило 8 раздела 2 ТЗ требует, чтобы новую логику приёма заявок можно было
 * выключить без деплоя. Тесты ниже фиксируют, что рубильник реально что-то
 * переключает — и честно документируют, чего стоит его выключение: вместе с
 * идемпотентностью возвращается и дефект с потерей состава заявки.
 */
describe("PT-009 - флаг LEAD_IDEMPOTENCY_ENABLED=0", () => {
  beforeEach(() => {
    process.env.LEAD_IDEMPOTENCY_ENABLED = "0";
    resetEnvCache();
  });

  afterEach(() => {
    delete process.env.LEAD_IDEMPOTENCY_ENABLED;
    resetEnvCache();
  });

  it("повтор requestId больше не разбирается: срабатывает прежний дедуп по телефону", async () => {
    const body = { ...fullPayload, requestId: "req-flag-off" };

    const first = await send(body);
    const second = await send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    // Признак идемпотентного повтора не выдаётся — ветка выключена.
    expect(second.json.idempotentReplay).toBeUndefined();
    expect(second.json.deduped).toBe(true);
    expect(second.json.leadId).toBe(first.json.leadId);
  });

  it("тот же requestId с другим payload не даёт 409", async () => {
    const first = await send({ ...fullPayload, requestId: "req-flag-conflict" });
    const second = await send({ ...fullPayload, name: "Пётр", requestId: "req-flag-conflict" });

    expect(first.status).toBe(201);
    expect(second.status).not.toBe(409);
  });

  /**
   * Это и есть цена выключенного флага: полная заявка снова получает код
   * rescue-заявки, а её состав не сохраняется. Тест закрепляет поведение, чтобы
   * откат не выглядел «бесплатным» для того, кто решит им воспользоваться.
   */
  it("возвращается прежний дефект: полная заявка после rescue получает её код", async () => {
    const rescue = await send({ ...rescuePayload, requestId: "req-flag-rescue" });
    const full = await send({ ...fullPayload, requestId: "req-flag-full" });

    expect(rescue.status).toBe(201);
    expect(full.status).toBe(200);
    expect(full.json.deduped).toBe(true);
    expect(full.json.leadId).toBe(rescue.json.leadId);

    await flushDelivery();
    expect(deliverToTelegram).toHaveBeenCalledTimes(1);
  });
});
