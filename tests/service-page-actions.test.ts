import { describe, expect, it } from "vitest";

import {
  parseAreaLabel,
  serviceCtaLabel,
  proofItemPreset,
  relatedServiceReason,
} from "../lib/service-page-actions";
import {
  getRelatedServiceLinks,
  phase2ServiceSlugs,
  servicePageContent,
} from "../content/services";
import type { ServiceCalculatorPreset } from "../content/services";

/**
 * N-032 · «Хочу так же» и аргументированный кросс-селл (F-36, F-37).
 */
describe("parseAreaLabel", () => {
  it("вытаскивает число из подписи примера", () => {
    expect(parseAreaLabel("18 м²")).toBe(18);
    expect(parseAreaLabel("31 м²")).toBe(31);
  });

  it("понимает дробную площадь с запятой", () => {
    expect(parseAreaLabel("12,5 м²")).toBe(12.5);
  });

  it("на нечисловой подписи не выдумывает площадь", () => {
    expect(parseAreaLabel("по проекту")).toBeNull();
    expect(parseAreaLabel("")).toBeNull();
  });

  it("примеры с числовой площадью разбираются на всех страницах", () => {
    /**
     * Если подпись перестанет парситься, кнопка «Хочу так же» молча начнёт
     * открывать расчёт с площадью страницы вместо площади примера.
     * «Индивидуальные проекты» — законное исключение: там «по проекту»,
     * и подставлять туда выдуманное число было бы хуже, чем не подставлять.
     */
    for (const slug of phase2ServiceSlugs) {
      for (const item of servicePageContent[slug].proof.items) {
        const parsed = parseAreaLabel(item.areaLabel);
        if (/\d/.test(item.areaLabel)) {
          expect(parsed, `${slug}: ${item.areaLabel}`).not.toBeNull();
        } else {
          expect(parsed, `${slug}: ${item.areaLabel}`).toBeNull();
        }
      }
    }
  });
});

describe("proofItemPreset", () => {
  const base: ServiceCalculatorPreset = {
    ceilingType: "shadow",
    areaDefault: 20,
    shadowLengthDefault: 18,
  };

  it("подменяет площадь на площадь примера, сохраняя узлы страницы", () => {
    const preset = proofItemPreset(base, "31 м²");
    expect(preset.areaDefault).toBe(31);
    expect(preset.ceilingType).toBe("shadow");
    expect(preset.shadowLengthDefault).toBe(18);
  });

  it("без разбираемой площади остаётся пресет страницы", () => {
    expect(proofItemPreset(base, "по проекту")).toEqual(base);
  });

  it("не мутирует исходный пресет", () => {
    proofItemPreset(base, "31 м²");
    expect(base.areaDefault).toBe(20);
  });
});

describe("relatedServiceReason", () => {
  it("объясняет выгоду связки, а не повторяет название", () => {
    const reason = relatedServiceReason("tenevoy-profil", "trekovoe-osveshchenie");
    expect(reason).toContain("закладная");
  });

  it("довод зависит от направления пары", () => {
    const forward = relatedServiceReason("tenevoy-profil", "trekovoe-osveshchenie");
    const backward = relatedServiceReason("trekovoe-osveshchenie", "tenevoy-profil");
    expect(forward).not.toBe(backward);
  });

  it("для неизвестной пары молчит, а не подставляет общую фразу", () => {
    expect(relatedServiceReason("tenevoy-profil", "individualnye-proekty")).toBeNull();
  });

  it("каждая связка на каждой странице аргументирована", () => {
    // Смысл: кросс-селл без довода — просто список ссылок, поэтому объяснена
    // должна быть каждая связка на каждой странице, а не половина.
    for (const slug of phase2ServiceSlugs) {
      for (const link of getRelatedServiceLinks(slug)) {
        expect(
          relatedServiceReason(slug, link.slug),
          `${slug} -> ${link.slug}`
        ).not.toBeNull();
      }
    }
  });

  it("услуга не рекламирует саму себя", () => {
    for (const slug of phase2ServiceSlugs) {
      expect(relatedServiceReason(slug, slug)).toBeNull();
    }
  });
});

describe("N-060 · подпись кнопки расчёта (F-34)", () => {
  it("кнопка называет услугу, а не «этот узел»", () => {
    expect(serviceCtaLabel("tenevoy-profil")).toBe("Рассчитать теневой потолок");
    expect(serviceCtaLabel("svetovye-linii")).toBe("Рассчитать световые линии");
    expect(serviceCtaLabel("skrytye-karnizy")).toBe("Рассчитать скрытый карниз");
  });

  it("у каждой страницы услуги есть своя подпись", () => {
    // Пропущенный слаг молча даст всем одинаковую кнопку — проверяем поимённо.
    for (const slug of phase2ServiceSlugs) {
      expect(serviceCtaLabel(slug), slug).not.toBe("Рассчитать стоимость");
    }
  });

  it("подписи не повторяются: кнопка отличает услуги друг от друга", () => {
    const labels = phase2ServiceSlugs.map((slug) => serviceCtaLabel(slug));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("незнакомый слаг даёт нейтральную подпись, а не пустое место", () => {
    expect(serviceCtaLabel("нет-такой-услуги")).toBe("Рассчитать стоимость");
  });

  it("в подписях нет жаргона", () => {
    for (const slug of phase2ServiceSlugs) {
      expect(serviceCtaLabel(slug)).not.toMatch(/узел|узл|точк/i);
    }
  });
});
