/**
 * PT-013 · Разбор отказа: транспортный результат → то, что видит человек.
 *
 * До правки все шесть видов отказа показывались одним текстом «Не получилось
 * отправить — позвоните …»: `422` с названным сервером полем, `429` с
 * `Retry-After: 600` и обрыв связи выглядели одинаково (замерено на сборке до
 * правки). Тесты ниже закрепляют различение и запрещают возврат к общему тексту.
 */
import { describe, expect, it } from "vitest";

import {
  describeClientValidation,
  describeLeadFailure,
  fieldErrorsFromIssues,
  fieldOfIssuePath,
  formatRetryCountdown,
  invalidFieldsOf,
  isRetriableKind,
} from "@/lib/lead/failure-view";
import type { LeadSubmitFailure } from "@/lib/lead/submit-lead";

function failure(partial: Partial<LeadSubmitFailure>): LeadSubmitFailure {
  return {
    ok: false,
    kind: "server",
    status: null,
    issues: [],
    retryAfterSec: null,
    serverMessage: null,
    ...partial,
  };
}

describe("PT-013 · zod-путь → поле формы", () => {
  it("путь верхнего уровня становится полем", () => {
    expect(fieldOfIssuePath("phone")).toBe("phone");
    expect(fieldOfIssuePath("name")).toBe("name");
    expect(fieldOfIssuePath("address")).toBe("address");
    expect(fieldOfIssuePath("preferredTime")).toBe("preferredTime");
    expect(fieldOfIssuePath("consent")).toBe("consent");
  });

  it("вложенные пути не подсвечивают несуществующие поля", () => {
    // Серверный пересчёт (PT-010) и атрибуция (PT-012) — не поля формы.
    expect(fieldOfIssuePath("snapshot.totals.grand")).toBeNull();
    expect(fieldOfIssuePath("attribution.first_landing")).toBeNull();
    expect(fieldOfIssuePath("totals.grand")).toBeNull();
    expect(fieldOfIssuePath("items[2].sku")).toBeNull();
    expect(fieldOfIssuePath("")).toBeNull();
    expect(fieldOfIssuePath("grandTotal")).toBeNull();
  });

  it("список полей собирается из issues и схлопывает дубликаты", () => {
    const errors = fieldErrorsFromIssues(["phone", "name", "phone", "snapshot.rooms"]);
    expect(Object.keys(errors).sort()).toEqual(["name", "phone"]);
    expect(errors.phone).toMatch(/номер/i);
  });

  it("порядок полей — как в форме, а не как в ответе сервера", () => {
    // Сервер назвал телефон первым, но фокус должен попасть в имя: оно выше.
    const errors = fieldErrorsFromIssues(["phone", "name", "address"]);
    expect(invalidFieldsOf(errors)).toEqual(["name", "phone", "address"]);
  });

  it("пустой список issues не даёт полей", () => {
    expect(fieldErrorsFromIssues([])).toEqual({});
  });
});

describe("PT-013 · 422 — подсветка конкретного поля", () => {
  it("названное сервером поле получает текст и общий призыв исправить", () => {
    const view = describeLeadFailure(
      failure({ kind: "validation", status: 422, issues: ["phone", "name"] })
    );

    expect(view.invalidFields).toEqual(["name", "phone"]);
    expect(view.fieldErrors.phone).toMatch(/10 цифр/);
    expect(view.message).toMatch(/Исправьте отмеченные поля/);
    expect(view.canRetry).toBe(false);
    expect(view.retryAfterSec).toBeNull();
  });

  it("отказ серверного пересчёта показывает готовый текст сервера", () => {
    const view = describeLeadFailure(
      failure({
        kind: "validation",
        status: 422,
        serverMessage: "«Профиль PC-26» недоступен к заказу — позиция принята по каталогу.",
      })
    );

    expect(view.message).toContain("недоступен к заказу");
    expect(view.invalidFields).toEqual([]);
  });

  it("422 без полей формы и без текста сервера не советует чинить несуществующее", () => {
    const view = describeLeadFailure(
      failure({ kind: "validation", status: 422, issues: ["snapshot.totals.grand"] })
    );

    expect(view.invalidFields).toEqual([]);
    expect(view.message).toMatch(/номер телефона/);
  });
});

describe("PT-013 · 429 — срок из Retry-After", () => {
  it("текст содержит минуты, а момент окончания зафиксирован", () => {
    const now = Date.parse("2026-09-14T10:00:00Z");
    const view = describeLeadFailure(
      failure({ kind: "ratelimit", status: 429, retryAfterSec: 600 }),
      now
    );

    expect(view.message).toContain("10 мин");
    expect(view.retryAfterUntil).toBe(now + 600_000);
    expect(view.canRetry).toBe(false);
    expect(view.outcomeUnknown).toBe(false);
  });

  it("503 «хранилище недоступно» тоже показывает срок (сервер отдаёт Retry-After: 300)", () => {
    const now = Date.parse("2026-09-14T10:00:00Z");
    const view = describeLeadFailure(
      failure({ kind: "unavailable", status: 503, retryAfterSec: 300 }),
      now
    );

    expect(view.retryAfterUntil).toBe(now + 300_000);
    expect(view.message).toMatch(/недоступен/i);
    expect(view.message).toMatch(/\+7/);
  });

  it("без Retry-After отсчёта нет", () => {
    const view = describeLeadFailure(failure({ kind: "ratelimit", status: 429 }));
    expect(view.retryAfterUntil).toBeNull();
  });
});

describe("PT-013 · обрыв связи и таймаут — исход неизвестен", () => {
  for (const kind of ["network", "timeout"] as const) {
    it(`${kind}: повтор возможен, исход помечен неизвестным`, () => {
      const view = describeLeadFailure(failure({ kind, status: null }));

      expect(view.outcomeUnknown).toBe(true);
      expect(view.canRetry).toBe(true);
      // Врать «не отправлено» нельзя: запрос мог дойти до сервера.
      expect(view.message).toMatch(/могла не уйти/);
      expect(view.message).not.toMatch(/не отправлено/i);
    });
  }

  it("500 — повтор возможен, но исход не неизвестен (сервер ответил)", () => {
    const view = describeLeadFailure(failure({ kind: "server", status: 500 }));

    expect(view.canRetry).toBe(true);
    expect(view.outcomeUnknown).toBe(false);
  });

  it("409 показывает серверный текст: повтор с тем же ключом бесполезен", () => {
    const view = describeLeadFailure(
      failure({
        kind: "server",
        status: 409,
        serverMessage: "Заявка уже отправлена. Обновите страницу и попробуйте ещё раз.",
      })
    );

    expect(view.message).toContain("Обновите страницу");
    expect(view.canRetry).toBe(true);
  });

  it("ни один текст не раскрывает каналы доставки и технические детали", () => {
    const kinds = ["validation", "ratelimit", "unavailable", "server", "network", "timeout"] as const;

    for (const kind of kinds) {
      const view = describeLeadFailure(
        failure({ kind, status: 500, issues: ["phone"], retryAfterSec: 60 })
      );
      expect(view.message).not.toMatch(/telegram|web3forms|postgres|drizzle|zod|outbox/i);
      expect(view.message).not.toMatch(/snapshot|attribution|payload/i);
    }
  });
});

describe("PT-013 · isRetriableKind", () => {
  it("повтор имеют смысл только при сетевых и серверных отказах", () => {
    expect(isRetriableKind("network")).toBe(true);
    expect(isRetriableKind("timeout")).toBe(true);
    expect(isRetriableKind("server")).toBe(true);
    expect(isRetriableKind("validation")).toBe(false);
    expect(isRetriableKind("ratelimit")).toBe(false);
    expect(isRetriableKind("unavailable")).toBe(false);
  });
});

describe("PT-013 · отказ клиентской проверки", () => {
  it("тот же вид, но без повтора и без отсчёта", () => {
    const view = describeClientValidation(
      { phone: "Проверьте номер: нужно 10 цифр после +7." },
      "Проверьте имя и телефон — без них не смогу перезвонить."
    );

    expect(view.kind).toBe("validation");
    expect(view.message).toContain("Проверьте имя и телефон");
    expect(view.invalidFields).toEqual(["phone"]);
    expect(view.canRetry).toBe(false);
    expect(view.retryAfterUntil).toBeNull();
    expect(view.outcomeUnknown).toBe(false);
  });
});

describe("PT-013 · формат обратного отсчёта", () => {
  it("мм:сс, ноль не уходит в минус", () => {
    expect(formatRetryCountdown(600)).toBe("10:00");
    expect(formatRetryCountdown(59)).toBe("0:59");
    expect(formatRetryCountdown(5)).toBe("0:05");
    expect(formatRetryCountdown(0)).toBe("0:00");
    expect(formatRetryCountdown(-30)).toBe("0:00");
  });
});
