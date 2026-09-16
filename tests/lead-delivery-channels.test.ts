/**
 * PT-020 (A-13, F-14 · T-326) · HTTP-слой каналов доставки.
 *
 * До этой задачи `deliverToTelegram` и `deliverToWeb3Forms` не были проверены
 * ни одним тестом: везде, где они встречаются, модули заглушены через
 * `vi.mock`. Заглушка отвечает «успехом» и не умеет ни 429, ни обрыва
 * соединения, ни «HTTP 200, но success:false» — то есть ровно тех случаев,
 * из-за которых заявка теряется тихо.
 *
 * Здесь каналы вызываются по-настоящему, но запросы перехватывает фейковый
 * сервер на 127.0.0.1 (`tests/helpers/fake-delivery.ts`). Реальные вызовы в
 * Telegram/Web3Forms запрещены правилом 7 раздела 2 ТЗ, и перехват это
 * обеспечивает технически: любой внешний хост вне списка бросает исключение.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetEnvCache } from "@/lib/env";
import { deliverToTelegram } from "@/lib/lead/deliver-telegram";
import { deliverToWeb3Forms } from "@/lib/lead/deliver-web3forms";
import { LeadPayloadSchema, type LeadPayload } from "@/lib/lead/schema";
import {
  FAKE_TELEGRAM_TOKEN,
  FAKE_WEB3FORMS_KEY,
  startFakeDelivery,
  type FakeDeliveryServer,
} from "./helpers/fake-delivery";

/** Переменные, которые тест подменяет: их нужно вернуть, чтобы не задеть соседние файлы. */
const MANAGED_ENV = [
  "TELEGRAM_LEADS_ENABLED",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "WEB3FORMS_ACCESS_KEY",
  "DELIVERY_ALERT_ENABLED",
  "DELIVERY_ALERT_TELEGRAM_BOT_TOKEN",
  "DELIVERY_ALERT_TELEGRAM_CHAT_ID",
  "DELIVERY_ALERT_WEBHOOK_URL",
] as const;

const FAKE_CHAT_ID = "-1001234567890";

const TOTALS = {
  ceilingRaw: 56000,
  minimumApplied: false,
  installExtra: 0,
  lightingRegular: 8000,
  lightingEffective: 6000,
  discountPct: 25,
  grand: 62000,
};

/** Валидная заявка: каналы форматируют её тем же кодом, что и бой. */
function makePayload(phone = "+79161112233"): LeadPayload {
  return LeadPayloadSchema.parse({
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
      rooms: [
        { id: "r1", label: "Кухня", area: 12, totalRub: 24000, ceilingTypeLabel: "Простой потолок" },
        { id: "r2", label: "Спальня", area: 18, totalRub: 32000, ceilingTypeLabel: "Простой потолок" },
      ],
      lighting: null,
      totals: TOTALS,
      source: "home:hero",
      entry: "ceiling-first",
    },
    totals: TOTALS,
  });
}

describe("PT-020 · каналы доставки против фейкового HTTP-сервера", () => {
  let fake: FakeDeliveryServer;
  let savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    fake = await startFakeDelivery();
    savedEnv = Object.fromEntries(MANAGED_ENV.map((key) => [key, process.env[key]]));
  });

  afterAll(async () => {
    for (const key of MANAGED_ENV) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetEnvCache();
    await fake.close();
  });

  beforeEach(() => {
    fake.reset();
    fake.install();

    // Каналы настроены и включены — по умолчанию тест проверяет их поведение,
    // а не отсутствие конфигурации.
    process.env.TELEGRAM_LEADS_ENABLED = "1";
    process.env.TELEGRAM_BOT_TOKEN = FAKE_TELEGRAM_TOKEN;
    process.env.TELEGRAM_CHAT_ID = FAKE_CHAT_ID;
    process.env.WEB3FORMS_ACCESS_KEY = FAKE_WEB3FORMS_KEY;
    // Алерты PT-015 в этих тестах не участвуют: их канал выключен.
    process.env.DELIVERY_ALERT_ENABLED = "0";
    delete process.env.DELIVERY_ALERT_TELEGRAM_BOT_TOKEN;
    delete process.env.DELIVERY_ALERT_TELEGRAM_CHAT_ID;
    delete process.env.DELIVERY_ALERT_WEBHOOK_URL;
    resetEnvCache();
  });

  afterEach(() => {
    fake.uninstall();
  });

  describe("Telegram", () => {
    it("отправляет сообщение и возвращает ok:true", async () => {
      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result).toEqual({ ok: true });
      expect(fake.count("telegram")).toBe(1);

      const sent = fake.last("telegram");
      expect(sent?.method).toBe("POST");
      expect(sent?.path).toBe(`/bot${FAKE_TELEGRAM_TOKEN}/sendMessage`);

      const body = sent?.json as {
        chat_id: string;
        text: string;
        parse_mode: string;
        disable_web_page_preview: boolean;
      };
      expect(body.chat_id).toBe(FAKE_CHAT_ID);
      expect(body.parse_mode).toBe("HTML");
      expect(body.disable_web_page_preview).toBe(true);
      // В текст обязаны попасть данные, по которым владелец звонит клиенту.
      expect(body.text).toContain("+79161112233");
      expect(body.text).toContain("Иван");
      expect(body.text).toContain("AB12C");
    });

    it("при TELEGRAM_LEADS_ENABLED=0 не делает ни одного запроса", async () => {
      process.env.TELEGRAM_LEADS_ENABLED = "0";
      resetEnvCache();

      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result).toEqual({ ok: false, error: "TELEGRAM_LEADS_ENABLED=0" });
      expect(fake.requests).toHaveLength(0);
    });

    it("без токена или chat_id не делает ни одного запроса", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      resetEnvCache();
      expect(await deliverToTelegram(makePayload(), "AB12C")).toEqual({
        ok: false,
        error: "Telegram is not configured",
      });

      process.env.TELEGRAM_BOT_TOKEN = FAKE_TELEGRAM_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      resetEnvCache();
      expect(await deliverToTelegram(makePayload(), "AB12C")).toEqual({
        ok: false,
        error: "Telegram is not configured",
      });

      expect(fake.requests).toHaveLength(0);
    });

    it("429 (лимит Telegram) — это провал с текстом ошибки, а не исключение", async () => {
      fake.respond("telegram", {
        status: 429,
        json: { ok: false, description: "Too Many Requests: retry after 35" },
      });

      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("недостижимо");
      expect(result.error).toContain("429");
      expect(result.error).toContain("Too Many Requests");
    });

    it("500 — провал, задание останется крону", async () => {
      fake.respond("telegram", { status: 500, text: "internal error" });

      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("недостижимо");
      expect(result.error).toContain("500");
    });

    it("обрыв соединения — провал без исключения наружу", async () => {
      fake.respond("telegram", { dropConnection: true });

      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      expect(fake.count("telegram")).toBe(1);
    });

    it("медленный ответ всё же доставляется (таймаута у канала нет)", async () => {
      fake.respond("telegram", { delayMs: 120 });

      const result = await deliverToTelegram(makePayload(), "AB12C");

      expect(result).toEqual({ ok: true });
    });

    /**
     * Зафиксированное поведение, а не одобрение: канал смотрит только на
     * `response.ok`. Telegram при ошибке возвращает 4xx, поэтому на практике
     * тело `{ok:false}` со статусом 200 не встречается; но если встретится,
     * заявка будет помечена доставленной. Тест делает это решение видимым:
     * изменить его можно только осознанно, вместе с этим тестом.
     */
    it("HTTP 200 с телом {ok:false} сегодня считается успехом", async () => {
      fake.respond("telegram", { status: 200, json: { ok: false, description: "chat not found" } });

      expect(await deliverToTelegram(makePayload(), "AB12C")).toEqual({ ok: true });
    });
  });

  describe("Web3Forms", () => {
    it("отправляет форму и возвращает ok:true при {success:true}", async () => {
      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result).toEqual({ ok: true });
      expect(fake.count("web3forms")).toBe(1);

      const sent = fake.last("web3forms");
      expect(sent?.method).toBe("POST");
      expect(sent?.path).toBe("/submit");

      const body = sent?.json as Record<string, string>;
      expect(body.access_key).toBe(FAKE_WEB3FORMS_KEY);
      expect(body.from_name).toBe("ПОТОЛКОВО Сайт");
      expect(body.phone).toBe("+79161112233");
      expect(body.name).toBe("Иван");
      expect(body.subject).toBeTruthy();
      expect(body.message).toContain("AB12C");
    });

    it("HTTP 200 без success:true — это провал (главный контракт канала)", async () => {
      fake.respond("web3forms", { status: 200, json: { success: false, message: "Invalid access key" } });

      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      expect(fake.count("web3forms")).toBe(1);
    });

    it("200 с телом не-JSON — провал, а не исключение", async () => {
      fake.respond("web3forms", { status: 200, text: "<html>captcha</html>" });

      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("недостижимо");
      expect(result.error).toContain("200");
    });

    it("500 — провал", async () => {
      fake.respond("web3forms", { status: 500, text: "bad gateway" });

      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("недостижимо");
      expect(result.error).toContain("500");
    });

    it("обрыв соединения — провал без исключения наружу", async () => {
      fake.respond("web3forms", { dropConnection: true });

      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result.ok).toBe(false);
      expect(fake.count("web3forms")).toBe(1);
    });

    it("без WEB3FORMS_ACCESS_KEY не делает ни одного запроса", async () => {
      delete process.env.WEB3FORMS_ACCESS_KEY;
      resetEnvCache();

      const result = await deliverToWeb3Forms(makePayload(), "AB12C");

      expect(result).toEqual({ ok: false, error: "WEB3FORMS_ACCESS_KEY is not configured" });
      expect(fake.requests).toHaveLength(0);
    });
  });

  describe("изоляция от внешних сервисов (правило 7 раздела 2 ТЗ)", () => {
    it("запрос на неизвестный внешний хост запрещён", () => {
      expect(() => fetch("https://example.com/anything")).toThrow(/внешний вызов в тесте запрещён/);
      expect(() => fetch("https://api.telegram.org.evil.test/bot1/sendMessage")).toThrow(
        /внешний вызов в тесте запрещён/
      );
      expect(fake.requests).toHaveLength(0);
    });

    it("запрос к api.telegram.org физически уходит на 127.0.0.1", async () => {
      await deliverToTelegram(makePayload(), "AB12C");

      const sent = fake.last("telegram");
      // Сервер слушает только loopback: сам факт принятого запроса означает,
      // что наружу ничего не ушло.
      expect(sent?.path).toContain("/sendMessage");
      expect(fake.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });
  });
});
