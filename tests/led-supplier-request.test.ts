/**
 * T8-012 · Запрос поставщику не должен «усохнуть» молча.
 *
 * Документ генерируется из фактических данных (`scripts/generate-led-supplier-request.mjs`).
 * Если из него пропадёт блокирующий вопрос по единице цены или серии лент,
 * это заметят не сразу — поэтому здесь проверяется содержимое.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const doc = readFileSync(
  join(process.cwd(), "docs/evidence/catalog-led/supplier-request.md"),
  "utf8"
);

describe("T8-012 · документ запроса поставщику", () => {
  it("содержит блокирующий вопрос о единице цены", () => {
    expect(doc).toContain("Вопрос 1 (блокирующий)");
    expect(doc).toContain("за метр или за катушку");
  });

  it("перечисляет все серии лент, включая позиции без серии", () => {
    for (const series of ["СТАНДАРТ 140", "ПРО 160", "RGB 24V", "RGBW 24V", "CCT 24V"]) {
      expect(doc).toContain(series);
    }
  });

  it("держит минимальный пакет из §12 ТЗ", () => {
    expect(doc).toContain("Минимальный пакет (ТЗ §12)");
    expect(doc).toContain("derating");
    expect(doc).toContain("RF-семейства");
    expect(doc).toContain("Алисой");
  });

  it("не выдаёт отсутствующие данные за найденные", () => {
    expect(doc).toContain("не заполняются догадками");
    expect(doc).toContain("title_only");
    expect(doc).toContain("label_observed");
  });
});
