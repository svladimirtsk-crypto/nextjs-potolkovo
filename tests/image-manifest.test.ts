import { describe, expect, it } from "vitest";
import manifest from "../data/image-manifest.json";

type Entry = { width: number; height: number; widths: number[]; blurDataURL: string };
const entries = Object.entries(manifest as Record<string, Entry>);

describe("T-061 · манифест изображений", () => {
  it("не пустой и покрывает hero", () => {
    expect(entries.length).toBeGreaterThan(20);
    expect(manifest).toHaveProperty("/hero1.jpeg");
  });

  it("у каждой записи есть размеры и blur-плейсхолдер", () => {
    for (const [src, entry] of entries) {
      expect(entry.width, src).toBeGreaterThan(0);
      expect(entry.height, src).toBeGreaterThan(0);
      expect(entry.widths.length, src).toBeGreaterThan(0);
      expect(entry.blurDataURL.startsWith("data:image/webp;base64,"), src).toBe(true);
    }
  });

  it("кейсы не тянут 1440 — в сетке они не шире 960", () => {
    for (const [src, entry] of entries) {
      if (src.startsWith("/proj-")) expect(Math.max(...entry.widths), src).toBeLessThanOrEqual(960);
    }
  });
});
