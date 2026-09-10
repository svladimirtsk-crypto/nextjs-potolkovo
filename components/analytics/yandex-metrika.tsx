"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { YM_COUNTER } from "@/lib/analytics";

/**
 * T-061 · Счётчик Яндекс.Метрики.
 *
 * Вебвизор пишет полную сессию и заметно нагружает страницу, поэтому включаем
 * его только там, где записи реально смотрят: главная и страница продажи
 * света — единственные, где есть длинный сценарий выбора. На остальных
 * страницах остаётся обычный счётчик.
 */
const WEBVISOR_PATHS = new Set(["/", "/uslugi/prodazha-trekovogo-osveshcheniya"]);

export function YandexMetrika() {
  const pathname = usePathname();
  const webvisor = WEBVISOR_PATHS.has(pathname);

  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`
        (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=${YM_COUNTER}", "ym");

        ym(${YM_COUNTER}, "init", {
          clickmap: true,
          trackLinks: true,
          accurateTrackBounce: true,
          webvisor: ${webvisor},
          ecommerce: "dataLayer",
          ssr: true
        });
      `}
    </Script>
  );
}
