import { describe, expect, it } from "vitest";

import { CATALOG_SECTIONS, visibleCatalogSections } from "@/lib/catalog-ui-config";

describe("T-043 - sekcii katalOga po otvetam Shaga 0", () => {
  it("bez otvetov lyustry i podsvetka karniza skryty", () => {
    const ids = visibleCatalogSections().map((s) => s.id);
    expect(ids).not.toContain("chandeliers");
    expect(ids).not.toContain("cornice-lighting");
    // Базовые секции остаются всегда.
    expect(ids).toContain("track-systems");
    expect(ids).toContain("point-fixtures");
  });

  it("otvet 'da' vklyuchaet sootvetstvuyushchuyu sekciyu", () => {
    expect(visibleCatalogSections({ chandeliersEnabled: true }).map((s) => s.id)).toContain(
      "chandeliers"
    );
    expect(
      visibleCatalogSections({ corniceLightingEnabled: true }).map((s) => s.id)
    ).toContain("cornice-lighting");
  });

  it("oba otveta -> vidny vse sekcii", () => {
    const ids = visibleCatalogSections({
      chandeliersEnabled: true,
      corniceLightingEnabled: true,
    }).map((s) => s.id);
    expect(ids).toEqual(CATALOG_SECTIONS.map((s) => s.id));
  });
});
