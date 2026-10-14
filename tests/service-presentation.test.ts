import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { serviceDisplayOrder, servicePresentation, servicePriceScope } from "@/content/service-presentation";
import { phase2ServiceSlugs, servicePageContent } from "@/content/services";
import manifest from "@/data/brand-image-manifest.json";

describe("R7 service presentation", () => {
  it("covers exactly nine existing URLs, premium first and standard retained", () => {
    expect([...serviceDisplayOrder].sort()).toEqual([...phase2ServiceSlugs].sort());
    expect(serviceDisplayOrder.slice(0,4)).toEqual(["tenevoy-profil","paryashchie-potolki","svetovye-linii","skrytye-karnizy"]);
    expect(serviceDisplayOrder).toContain("prostye-potolki");
    for (const slug of serviceDisplayOrder) expect(servicePageContent[slug].pathname).toBe(`/uslugi/${slug}`);
  });
  it("every hero uses explicitly labelled illustration, not case evidence", () => {
    for (const view of Object.values(servicePresentation)) {
      expect(manifest.images[view.image].kind).toBe("ai-visualization");
      expect(manifest.images[view.image].label).toContain("Визуализация");
      expect(view.title.length).toBeGreaterThan(10);
    }
  });
  it("states pricing scope without putting numeric prices into visual content", () => {
    expect(JSON.stringify(servicePriceScope)).not.toMatch(/\d+\s*₽/);
    expect(servicePriceScope['trekovoe-osveshchenie'].note).toContain("отдельно");
    expect(servicePriceScope['skrytye-karnizy'].label).toContain("Накладной");
    expect(servicePriceScope['tenevoy-profil'].note).toContain("Полотно");
  });
  it("project-only services do not promise instant calculator estimates", () => {
    expect(servicePriceScope['individualnye-proekty'].note).toContain("не используется");
    expect(servicePriceScope['svetoprozrachnye-potolki'].note).toContain("по проекту");
  });
  it("AI illustrations do not enter the proof strip", () => {
    const source = readFileSync(new URL('../app/uslugi/_components/ServiceProofStrip.tsx',import.meta.url),'utf8');
    expect(source).not.toContain("BrandPicture");
    expect(source).toContain("src={item.src}");
  });
});
