import type { MetadataRoute } from "next";

import { phase2Services } from "@/content/services";

const BASE_URL = "https://potolkovo-msk.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Хаб живёт ровно настолько свежим, насколько свежа самая новая услуга.
  const latestServiceUpdate = new Date(
    Math.max(...phase2Services.map((service) => new Date(service.updatedAt).getTime()))
  );

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/uslugi`,
      lastModified: latestServiceUpdate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
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
