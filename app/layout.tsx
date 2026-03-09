import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Натяжные потолки в Москве — ПОТОЛКОВО | Теневой профиль, световые линии, трековый свет",
  description:
    "Натяжные потолки любой сложности в Москве и МО. Частный мастер Владимир, опыт 15+ лет. Теневой профиль, парящие потолки, световые линии. Договор, гарантия.",
  keywords:
    "натяжные потолки, москва, теневой профиль, парящий потолок, световые линии, трековое освещение, скрытый карниз, светопрозрачный потолок, натяжные потолки москва, установка натяжных потолков",
  openGraph: {
    title: "ПОТОЛКОВО — натяжные потолки в Москве без компромиссов",
    description:
      "Частный мастер Владимир. 15+ лет опыта. Теневой профиль, парящие потолки, световые линии, трековый свет. Договор, гарантия.",
    type: "website",
    locale: "ru_RU",
    url: "https://potolkovo.ru",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrica" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=107200362", "ym");

            ym(107200362, "init", {
                clickmap:true,
                trackLinks:true,
                accurateTrackBounce:true,
                webvisor:true,
                ecommerce:"dataLayer",
                ssr: true
            });
          `}
        </Script>
        <noscript>
          <div>
            <img 
              src="https://mc.yandex.ru/watch/107200362" 
              style={{ position: 'absolute', left: '-9999px' }} 
              alt="" 
            />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}

        {children}
      </body>
    </html>
  );
}
