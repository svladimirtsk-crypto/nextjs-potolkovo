import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { brandPages, lightingScenes, lightingChecks, companyDiscussion } from "@/content/brand-pages";
import sitemap from "@/app/sitemap";

const source = (file: string) => readFileSync(path.resolve(import.meta.dirname, "..", file), "utf8");

describe("R7 editorial pages", () => {
  it("has distinct canonical destinations and stable sitemap dates", () => {
    const entries = sitemap();
    for (const page of Object.values(brandPages)) {
      expect(page.title).toContain("ПОТОЛКОВО");
      const matches = entries.filter(entry => entry.url.endsWith(page.path));
      expect(matches).toHaveLength(1);
      expect(new Date(matches[0].lastModified!).getTime()).not.toBeNaN();
    }
  });
  it("keeps scenarios explicitly illustrative, without concrete product claims or prices", () => {
    expect(lightingScenes).toHaveLength(3);
    expect(new Set(lightingScenes.map(scene => scene.id)).size).toBe(3);
    for (const scene of lightingScenes) expect(scene.brightness).toBeGreaterThan(0);
    const text = JSON.stringify({ lightingScenes, lightingChecks });
    expect(text).not.toMatch(/₽|\bRUB\b|официальный дилер|в наличии|любой комплект/);
    expect(text).toContain("не готовое обещание");
    expect(text).toContain("без интернета");
  });
  it("does not write calculator, cart or lead state when demonstrating scenes", () => {
    const text = source("components/brand/lighting-scenes.tsx");
    expect(text).not.toMatch(/useCalculator|localStorage|sessionStorage|fetch\(|submitLead/);
    expect(text).toContain("aria-pressed");
    expect(text).toContain("не демонстрация работы оборудования");
    expect(text).toContain("BrandPicture");
  });
  it("does not disguise a standard ceiling quote as a smart consultation", () => {
    const text = source("app/umnoe-osveshchenie/page.tsx");
    expect(text).toContain("<HomeHeader consultation");
    expect(text).toContain("<EditorialContact lighting");
    expect(text).not.toMatch(/ActionForm|ServiceHero|Offer|Product|openCalculator/);
    expect(source("components/brand/editorial-contact.tsx")).toContain("contacts.telegramUrl");
  });
  it("attributes the founder without inventing employees or replacing legal identity", () => {
    const text = source("app/o-kompanii/page.tsx");
    expect(text).toContain("company.about.founder");
    expect(text).toContain("contacts.legalName");
    expect(text).toContain("contacts.legalStatus");
    expect(text).toContain("не обязательно выполняет каждый заказ лично");
    expect(text).not.toMatch(/ООО|штатных сотрудников|руководитель отдела|лет на рынке/);
    expect(companyDiscussion).toHaveLength(4);
  });
  it("makes the new destinations available in header, footer and relevant home sections", () => {
    for (const file of ["components/home/home-header.tsx", "components/home/home-footer.tsx"]) {
      const text = source(file);
      for (const page of Object.values(brandPages)) expect(text).toContain(page.path);
    }
    expect(source("components/home/home-trust.tsx")).toContain(brandPages.company.path);
    expect(source("components/home/company-solutions.tsx")).toContain(brandPages.lighting.path);
  });
});
