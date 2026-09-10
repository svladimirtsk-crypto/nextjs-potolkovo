import type { MetadataRoute } from "next";

import pageDates from "@/data/page-dates.json";
import { phase2Services } from "@/content/services";

const BASE_URL = "https://potolkovo-msk.ru";

/**
 * N-062 (F-30): дата правки страницы, а не дата сборки.
 *
 * Раньше главная и privacy получали `new Date()`, и поисковик видел
 * «изменилось» при каждом деплое. Если меняется всё и всегда — значит
 * ничего. Даты собирает `scripts/build-page-dates.mjs` из истории git.
 */
function pageDate(route: string, fallback: Date): Date {
  const raw = (pageDates as Record<string, string | undefined>)[route];
  if (!raw) return fallback;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Хаб живёт ровно настолько свежим, насколько свежа самая новая услуга.
  const latestServiceUpdate = new Date(
    Math.max(...phase2Services.map((service) => new Date(service.updatedAt).getTime()))
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: pageDate("/", now),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/uslugi`,
      // Хаб свежий настолько, насколько свежее из двух: правка кода или контента.
      lastModified: pageDate("/uslugi", latestServiceUpdate),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: pageDate("/privacy", now),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const servicePages: MetadataRoute.Sitemap = phase2Services.map((service) => ({
    url: `${BASE_URL}${service.pathname}`,
    // T-063: реальная дата правки контента, а не дата сборки.
    lastModified: new Date(service.updatedAt),
    changeFrequency: "monthly",
    priority: service.slug === "prodazha-trekovogo-osveshcheniya" ? 0.7 : 0.8,
  }));

  return [...staticPages, ...servicePages];
}
