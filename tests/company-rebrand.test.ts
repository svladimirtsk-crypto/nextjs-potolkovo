import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { company } from "@/content/company";
import { homepage } from "@/content/homepage";
import { serviceLinks } from "@/content/service-links";
import { servicePageContent } from "@/content/services";
import manifest from "@/data/brand-image-manifest.json";
import { resolveStep2Copy } from "@/lib/calculator-flow";

const root = path.resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("R7 · компания, высокомаржинальные решения и преемственность", () => {
  it("выделяет теневые, парящие, линии и карнизы — не только базовое полотно", () => {
    expect(company.solutions.map(s => s.slug)).toEqual(["tenevoy-profil", "paryashchie-potolki", "svetovye-linii", "skrytye-karnizy"]);
    for (const item of company.solutions) expect(serviceLinks.some(link => link.slug === item.slug)).toBe(true);
  });
  it("сохраняет все девять существующих услуг и их URL", () => {
    expect(serviceLinks).toHaveLength(9);
    for (const link of serviceLinks) expect(Object.values(servicePageContent).some(s => s.pathname === link.href)).toBe(true);
  });
  it("не подменяет калькулятор декоративным прототипом", () => {
    expect(source("components/home/hero-cta.tsx")).toContain('openCalculator(page.optionsFor("hero"))');
    expect(source("components/home/home-header.tsx")).toContain('openCalculator(page.optionsFor("header"))');
    expect(source("components/home/home-header.tsx")).toContain('page.presetDisabled');
    expect(source("components/home/home-page.tsx")).toContain('<HomePrice />');
  });
  it("основатель не занимает hero и не обещает выполнять всё лично", () => {
    expect(source("components/home/home-hero.tsx")).not.toMatch(/portrait|FounderBlock/);
    expect(company.about.founderRole).toBe("Основатель ПОТОЛКОВО");
    expect(company.about.description).toContain("партнёрские");
    expect(homepage.hero.h1).toBe(company.tagline);
    expect(homepage.hero.subtitle).not.toMatch(/за 2 минуты|1 000|делаю сам|лично/);
  });
  it("форма говорит от имени компании, без неподтверждённых сроков и гарантии", () => {
    const copy = resolveStep2Copy("ceiling_only");
    expect(copy.formSubtitle).toContain("перезвоним");
    expect(copy.chips.join(" ")).not.toMatch(/2 года|1 день|лично/);
  });
  it("не записывает preview-посетителей в боевую Метрику", () => {
    expect(source("components/analytics/yandex-metrika.tsx")).toContain('NEXT_PUBLIC_PREVIEW_MODE === "1"');
    expect(source("app/layout.tsx")).toContain('NEXT_PUBLIC_PREVIEW_MODE !== "1"');
  });
});

describe("R7 · качество, происхождение и замена визуализаций", () => {
  for (const [id, image] of Object.entries(manifest.images)) {
    it(`${id}: настоящее разрешение без апскейла, AVIF/WebP и видимая маркировка`, () => {
      expect(image.width).toBeGreaterThanOrEqual(1200);
      expect(image.height).toBeGreaterThanOrEqual(800);
      expect(image.kind).toBe("ai-visualization");
      expect(image.label).toContain("Визуализация");
      for (const format of ["avif", "webp"] as const) {
        expect(image.sources[format].length).toBeGreaterThanOrEqual(3);
        for (const variant of image.sources[format]) {
          expect(variant.width).toBeLessThanOrEqual(image.width);
          expect(existsSync(path.join(root, "public", variant.src))).toBe(true);
        }
      }
    });
  }
  it("новые изображения не подменяют существующие фотографии кейсов", () => {
    for (const item of homepage.proof.items) expect(item.imageAssetKey).not.toMatch(/architectural-living|floating-bedroom|light-lines-kitchen/);
    expect(source("components/brand/brand-picture.tsx")).toContain('<figcaption>{image.label}</figcaption>');
    expect(source("components/brand/brand-picture.tsx")).toContain('fetchPriority={priority ? "high" : "auto"}');
  });
});
