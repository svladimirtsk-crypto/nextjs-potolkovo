import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { JsonLd } from "@/components/seo/json-ld";
import { YandexMetrika } from "@/components/analytics/yandex-metrika";
import { buildLocalBusinessSchema } from "@/lib/seo-schema";

import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets:  ["latin", "cyrillic"],
  variable: "--font-sans",
  display:  "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://potolkovo-msk.ru"),
  title: {
    default:  "ПОТОЛКОВО",
    template: "%s | ПОТОЛКОВО",
  },
  description:
    "Современные натяжные потолки в Москве и Московской области. Личный монтаж, договор и гарантия.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type:     "website",
    locale:   "ru_RU",
    siteName: "ПОТОЛКОВО",
    url:      "https://potolkovo-msk.ru",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body
        className={`${inter.variable} antialiased`}
      >

        <YandexMetrika />

        <JsonLd data={buildLocalBusinessSchema()} />

        <noscript
          dangerouslySetInnerHTML={{
            __html:
              '<div><img src="https://mc.yandex.ru/watch/107200362" style="position:absolute;left:-9999px" alt="" /></div>',
          }}
        />

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
