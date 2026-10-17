/**
 * PT-021 · Граница доверия для IP клиента.
 *
 * Проверяем не «функция вернула строку», а именно то, из-за чего задача
 * появилась: подделанный начало цепочки `x-forwarded-for` не должен влиять на
 * ключ лимита, а отсутствие доверенных прокси — не должно давать «красивый»
 * подделываемый адрес.
 */
import { describe, expect, it } from "vitest";

import { normalizeIp, resolveClientIp } from "@/lib/lead/client-ip";

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("PT-021 · normalizeIp", () => {
  it("принимает IPv4 и IPv6, приводит к нижнему регистру", () => {
    expect(normalizeIp("203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeIp(" 2001:DB8::1 ")).toBe("2001:db8::1");
  });

  it("снимает порт у IPv4 и скобки/порт у IPv6", () => {
    expect(normalizeIp("203.0.113.10:44321")).toBe("203.0.113.10");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("[2001:db8::1]")).toBe("2001:db8::1");
  });

  it("не выдаёт адрес за невалидный ввод", () => {
    expect(normalizeIp("unknown")).toBeNull();
    expect(normalizeIp("unix:/run/app.sock")).toBeNull();
    expect(normalizeIp("999.1.1.1")).toBeNull();
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(null)).toBeNull();
  });
});

describe("PT-021 · resolveClientIp", () => {
  it("при одном доверенном прокси подделанное начало цепочки игнорируется", () => {
    // Клиент прислал «6.6.6.6», прокси дописал реальный адрес справа.
    const result = resolveClientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), 1);
    expect(result.ip).toBe("203.0.113.9");
    expect(result.source).toBe("x-forwarded-for");
    expect(result.reason).toBe("trusted");
  });

  it("при двух прокси берётся адрес перед ними, а не первый и не последний", () => {
    const result = resolveClientIp(
      headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 10.0.0.1, 10.0.0.2" }),
      2
    );
    expect(result.ip).toBe("10.0.0.1");
  });

  it("цепочка короче числа доверенных прокси — адрес не принимается", () => {
    const result = resolveClientIp(headers({ "x-forwarded-for": "203.0.113.9" }), 2);
    expect(result.ip).toBe("unknown");
    expect(result.reason).toBe("chain-too-short");
  });

  it("без доверенных прокси заголовки полностью игнорируются", () => {
    const xff = resolveClientIp(headers({ "x-forwarded-for": "203.0.113.9" }), 0);
    expect(xff).toMatchObject({ ip: "unknown", source: "unknown", reason: "no-trusted-proxy" });

    const real = resolveClientIp(headers({ "x-real-ip": "203.0.113.9" }), 0);
    expect(real).toMatchObject({ ip: "unknown", reason: "no-trusted-proxy" });
  });

  it("без x-forwarded-for используется x-real-ip доверенного прокси", () => {
    const result = resolveClientIp(headers({ "x-real-ip": "198.51.100.4" }), 1);
    expect(result).toMatchObject({ ip: "198.51.100.4", source: "x-real-ip", reason: "trusted" });
  });

  it("мусор на доверенной позиции цепочки не превращается в адрес", () => {
    // При двух прокси адрес клиента стоит вторым с конца — именно он битый.
    const result = resolveClientIp(
      headers({ "x-forwarded-for": "203.0.113.9, unknown, 10.0.0.1" }),
      2
    );
    expect(result).toMatchObject({ ip: "unknown", reason: "invalid-address" });
  });

  it("мусор в подделанном начале цепочки на адрес не влияет", () => {
    const result = resolveClientIp(headers({ "x-forwarded-for": "unknown, 203.0.113.9" }), 1);
    expect(result).toMatchObject({ ip: "203.0.113.9", reason: "trusted" });
  });

  it("отсутствие заголовков — unknown, а не выдуманный адрес", () => {
    const result = resolveClientIp(headers({}), 1);
    expect(result).toMatchObject({ ip: "unknown", reason: "header-missing" });
  });
});
