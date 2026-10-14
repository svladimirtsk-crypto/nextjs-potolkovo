import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { TelegramPhotoCta } from "@/components/home/telegram-photo-cta";
import { availability } from "@/content/availability";
import manifest from "@/design/brand/v8/manifest.json";
const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("B8-001: company voice without unverified speed or delivery promises", () => {
  it("keeps the optional photo follow-up and request-code links", () => {
    const html = renderToStaticMarkup(createElement(TelegramPhotoCta, { leadCode: "PK-TEST-B8", className: "mt-3" }));
    expect(html).toContain("Фото к вашей заявке");
    expect(html).toContain("помогут обсудить детали до замера");
    expect(html).not.toMatch(/уточню|Хотите быстрее|ещё до выезда/);
    expect(html.match(/PK-TEST-B8/g)?.length).toBe(2);
    expect(html).toContain('data-testid="success-telegram"');
    expect(html).toContain('data-testid="success-whatsapp"');
    expect(html).toContain('class="pk-photo-cta mt-3"');
  });
  it("does not manufacture a request code when none exists", () => {
    const html = renderToStaticMarkup(createElement(TelegramPhotoCta, { leadCode: null }));
    expect(html).not.toMatch(/null|undefined|PK-TEST/);
  });
  it("uses company language for availability without extending unconfirmed dates", () => {
    expect(availability.fallbackLabel).toBe("Дату замера согласуем при звонке");
    expect(availability.validUntil).toBe("2026-10-05");
  });
  it("rescue promises a conversation, not an automatic SMS or personal reply", () => {
    const code = source("components/calculator-modal/use-rescue-lead.ts");
    expect(code).toContain("Сохранить расчёт и обсудить детали?");
    expect(code).toContain("свяжемся, обсудим расчёт");
    expect(code).not.toMatch(/Пришлю|отвечу|получить его на телефон|спама не будет/);
  });
  for (const file of ["components/lighting/PointKindPicker.tsx", "components/lighting/RecommendationsTab.tsx"]) {
    it(`${file}: empty catalog is not a personal guarantee of stock`, () => {
      expect(source(file)).toContain("Обсудим подходящие варианты при звонке.");
      expect(source(file)).not.toContain("Подберу вариант");
    });
  }
  it("removes unmeasured time claims and final-price wording from estimate surfaces", () => {
    const teaser = source("components/calculator-modal/calculator-teaser.tsx");
    expect(teaser).toContain("Предварительная стоимость без номера телефона");
    expect(teaser).not.toContain("Итоговая стоимость за 2 минуты");
    expect(source("app/uslugi/_components/ServiceMidCta.tsx")).toContain("Предварительный расчёт для вашей комнаты");
  });
});

describe("B8-002: current identity masters", () => {
  it("provides exactly three layouts in four tones in SVG and PNG", () => {
    expect(manifest.files).toHaveLength(24);
    for (const layout of ["horizontal", "compact", "symbol"]) {
      for (const tone of ["ink", "reverse", "black", "white"]) {
        expect(manifest.files.filter(f => f.layout === layout && f.tone === tone)).toHaveLength(2);
      }
    }
    expect(manifest.colorSpace).toContain("not CMYK");
  });
  for (const item of manifest.files) {
    it(`${item.file}: authentic outlined or transparent master`, async () => {
      const data = readFileSync(new URL(`../design/brand/v8/${item.file}`, import.meta.url));
      expect(createHash("sha256").update(data).digest("hex")).toBe(item.sha256);
      if (item.file.endsWith(".svg")) {
        expect(data.toString()).not.toMatch(/<text[ >]|<image[ >]|<script[ >]|font-family|href=/);
        expect(data.toString()).toContain("<path");
      } else {
        const meta = await sharp(data).metadata();
        expect(meta.hasAlpha).toBe(true);
        expect([meta.width, meta.height]).toEqual([item.width, item.height]);
      }
    });
  }
});
