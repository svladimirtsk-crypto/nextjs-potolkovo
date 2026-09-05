import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG_SECTIONS } from "../lib/catalog-ui-config";

const source = readFileSync(
  new URL("../app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx", import.meta.url),
  "utf8"
);

describe("T-065 · глобальный поиск по каталогу", () => {
  it("запрос не сбрасывается при смене раздела", () => {
    // Обработчик вкладки: от его onClick до закрывающей скобки.
    const start = source.indexOf('onClick={() => {\n                  // T-065');
    expect(start).toBeGreaterThan(-1);
    const tabHandler = source.slice(start, source.indexOf("}}", start));

    expect(tabHandler).toContain("setSection(item.id)");
    expect(tabHandler).not.toContain('setQuery("")');
  });

  it("совпадения считаются по всему каталогу, а не по активной секции", () => {
    expect(source).toContain("searchMatchesBySection");
    expect(source).toContain("for (const product of products)");
  });

  it("подсказка показывает раздел и число найденного", () => {
    expect(source).toMatch(/«\{match\.label\}»: \{match\.count\}/);
  });

  it("у горизонтальных лент есть fade-край", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    expect(css).toContain(".scroll-fade-x");
    expect(source).toContain("scroll-fade-x");
  });

  it("каждая секция каталога может быть целью подсказки", () => {
    for (const section of CATALOG_SECTIONS) {
      expect(source, section.id).toContain(`"${section.id}"`);
    }
  });
});
