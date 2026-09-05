import { describe, expect, it } from "vitest";

import { phase2Services, servicePageContent } from "@/content/services";
import { serviceLinks } from "@/content/service-links";

describe("T-046 - FAQ i opisaniya uslug", () => {
  it("u kazhdoy uslugi rovno 5 voprosov", () => {
    for (const service of phase2Services) {
      expect(service.faq, service.slug).toHaveLength(5);
    }
  });

  it("voprosy i otvety neputye i unikalny vnutri stranicy", () => {
    for (const service of phase2Services) {
      const questions = service.faq.map((item) => item.q);
      expect(new Set(questions).size, service.slug).toBe(questions.length);

      for (const item of service.faq) {
        expect(item.q.trim().length, service.slug).toBeGreaterThan(10);
        // Ответ должен что-то объяснять, а не отписываться одной строкой.
        expect(item.a.trim().length, service.slug).toBeGreaterThan(60);
      }
    }
  });

  it("u kazhdoy ssylki na uslugu est svoe korotkoe opisanie", () => {
    const descriptions = serviceLinks.map((link) => link.shortDescription);
    expect(new Set(descriptions).size).toBe(serviceLinks.length);

    for (const link of serviceLinks) {
      expect(link.shortDescription.trim().length, link.slug).toBeGreaterThan(20);
      // Ссылка должна указывать на существующую страницу услуги.
      expect(servicePageContent[link.slug]).toBeDefined();
    }
  });
});
