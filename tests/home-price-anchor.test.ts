/**
 * N-031 · Округление ориентиров (F-25) и ценовые примеры (F-29).
 */
import { describe, expect, it } from "vitest";

import {
  formatAnchorRub,
  formatFromAnchorRub,
  roundAnchor,
  roundFromAnchor,
} from "@/lib/home-price-anchor";
import { calcExampleTotal, homePriceExamples } from "@/lib/home-price-examples";
import { pricing } from "@/content/pricing";

/** Intl разделяет разряды узким неразрывным пробелом — собираем ожидание им же. */
const ru = (value: number) => value.toLocaleString("ru-RU");

describe("roundAnchor · шаг зависит от порядка суммы", () => {
  it("выше 50 000 ₽ округляет до 1 000 ₽", () => {
    // Обе суммы из аудита F-25 — ровно те, что показывали карточки работ.
    expect(roundAnchor(107_426)).toBe(107_000);
    expect(roundAnchor(275_895)).toBe(276_000);
  });

  it("до 50 000 ₽ включительно округляет до 500 ₽", () => {
    expect(roundAnchor(43_240)).toBe(43_000);
    expect(roundAnchor(18_300)).toBe(18_500);
    expect(roundAnchor(50_000)).toBe(50_000);
  });

  it("не превращает отсутствие цены в ноль-с-хвостом", () => {
    expect(roundAnchor(0)).toBe(0);
    expect(roundAnchor(Number.NaN)).toBe(0);
    expect(roundAnchor(-5_000)).toBe(0);
  });

  it("формат — с неразрывным пробелом перед ₽", () => {
    expect(formatAnchorRub(107_426)).toBe(`≈ ${ru(107_000)}\u00a0₽`);
  });
});

describe("roundFromAnchor · нижняя граница", () => {
  it("округляет вниз до 100 ₽, чтобы «от» не оказалось выше реальной цены", () => {
    expect(roundFromAnchor(2_418)).toBe(2_400);
    expect(roundFromAnchor(2_499)).toBe(2_400);
    expect(roundFromAnchor(2_400)).toBe(2_400);
  });

  it("формат «от X ₽»", () => {
    expect(formatFromAnchorRub(2_418)).toBe(`от ${ru(2_400)}\u00a0₽`);
  });
});

describe("Ценовые примеры главной", () => {
  it("их ровно три", () => {
    expect(homePriceExamples).toHaveLength(3);
  });

  it("суммы совпадают с пересчётом через движок калькулятора", () => {
    // Смысл проверки: карточка не имеет собственного прайса. Если цифра
    // разойдётся с калькулятором, клиент увидит на главной одно, в модалке
    // другое — а это самый дорогой вид расхождения.
    for (const example of homePriceExamples) {
      const total = calcExampleTotal(example.id);
      expect(example.priceLabel).toBe(
        `≈ ${ru(roundAnchor(total))}\u00a0₽`
      );
    }
  });

  it("спальня 12 м² упирается в минимальный заказ и говорит об этом", () => {
    const bedroom = homePriceExamples.find((item) => item.id === "bedroom-simple");
    expect(calcExampleTotal("bedroom-simple")).toBe(pricing.minimumOrderRub);
    expect(bedroom?.note).toBe("минимальный заказ");
  });

  it("более дорогие примеры не подписаны минимальным заказом", () => {
    expect(homePriceExamples.find((i) => i.id === "kitchen-shadow")?.note).toBeUndefined();
    expect(homePriceExamples.find((i) => i.id === "living-floating-track")?.note).toBeUndefined();
  });

  it("примеры идут по возрастанию суммы — от дешёвого к дорогому", () => {
    const totals = homePriceExamples.map((item) => calcExampleTotal(item.id));
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  it("у каждого примера есть пресет с площадью — калькулятор откроется заполненным", () => {
    for (const example of homePriceExamples) {
      expect(example.preset.areaDefault).toBeGreaterThan(0);
      expect(example.preset.ceilingType).toBeTruthy();
    }
  });

  it("кухня-гостиная открывает калькулятор на 24 м²", () => {
    const kitchen = homePriceExamples.find((item) => item.id === "kitchen-shadow");
    expect(kitchen?.preset.areaDefault).toBe(24);
    expect(kitchen?.preset.ceilingType).toBe("shadow");
  });
});
