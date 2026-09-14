/**
 * PT-014 · Что сохраняется о согласии и как это влияет на идемпотентность.
 *
 * Два свойства, ради которых задача делается:
 *
 *  1. в БД попадает редакция политики и момент согласия, а не `consent: true`;
 *  2. летучая метка времени не ломает PT-009/PT-013: отпечаток payload (а с ним
 *     `requestId` клиента, `payload_hash` сервера и дедуп) не должен зависеть от
 *     того, в какую секунду человек отметил чекбокс.
 */
import { describe, expect, it } from "vitest";

import { PRIVACY_POLICY_VERSION } from "@/content/legal";
import { leadPayloadFingerprint } from "@/lib/lead/canonical";
import {
  CONSENT_AT_MAX_AGE_MS,
  CONSENT_AT_MAX_FUTURE_MS,
  resolveConsentRecord,
} from "@/lib/lead/consent";
import { hashLeadPayload } from "@/lib/lead/payload-hash";

const NOW = Date.parse("2026-09-14T12:00:00.000Z");

describe("PT-014 · версия согласия", () => {
  it("текущая редакция принимается как есть", () => {
    const record = resolveConsentRecord({ consentVersion: PRIVACY_POLICY_VERSION }, NOW);

    expect(record.consentVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(record.versionKnown).toBe(true);
    expect(record.versionCurrent).toBe(true);
  });

  it("старая редакция сохраняется, но помечается несовпадающей", () => {
    const record = resolveConsentRecord({ consentVersion: "2020-01-01" }, NOW);

    // Честнее сохранить то, с чем человек согласился, чем подставить текущую.
    expect(record.consentVersion).toBe("2020-01-01");
    expect(record.versionKnown).toBe(true);
    expect(record.versionCurrent).toBe(false);
  });

  it("мусор вместо версии даёт NULL, а не произвольный текст в БД", () => {
    for (const value of ["v1", "'; DROP TABLE leads;--", "", "   ", "2026-13-45"]) {
      const record = resolveConsentRecord({ consentVersion: value }, NOW);
      expect(record.consentVersion).toBeNull();
      expect(record.versionKnown).toBe(false);
      expect(record.versionCurrent).toBe(false);
    }
  });

  it("без версии — NULL: неизвестность не подменяется текущей редакцией", () => {
    const record = resolveConsentRecord({}, NOW);

    expect(record.consentVersion).toBeNull();
    expect(record.consentVersion).not.toBe(PRIVACY_POLICY_VERSION);
  });

  it("пробелы по краям не мешают", () => {
    const record = resolveConsentRecord({ consentVersion: ` ${PRIVACY_POLICY_VERSION} ` }, NOW);
    expect(record.consentVersion).toBe(PRIVACY_POLICY_VERSION);
    expect(record.versionCurrent).toBe(true);
  });
});

describe("PT-014 · момент согласия", () => {
  it("правдоподобное время клиента сохраняется", () => {
    const at = new Date(NOW - 60_000).toISOString();
    const record = resolveConsentRecord({ consentAt: at }, NOW);

    expect(record.consentAt).toBe(NOW - 60_000);
    expect(record.consentAtSource).toBe("client");
  });

  it("границы окна допустимы", () => {
    const oldest = resolveConsentRecord(
      { consentAt: new Date(NOW - CONSENT_AT_MAX_AGE_MS).toISOString() },
      NOW
    );
    expect(oldest.consentAtSource).toBe("client");

    const newest = resolveConsentRecord(
      { consentAt: new Date(NOW + CONSENT_AT_MAX_FUTURE_MS).toISOString() },
      NOW
    );
    expect(newest.consentAtSource).toBe("client");
  });

  it("часы клиента врут — берётся серверное время", () => {
    const cases: Array<[string, string]> = [
      ["на годы в прошлом", new Date(NOW - CONSENT_AT_MAX_AGE_MS - 1000).toISOString()],
      ["в будущем", new Date(NOW + CONSENT_AT_MAX_FUTURE_MS + 60_000).toISOString()],
      ["мусор", "вчера"],
      ["пустая строка", "   "],
      ["число вместо строки", String(NOW)],
    ];

    for (const [, value] of cases) {
      const record = resolveConsentRecord({ consentAt: value }, NOW);
      expect(record.consentAt).toBe(NOW);
      expect(record.consentAtSource).toBe("server");
    }
  });

  it("без consentAt момент всё равно заполнен — серверным временем", () => {
    const record = resolveConsentRecord({}, NOW);

    expect(record.consentAt).toBe(NOW);
    expect(record.consentAtSource).toBe("server");
  });
});

describe("PT-014 · метка времени согласия не ломает идемпотентность", () => {
  const payload = {
    phone: "+79161234567",
    consent: true,
    consentVersion: PRIVACY_POLICY_VERSION,
    source: "home:hero",
    placement: "page",
    leadKind: "simple",
  };

  it("отпечаток не зависит от consentAt", () => {
    const first = leadPayloadFingerprint({ ...payload, consentAt: "2026-09-14T12:00:00.000Z" });
    const second = leadPayloadFingerprint({ ...payload, consentAt: "2026-09-14T12:05:31.000Z" });
    const without = leadPayloadFingerprint(payload);

    expect(first).toBe(second);
    expect(first).toBe(without);
  });

  it("sha256 сервера — тоже", () => {
    expect(hashLeadPayload({ ...payload, consentAt: "2026-09-14T12:00:00.000Z" })).toBe(
      hashLeadPayload({ ...payload, consentAt: "2026-09-14T13:00:00.000Z" })
    );
  });

  it("версия согласия в отпечаток входит: это часть юридического факта", () => {
    const current = leadPayloadFingerprint(payload);
    const old = leadPayloadFingerprint({ ...payload, consentVersion: "2020-01-01" });

    expect(current).not.toBe(old);
  });

  it("снятая галочка меняет отпечаток (согласия нет)", () => {
    expect(leadPayloadFingerprint({ ...payload, consent: false })).not.toBe(
      leadPayloadFingerprint(payload)
    );
  });
});
