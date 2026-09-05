import { describe, expect, it } from "vitest";
import { phase2Services, servicePageContent } from "../content/services";
import { buildServiceSchema } from "../lib/seo-schema";
import { servicePriceAnchor } from "../content/pricing";

describe("T-063 · SEO услуг", () => {
  it("у каждой услуги есть валидная updatedAt", () => {
    for (const service of phase2Services) {
      expect(service.updatedAt, service.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(service.updatedAt).getTime()), service.slug).toBe(false);
    }
  });

  // N-002: priceBadge/fromLabel/offerFrom удалены из content/services.ts —
  // единственный источник цены теперь servicePriceAnchor(slug).
  it("якорь цены согласован сам с собой: число в подписи = value", () => {
    for (const service of phase2Services) {
      const anchor = servicePriceAnchor(service.slug);
      if (anchor.value === null) {
        expect(/\d/.test(anchor.label), service.slug).toBe(false);
      } else {
        const digits = anchor.label.replace(/[^\d]/g, "");
        expect(digits, service.slug).toBe(String(anchor.value));
      }
    }
  });

  it("Offer добавляется только там, где есть цена", () => {
    const withPrice = buildServiceSchema(servicePageContent["tenevoy-profil"]);
    expect(withPrice).toHaveProperty("offers");
    expect((withPrice as { offers: { priceSpecification: { minPrice: number } } }).offers
      .priceSpecification.minPrice).toBe(950);

    const byRequest = buildServiceSchema(servicePageContent["individualnye-proekty"]);
    expect(byRequest).not.toHaveProperty("offers");
  });

  it("трековые страницы разведены: монтаж vs покупка", () => {
    const install = servicePageContent["trekovoe-osveshchenie"];
    const sale = servicePageContent["prodazha-trekovogo-osveshcheniya"];

    expect(install.metadata.title).toContain("Монтаж");
    expect(install.hero.h1).toContain("Встроенный трек");
    expect(sale.metadata.title).toContain("Купить");
    expect(install.metadata.title).not.toBe(sale.metadata.title);
    expect(install.hero.h1).not.toBe(sale.hero.h1);
  });
});
