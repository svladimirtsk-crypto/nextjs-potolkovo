/**
 * N-002 · Ценовые якоря услуг.
 *
 * Ловит ровно ту находку F-31, из-за которой клиент видел разные цены на одну
 * услугу: «от 2 000 ₽/м.п.» в hero скрытых карнизов при 1 000 в прайсе и
 * «/ линия» против «/ метр» у световых линий.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatFrom, pricing, servicePriceAnchor } from "@/content/pricing";
import { servicePageContent } from "@/content/services";

const SLUGS = Object.keys(servicePageContent);

describe("N-002 · ценовой якорь услуги", () => {
  it("покрывает все 9 страниц услуг", () => {
    expect(SLUGS).toHaveLength(9);
    for (const slug of SLUGS) {
      const anchor = servicePriceAnchor(slug);
      expect(anchor.label.length, slug).toBeGreaterThan(0);
    }
  });

  it("значение якоря совпадает с прайсом, а не с литералом в текстах", () => {
    expect(servicePriceAnchor("tenevoy-profil").value).toBe(pricing.ceiling.shadowProfilePerM);
    expect(servicePriceAnchor("paryashchie-potolki").value).toBe(
      pricing.ceiling.floatingProfilePerM
    );
    expect(servicePriceAnchor("svetovye-linii").value).toBe(pricing.lightLinesPerM);
    expect(servicePriceAnchor("trekovoe-osveshchenie").value).toBe(pricing.track.builtInPerM);
    expect(servicePriceAnchor("prostye-potolki").value).toBe(pricing.ceiling.standard);
    expect(servicePriceAnchor("svetoprozrachnye-potolki").value).toBe(
      pricing.ceiling.translucentPerSqm
    );
  });

  it("скрытые карнизы: якорь 1 000 ₽/м.п. — прежние «от 2 000» противоречили прайсу", () => {
    const anchor = servicePriceAnchor("skrytye-karnizy");

    expect(anchor.value).toBe(pricing.cornice.surface);
    expect(anchor.value).toBe(1000);
    expect(anchor.label).toBe(formatFrom(1000, "м.п."));
    // Остальные варианты исполнения не теряются — они в подписи.
    // Intl форматирует разряды неразрывным пробелом (U+00A0), поэтому
    // сравниваем по нормализованной строке, а не по обычному пробелу.
    const note = (anchor.note ?? "").replace(/\u00a0/g, " ");
    expect(note).toContain("1 800");
    expect(note).toContain("4 500");
  });

  it("световые линии: единица одна и та же (раньше «линия» vs «метр»)", () => {
    const anchor = servicePriceAnchor("svetovye-linii");
    expect(anchor.unit).toBe("м.п.");
    expect(anchor.label).not.toContain("линия");
  });

  it("услуги без фиксированной ставки не выдумывают цену", () => {
    for (const slug of ["individualnye-proekty", "prodazha-trekovogo-osveshcheniya"]) {
      const anchor = servicePriceAnchor(slug);
      expect(anchor.value, slug).toBeNull();
      expect(anchor.label, slug).not.toMatch(/\d/);
    }
  });

  it("неизвестный slug не роняет рендер", () => {
    expect(servicePriceAnchor("нет-такой-услуги").value).toBeNull();
  });
});

describe("N-002 · тексты и H1", () => {
  const servicesSource = readFileSync(join(process.cwd(), "content/services.ts"), "utf8");

  it("H1 больше не содержит регион — он остаётся в title и description", () => {
    const h1Lines = servicesSource
      .split("\n")
      .filter((line) => /^\s*h1:\s*"/.test(line));

    expect(h1Lines.length).toBeGreaterThanOrEqual(9);
    for (const line of h1Lines) {
      expect(line, line.trim()).not.toMatch(/Москв|МО"/);
    }
  });

  it("регион сохранён в seo-title (SEO не потеряли)", () => {
    const titlesWithRegion = servicesSource
      .split("\n")
      .filter((line) => /^\s*title:\s*"/.test(line) && /Москв/.test(line));

    expect(titlesWithRegion.length).toBeGreaterThanOrEqual(6);
  });
});

describe("N-002 · проценты скидок только из прайса", () => {
  const files = [
    "components/calculator-modal/price-strip.tsx",
    "components/home/price-calculator-context.tsx",
    "components/lighting/LightingCartDrawer.tsx",
    // N-050: строки сводки уехали из price-calculator-context.tsx сюда,
    // запрет на литералы процентов должен был переехать вместе с ними.
    "lib/calculator/summary-lines.ts",
  ];

  it("в UI нет литералов 25/10 рядом со скидкой", () => {
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/percent=\{(25|10)\}/);
      expect(source, file).not.toMatch(/−10%/);
      expect(source, file).not.toMatch(/\?\s*25\s*:/);
    }
  });

  it("проценты в прайсе — 25 и 10", () => {
    expect(pricing.lightingDiscount.withCeilingPct).toBe(25);
    expect(pricing.lightingDiscount.lightingOnlyPct).toBe(10);
  });
});
