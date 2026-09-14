/**
 * PT-012 · Нормализация атрибуции и allowlist.
 *
 * Регресс, который здесь закрывается: схема требовала `max(200)` для каждого
 * значения атрибуции, и длинная рекламная ссылка в `first_landing` роняла весь
 * `POST /api/lead` в `422`. Заявка терялась из-за поля, без которого она
 * полноценна, — и терялась ровно у тех, кто пришёл из рекламы.
 */
import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_URL_MAX,
  ATTRIBUTION_VALUE_MAX,
  isAttributionKeyAllowed,
  normalizeAttribution,
  normalizeAttributionEntry,
  normalizeAttributionUrl,
} from "../lib/attribution";
import { LeadPayloadSchema } from "../lib/lead/schema";

/** Рекламная ссылка первого визита: UTM + персональные параметры + фрагмент. */
const AD_LANDING =
  "/uslugi/tenevye-potolki?utm_source=yandex&utm_medium=cpc&utm_campaign=msk-2026" +
  "&yclid=1234567890&email=ivan@example.com&phone=%2B79001234567&order_id=99" +
  "#price";

describe("PT-012 · normalizeAttributionUrl", () => {
  it("оставляет только параметры из allowlist", () => {
    const result = normalizeAttributionUrl(AD_LANDING);

    expect(result).toContain("utm_source=yandex");
    expect(result).toContain("utm_campaign=msk-2026");
    expect(result).toContain("yclid=1234567890");
    expect(result).not.toContain("email");
    expect(result).not.toContain("phone");
    expect(result).not.toContain("order_id");
  });

  it("снимает фрагмент целиком", () => {
    expect(normalizeAttributionUrl("/uslugi#price")).toBe("/uslugi");
    expect(normalizeAttributionUrl("https://example.com/?utm_source=vk#access-token")).toBe(
      "https://example.com/?utm_source=vk"
    );
  });

  it("относительный путь остаётся относительным — чужой origin не приписываем", () => {
    const result = normalizeAttributionUrl("/uslugi/prostye-potolki?utm_source=vk");

    expect(result).toBe("/uslugi/prostye-potolki?utm_source=vk");
    expect(result.startsWith("/")).toBe(true);
  });

  it("абсолютный URL сохраняет origin и путь", () => {
    expect(normalizeAttributionUrl("https://yandex.ru/clck?utm_source=yandex")).toBe(
      "https://yandex.ru/clck?utm_source=yandex"
    );
  });

  it("режет URL по лимиту 2048, а не по 200 на значение", () => {
    const long = `/?utm_term=${"я".repeat(4000)}`;
    const result = normalizeAttributionUrl(long);

    expect(result.length).toBeLessThanOrEqual(ATTRIBUTION_URL_MAX);
    expect(result.length).toBeGreaterThan(ATTRIBUTION_VALUE_MAX);
  });

  it("неразбираемая строка не роняет нормализацию", () => {
    expect(normalizeAttributionUrl("не url и не путь")).toBe("не url и не путь");
    expect(normalizeAttributionUrl("   ")).toBe("");
  });

  it("несколько значений одного параметра сохраняются", () => {
    const result = normalizeAttributionUrl("/?utm_content=a&utm_content=b");

    expect(result).toContain("utm_content=a");
    expect(result).toContain("utm_content=b");
  });
});

describe("PT-012 · normalizeAttributionEntry", () => {
  it("ключ вне allowlist не проходит (телефон и пароль из хранилища — не атрибуция)", () => {
    expect(normalizeAttributionEntry("phone", "+79001234567")).toBeNull();
    expect(normalizeAttributionEntry("password", "secret")).toBeNull();
    expect(isAttributionKeyAllowed("utm_source")).toBe(true);
    expect(isAttributionKeyAllowed("first_landing")).toBe(true);
  });

  it("обычное значение режется по 200 и тримится", () => {
    const long = "x".repeat(500);

    expect(normalizeAttributionEntry("utm_campaign", `  ${long}  `)).toBe("x".repeat(200));
  });

  it("не-строка и пустая строка не попадают в лид", () => {
    expect(normalizeAttributionEntry("utm_source", 42)).toBeNull();
    expect(normalizeAttributionEntry("utm_source", null)).toBeNull();
    expect(normalizeAttributionEntry("utm_source", "   ")).toBeNull();
  });

  it("URL-ключи нормализуются как URL, а не как строка", () => {
    const result = normalizeAttributionEntry("first_landing", AD_LANDING);

    expect(result).toContain("utm_source=yandex");
    expect(result).not.toContain("email");
  });
});

describe("PT-012 · normalizeAttribution", () => {
  it("битый вход превращается в пустой словарь, а не в отказ", () => {
    expect(normalizeAttribution(undefined)).toEqual({});
    expect(normalizeAttribution(null)).toEqual({});
    expect(normalizeAttribution("строка")).toEqual({});
    expect(normalizeAttribution(["utm_source"])).toEqual({});
    expect(normalizeAttribution(42)).toEqual({});
  });

  it("смешанный словарь: allowlist нормализуется, остальное отброшено", () => {
    expect(
      normalizeAttribution({
        utm_source: "yandex",
        first_landing: AD_LANDING,
        phone: "+79001234567",
        empty: "",
        broken: { nested: true },
      })
    ).toEqual({
      utm_source: "yandex",
      first_landing:
        "/uslugi/tenevye-potolki?utm_source=yandex&utm_medium=cpc&utm_campaign=msk-2026&yclid=1234567890",
    });
  });
});

/** Валидный минимум по `LeadPayloadSchema` — всё, кроме атрибуции. */
const BASE_PAYLOAD = {
  leadKind: "calculator",
  orderIntent: "ceiling_only",
  name: "Иван",
  phone: "+7 900 000-00-00",
  consent: true,
  source: "home:hero",
  placement: "modal",
} as const;

describe("PT-012 · LeadPayloadSchema больше не отклоняет длинную атрибуцию", () => {
  it("рекламная ссылка на 600+ символов проходит валидацию (регресс 422)", () => {
    const parsed = LeadPayloadSchema.safeParse({
      ...BASE_PAYLOAD,
      attribution: { first_landing: AD_LANDING.repeat(3), utm_source: "yandex" },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const landing = parsed.data.attribution.first_landing ?? "";
    expect(landing.length).toBeLessThanOrEqual(ATTRIBUTION_URL_MAX);
    expect(landing).not.toContain("email");
    expect(landing).not.toContain("#");
    expect(parsed.data.attribution.utm_source).toBe("yandex");
  });

  it("атрибуция отсутствует — пустой словарь, как и раньше", () => {
    const parsed = LeadPayloadSchema.safeParse(BASE_PAYLOAD);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.attribution).toEqual({});
  });

  it("атрибуция мусором — пустой словарь, а не 422", () => {
    const parsed = LeadPayloadSchema.safeParse({ ...BASE_PAYLOAD, attribution: "utm_source=vk" });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.attribution).toEqual({});
  });

  it("непринципиальное поле не может завалить заявку: телефон по-прежнему строгий", () => {
    const parsed = LeadPayloadSchema.safeParse({
      ...BASE_PAYLOAD,
      phone: "не телефон",
      attribution: { first_landing: AD_LANDING },
    });

    expect(parsed.success).toBe(false);
  });
});
