import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      /**
       * PT-016 · `/admin/availability` — служебная страница календаря замеров.
       * Индексировать её нечего (пароль в разметке не хранится, но и показывать
       * поисковику раздел, куда заходит один человек, незачем). Дублируется
       * `robots: { index: false }` в метаданных страницы.
       */
      disallow: ["/admin"],
    },
    sitemap: "https://potolkovo-msk.ru/sitemap.xml",
    host: "https://potolkovo-msk.ru",
  };
}
