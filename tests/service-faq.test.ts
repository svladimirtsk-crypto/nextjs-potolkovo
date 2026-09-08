import { describe, expect, it } from "vitest";

import { phase2Services, servicePageContent } from "@/content/services";
import { serviceLinks } from "@/content/service-links";

describe("T-046 - FAQ i opisaniya uslug", () => {
  it("у каждой услуги 5-6 вопросов", () => {
    /**
     * N-060: было «ровно 5». Пункт 4 ТЗ добавил вопрос про неровные стены и
     * нехватку высоты тем услугам, где его не хватало, поэтому жёсткое число
     * больше не подходит. Диапазон всё равно держит форму: меньше пяти —
     * раздел выглядит незаполненным, больше шести — его перестают читать.
     */
    for (const service of phase2Services) {
      expect(service.faq.length, service.slug).toBeGreaterThanOrEqual(5);
      expect(service.faq.length, service.slug).toBeLessThanOrEqual(6);
    }
  });

  it("каждая услуга честно отвечает, что будет при неровных стенах или нехватке высоты", () => {
    /**
     * F-38: самый частый страх клиента — «а если у меня кривые стены и цена
     * вырастет». Молчание об этом читается как умолчание, поэтому вопрос
     * должен быть на каждой странице.
     */
    for (const service of phase2Services) {
      const covered = service.faq.some((item) =>
        /неровн|кривизн|кривы|геометри[ияюей]\s+стен|запас[а]?\s+по\s+высоте|не хватает высоты|высоты потолка|не подойдёт/i.test(
          `${item.q} ${item.a}`
        )
      );
      expect(covered, service.slug).toBe(true);
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
