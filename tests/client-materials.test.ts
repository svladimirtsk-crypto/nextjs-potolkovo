import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { contacts } from "@/content/contacts";
import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import data from "@/design/client/v8/source-data.json";
import inventory from "@/design/client/v8/photo-inventory.json";
import templates from "@/design/client/v8/templates.json";
import manifest from "@/design/client/v8/manifest.json";
const file = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));

describe("B8-003: honest editable client material templates", () => {
  it("takes public contacts from the existing single source without asserting a seller model", () => {
    expect(data.contacts).toEqual({ brandName: contacts.brandName, phoneDisplay: contacts.phoneDisplay, phoneHref: contacts.phoneHref, telegramUrl: contacts.telegramUrl, whatsappUrl: contacts.whatsappUrl, emailDisplay: contacts.emailDisplay });
    expect(data.contacts).not.toHaveProperty("legalName");
    expect(data.contacts).not.toHaveProperty("inn");
    expect(manifest.legalFieldsCopied).toBe(false);
  });
  it("contains five documents, ten pages and explicit audience and draft labels", () => {
    expect(templates.documents).toHaveLength(5);
    expect(templates.documents.flatMap(d => d.pages)).toHaveLength(10);
    expect(new Set(templates.documents.map(d => d.id)).size).toBe(5);
    for (const doc of templates.documents) {
      expect(doc.audience.length).toBeGreaterThan(10);
      expect(file(`design/client/v8/editable/${doc.id}.docx`).subarray(0, 2).toString()).toBe("PK");
    }
    expect(templates.status).toContain("Не отправлять");
  });
  it("does not silently implement a second pricing engine or auto-export contract", () => {
    expect(manifest.pricingCalculation).toBe(false);
    expect(manifest.automaticSiteExport).toBe(false);
    const proposal = JSON.stringify(templates.documents[0]);
    expect(proposal).toContain("из исходного расчёта");
    expect(proposal).toContain("нет автоматической выгрузки из сайта");
    expect(proposal).toContain("Это не счёт на оплату");
    expect(proposal).not.toMatch(/предоплата\s*\d|гарантия\s*\d|\d[\d\s]*₽/i);
  });
  it("does not replace acceptance and warranty terms with a legal-looking form", () => {
    const service = JSON.stringify(templates.documents[2]);
    expect(service).toContain("не заменяет согласованный акт");
    expect(service).toContain("Сроки и исключения гарантии не заполняются автоматически");
  });
});

describe("B8-004: inventory does not establish rights or create case pages", () => {
  it("maps exactly the six current proof items and their actual eighteen photographs", () => {
    expect(data.projects.map(p => p.slug)).toEqual(homepage.proof.items.map(p => p.slug));
    for (const project of data.projects) {
      const asset = homeAssets.find(a => a.assetKey === project.assetKey);
      expect(asset && "gallery" in asset ? [...asset.gallery] : []).toEqual(project.photos);
      expect(project.publicationStatus).toContain("Не подтверждено");
    }
    expect(inventory).toHaveLength(18);
    expect(new Set(inventory.map(p => p.path)).size).toBe(18);
  });
  for (const photo of inventory) {
    it(`${photo.photoId}: unchanged original and no inferred publication permission`, () => {
      const bytes = file(`public${photo.path}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(photo.sha256);
      expect(bytes.length).toBe(photo.bytes);
      expect(photo.rightsStatus).toBe("Не подтверждено");
      expect(photo.publicationDecision).toBe("Не публиковать");
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
    });
  }
  it("requires attribution, rights and owner approval before publishing new project pages", () => {
    const passport = JSON.stringify(templates.documents[3]);
    expect(passport).toContain("По умолчанию новый кейс не публикуется");
    expect(passport).toContain("основатель до бренда");
    expect(passport).toContain("право публикации");
    expect(passport).toContain("проверены владельцем");
    expect(manifest.publication).toContain("none");
  });
});
