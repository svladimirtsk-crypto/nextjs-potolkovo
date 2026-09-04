import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveCallbackWindow } from "@/lib/lead/callback-window";
import { formatLeadBody, formatLeadSubject } from "@/lib/lead/format-lead";
import { RATE_LIMIT_MAX, checkRateLimit, resetRateLimitForTests } from "@/lib/lead/rate-limit";
import { LeadPayloadSchema } from "@/lib/lead/schema";
import { resetLeadStoreForTests } from "@/lib/lead/store";

const basePayload = {
  name: "Иван",
  phone: "8 905 521 99 09",
  consent: true,
  source: "tenevoy-profil:hero",
  placement: "service-page",
  pagePath: "/uslugi/tenevoy-profil",
  serviceSlug: "tenevoy-profil",
  leadKind: "calculator",
  orderIntent: "lighting_with_ceiling",
  attribution: { utm_source: "yandex" },
  snapshot: {
    version: 2,
    scenario: "modern",
    scope: "room",
    rooms: [
      {
        id: "r1",
        label: "Кухня",
        area: 24,
        totalRub: 35150,
        ceilingTypeLabel: "Теневой",
        shadowLength: 17,
        trackLabel: "Встроенный трек",
        trackLength: 10,
        lightsCount: 6,
      },
      {
        id: "r2",
        label: "Гостиная",
        area: 24,
        totalRub: 24000,
        ceilingTypeLabel: "Простой потолок",
      },
    ],
    lighting: {
      mode: "catalog",
      items: [
        {
          sku: "p1",
          vendorCode: "0У-00001341",
          name: "Шинопровод КОЛИБРИ 2000 мм",
          qty: 5,
          priceRub: 5082,
          unit: "шт.",
        },
        {
          sku: "p2",
          vendorCode: "0У-00001343",
          name: "Ввод питания",
          qty: 1,
          priceRub: 800,
          auto: true,
        },
      ],
      regularTotalRub: 26210,
      effectiveTotalRub: 19658,
      discountMode: "with-ceiling",
      discountPercentApplied: 25,
      discountAmountRub: 6552,
    },
    totals: {
      ceilingRaw: 59150,
      minimumApplied: false,
      installExtra: 2500,
      lightingRegular: 26210,
      lightingEffective: 19658,
      discountPct: 25,
      grand: 81308,
    },
    source: "tenevoy-profil:hero",
    entry: "ceiling-first",
  },
};

beforeEach(() => {
  resetRateLimitForTests();
  resetLeadStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("T-027 - zod-shema payload", () => {
  it("normalizuet telefon 8... -> +7...", () => {
    const parsed = LeadPayloadSchema.parse(basePayload);
    expect(parsed.phone).toBe("+79055219909");
  });

  it("otklonyaet korotkiy telefon", () => {
    const result = LeadPayloadSchema.safeParse({ ...basePayload, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("trebuet consent", () => {
    const { consent: _consent, ...rest } = basePayload;
    expect(LeadPayloadSchema.safeParse(rest).success).toBe(false);
  });

  it("orderIntent po umolchaniyu ceiling_only", () => {
    const { orderIntent: _oi, ...rest } = basePayload;
    expect(LeadPayloadSchema.parse(rest).orderIntent).toBe("ceiling_only");
  });
});

describe("T-027 - format-lead", () => {
  const payload = LeadPayloadSchema.parse(basePayload);

  it("tema pisma", () => {
    expect(formatLeadSubject(payload).replace(/\u00a0/g, " ")).toBe(
      "Заявка · Потолок + свет · ~81 308 ₽ · Иван · +79055219909"
    );
  });

  it("snapshot tela dlya 2 komnat + svet", () => {
    const body = formatLeadBody(payload, "K7F3Q").replace(/\u00a0/g, " ");
    expect(body).toMatchInlineSnapshot(`
      "Заявка №K7F3Q

      КОНТАКТ
      Имя: Иван
      Телефон: +79055219909

      ИСТОЧНИК И АТРИБУЦИЯ
      Источник: tenevoy-profil:hero
      Место: service-page
      Тип заявки: из калькулятора
      Интент: Потолок + свет
      Страница: /uslugi/tenevoy-profil
      Услуга: tenevoy-profil
      utm_source: yandex

      ПОТОЛОК ПО КОМНАТАМ
      Кухня · 24 м² · Теневой · 35 150 ₽
        – теневой · 17 м.п.
        – встроенный трек · 10 м.п.
        – точки · 6 шт.
      Гостиная · 24 м² · Простой потолок · 24 000 ₽

      МОНТАЖ СВЕТА
      Досчёт монтажа: 2 500 ₽

      СВЕТ
      Артикул · Название · Кол-во · Цена · Сумма
      0У-00001341 · Шинопровод КОЛИБРИ 2000 мм · 5 шт. · 5 082 ₽ · 25 410 ₽

      Добавлено автоматически:
      0У-00001343 · Ввод питания · 1 шт. · 800 ₽ · 800 ₽
      Свет без скидки: 26 210 ₽
      Скидка 25%: −6 552 ₽ → 19 658 ₽

      ИТОГО
      Потолок: 59 150 ₽
      Монтаж света: 2 500 ₽
      Свет: 19 658 ₽
      Общий ориентир: ~81 308 ₽"
    `);
  });

  it("kazhdaya poziciya sveta soderzhit artikul 0У-", () => {
    const body = formatLeadBody(payload, "K7F3Q");
    expect(body).toContain("0У-00001341");
    expect(body).toContain("0У-00001343");
  });
});

describe("T-027 - rate limit 5/10 min", () => {
  it("6-y zapros -> zapret", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      expect(checkRateLimit("1.2.3.4").allowed, `запрос ${i + 1}`).toBe(true);
    }
    const blocked = checkRateLimit("1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("raznye IP nezavisimy", () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) checkRateLimit("1.1.1.1");
    expect(checkRateLimit("2.2.2.2").allowed).toBe(true);
  });

  it("posle okna schetchik sbrasyvaetsya", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) checkRateLimit("3.3.3.3", t0);
    expect(checkRateLimit("3.3.3.3", t0).allowed).toBe(false);
    expect(checkRateLimit("3.3.3.3", t0 + 10 * 60 * 1000 + 1).allowed).toBe(true);
  });
});

describe("T-027 - callbackWindow", () => {
  it("v rabochee vremya - segodnya do 21:00", () => {
    // 12:00 MSK = 09:00 UTC
    expect(resolveCallbackWindow(new Date("2026-09-04T09:00:00Z"))).toBe("сегодня до 21:00");
  });

  it("noch - zavtra s 9:00", () => {
    // 05:00 MSK = 02:00 UTC
    expect(resolveCallbackWindow(new Date("2026-09-04T02:00:00Z"))).toBe("завтра с 9:00");
  });

  it("posle 21:00 - zavtra s 9:00", () => {
    // 22:00 MSK = 19:00 UTC
    expect(resolveCallbackWindow(new Date("2026-09-04T19:00:00Z"))).toBe("завтра с 9:00");
  });
});
