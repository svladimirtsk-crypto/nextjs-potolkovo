import type { MetadataRoute } from "next";

import { phase2Services } from "@/content/services";

const BASE_URL = "https://potolkovo-msk.ru";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
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
    lastModified: now,
    changeFrequency: "monthly",
    priority: service.slug === "prodazha-trekovogo-osveshcheniya" ? 0.7 : 0.8,
  }));

  return [...staticPages, ...servicePages];
}
