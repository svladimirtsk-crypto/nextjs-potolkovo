import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://potolkovo-msk.ru/sitemap.xml",
    host: "https://potolkovo-msk.ru",
  };
}
