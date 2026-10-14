import { createElement, Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import covers from "@/design/brand/v7/social-covers.json";
import { brandSocialImage } from "@/content/brand-social";
import { phase2ServiceSlugs } from "@/content/services";
import { RecoveryScreen } from "@/components/brand/recovery-screen";
import { Button } from "@/components/ui/button";
import manifest from "@/app/manifest";

const root = path.resolve(import.meta.dirname, "..");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("R7 branded digital identity", () => {
  it("covers all fourteen public destinations without replacing service URLs", () => {
    expect(covers.map(item => item.route).sort()).toEqual(["/", "/uslugi", "/o-kompanii", "/umnoe-osveshchenie", "/privacy", ...phase2ServiceSlugs.map(slug => `/uslugi/${slug}`)].sort());
    expect(() => brandSocialImage("/unknown")).toThrow();
  });
  for (const cover of covers) it(`${cover.id}: JPEG 1200×630 under 200KB and explicit provenance`, async () => {
    const image = brandSocialImage(cover.route);
    const file = path.join(root, "public", image.url);
    const meta = await sharp(file).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 1200, 630]);
    expect(statSync(file).size).toBeLessThanOrEqual(200 * 1024);
    if (cover.image) expect(image.alt).toContain("AI-визуализация");
  });
  it("has valid PNG-encoded ICO frames and a real Apple touch icon", async () => {
    const ico = readFileSync(path.join(root, "app/favicon.ico"));
    expect(ico.readUInt16LE(0)).toBe(0); expect(ico.readUInt16LE(2)).toBe(1); expect(ico.readUInt16LE(4)).toBe(3);
    for (let i = 0; i < 3; i++) {
      const offset = 6 + i * 16, length = ico.readUInt32LE(offset + 8), start = ico.readUInt32LE(offset + 12);
      const meta = await sharp(ico.subarray(start, start + length)).metadata();
      expect([meta.width, meta.height]).toEqual([[16, 16], [32, 32], [48, 48]][i]);
    }
    const apple = await sharp(path.join(root, "public/brand/v7/apple-touch-icon.png")).metadata();
    expect([apple.width, apple.height]).toEqual([180, 180]);
    expect(manifest().display).toBe("browser");
  });
  it("vendors a licensed Cyrillic font and removes font-download dependency from the build", () => {
    expect(source("app/layout.tsx")).toContain('next/font/local');
    expect(source("app/layout.tsx")).not.toContain('next/font/google');
    expect(source("design/brand/v7/typefaces/OFL.txt")).toContain("SIL OPEN FONT LICENSE");
    const provenance = JSON.parse(source("design/brand/v7/typefaces/provenance.json"));
    expect(createHash("sha256").update(readFileSync(path.join(root, "public/brand/v7/inter-cyrillic-latin.woff2"))).digest("hex")).toBe(provenance.woff2SHA256);
  });
  it("preserves the legal paragraphs during visual redesign", () => {
    const text = source("app/privacy/page.tsx");
    const paragraphs = text.slice(text.indexOf("const privacySections:"), text.indexOf("export default function PrivacyPage"));
    expect(createHash("sha256").update(paragraphs).digest("hex")).toBe("b8ab625f600feb5ff182a90d1317f8a9f24185fb728b366cb2cc2d7ccc5623a2");
  });
});

function findReset(node: ReactNode): ReactElement<{ children?: ReactNode; onClick?: () => void }> | undefined {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return;
  if (node.type === "button") return node;
  for (const child of Children.toArray(node.props.children)) { const match = findReset(child); if (match) return match; }
}

describe("R7 recovery and accessible controls", () => {
  it("forwards accessible labels instead of exposing only arrow glyphs", () => {
    const html = renderToStaticMarkup(Button({ "aria-label": "Следующие работы", children: "→" }));
    expect(html).toContain('aria-label="Следующие работы"');
  });
  it("offers real recovery links without inventing a lost or saved order", () => {
    const html = renderToStaticMarkup(createElement(RecoveryScreen, { kind: "not-found" }));
    for (const link of ["/", "/uslugi", "/o-kompanii", "/umnoe-osveshchenie"]) expect(html).toContain(`href="${link}"`);
    expect(html).not.toMatch(/напишите мне|отвечу быстро|заказ сохранён/);
  });
  it("calls the provided error-reset callback only on explicit action", () => {
    const reset = vi.fn();
    const tree = RecoveryScreen({ kind: "error", reset });
    expect(reset).not.toHaveBeenCalled();
    const button = findReset(tree); expect(button).toBeDefined(); button?.props.onClick?.();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
