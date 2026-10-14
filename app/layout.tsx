import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { brandSocialImage } from "@/content/brand-social";

import { JsonLd } from "@/components/seo/json-ld";
import { YandexMetrika } from "@/components/analytics/yandex-metrika";
import { buildLocalBusinessSchema } from "@/lib/seo-schema";

import { Providers } from "./providers";
import "./globals.css";
import "./brand.css";
import "./calculator-brand.css";
import "./catalog-brand.css";
import "./services-brand.css";
import "./editorial-brand.css";
import "./polish-brand.css";
import "./proof-brand.css";

const inter = localFont({
  src: "../public/brand/v7/inter-cyrillic-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display:  "swap",
});

export const viewport: Viewport = { themeColor: "#173c36" };

export const metadata: Metadata = {
  metadataBase: new URL("https://potolkovo-msk.ru"),
  title: {
    default:  "ПОТОЛКОВО",
    template: "%s | ПОТОЛКОВО",
  },
  description:
    "Современные натяжные потолки в Москве и Московской области. Теневые и парящие потолки, световые линии, подбор освещения и монтаж.",
  icons: { apple: [{ url: "/brand/v7/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  twitter: { card: "summary_large_image", images: [brandSocialImage("/")] },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type:     "website",
    locale:   "ru_RU",
    siteName: "ПОТОЛКОВО",
    url:      "https://potolkovo-msk.ru",
    images: [brandSocialImage("/")],
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

        {process.env.NEXT_PUBLIC_PREVIEW_MODE !== "1" && <noscript
          dangerouslySetInnerHTML={{
            __html:
              '<div><img src="https://mc.yandex.ru/watch/107200362" style="position:absolute;left:-9999px" alt="" /></div>',
          }}
        />}

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
