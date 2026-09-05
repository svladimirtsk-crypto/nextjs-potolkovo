import { describe, expect, it } from "vitest";
import { phase2Services, servicePageContent } from "../content/services";
import { buildServiceSchema } from "../lib/seo-schema";

describe("T-063 · SEO услуг", () => {
  it("у каждой услуги есть валидная updatedAt", () => {
    for (const service of phase2Services) {
      expect(service.updatedAt, service.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(service.updatedAt).getTime()), service.slug).toBe(false);
    }
  });

  it("offerFrom согласован с текстовым fromLabel", () => {
    for (const service of phase2Services) {
      const { offerFrom, fromLabel } = service.price;
      if (offerFrom === null) {
        // «по расчёту»/«по запросу» — цифры в подписи быть не должно
        expect(/\d/.test(fromLabel), service.slug).toBe(false);
      } else {
        const digits = fromLabel.replace(/[^\d]/g, "");
        expect(digits, service.slug).toBe(String(offerFrom.minPrice));
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
