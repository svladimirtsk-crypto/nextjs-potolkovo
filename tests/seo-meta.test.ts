import { statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { homepage } from "../content/homepage";
import pageDates from "../data/page-dates.json";

/**
 * N-062 · SEO-гигиена (F-30).
 */
const ROOT = path.resolve(import.meta.dirname, "..");

describe("title главной", () => {
  it("содержит ключевой интент — цену", () => {
    /**
     * Человек ищет «сколько стоит натяжной потолок», а заголовок перечислял
     * виды профилей. Слово «цена» в title — то, по чему он узнаёт свой запрос
     * в выдаче.
     */
    expect(homepage.metadata.title.toLowerCase()).toMatch(/цена|стоимость|сколько/);
  });

  it("умещается в выдачу и называет бренд", () => {
    // Больше ~70 символов Google обрезает многоточием.
    expect(homepage.metadata.title.length).toBeLessThanOrEqual(70);
    expect(homepage.metadata.title).toContain("ПОТОЛКОВО");
  });
});

describe("og:image", () => {
  it("отдельный кадр 1200×630, а не hero целиком", () => {
    expect(homepage.metadata.ogImageWidth).toBe(1200);
    expect(homepage.metadata.ogImageHeight).toBe(630);
  });

  it("файл существует и весит не больше 200 КБ", () => {
    /**
     * Превью грузится при каждом расшаривании ссылки, в том числе на мобильном
     * интернете. Прежние 752 КБ — это три четверти мегабайта на картинку,
     * которую половина получателей даже не откроет.
     */
    const file = path.join(ROOT, "public", homepage.metadata.ogImageSrc);
    const { size } = statSync(file);

    expect(size).toBeLessThanOrEqual(200 * 1024);
  });

  it("формат webp — он легче jpeg при том же качестве", () => {
    expect(homepage.metadata.ogImageSrc.endsWith(".webp")).toBe(true);
  });
});

describe("даты страниц для sitemap", () => {
  const dates = pageDates as Record<string, string>;

  it("собраны для главной, хаба услуг и privacy", () => {
    for (const route of ["/", "/uslugi", "/privacy"]) {
      expect(dates[route], route).toBeTruthy();
    }
  });

  it("это разбираемые даты не из будущего", () => {
    for (const [route, raw] of Object.entries(dates)) {
      const parsed = new Date(raw);
      expect(Number.isNaN(parsed.getTime()), route).toBe(false);
      expect(parsed.getTime(), route).toBeLessThanOrEqual(Date.now() + 60_000);
    }
  });

  it("страницы не обновились все разом — иначе это дата сборки", () => {
    /**
     * Смысл поля в том, чтобы отличать свежие страницы от старых. Если все
     * даты совпали до секунды, значит скрипт вернул время сборки, и поисковику
     * это поле снова бесполезно.
     */
    const unique = new Set(Object.values(dates));
    expect(unique.size).toBeGreaterThan(1);
  });
});
