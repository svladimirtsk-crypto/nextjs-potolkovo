import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/seo/json-ld";
import { Picture } from "@/components/ui/picture";
import { contacts } from "@/content/contacts";
import { phase2Services } from "@/content/services";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";

/**
 * T-063 · Хаб услуг.
 *
 * До сих пор `/uslugi` отдавал 404: девять страниц услуг существовали, но
 * общей точки входа не было — ни для пользователя (из шапки попасть в список
 * нельзя), ни для поисковика (страницы связаны только перелинковкой снизу).
 */

export const metadata: Metadata = {
  title: { absolute: "Услуги — натяжные потолки и освещение в Москве и МО | ПОТОЛКОВО" },
  description:
    "Все услуги ПОТОЛКОВО: теневой профиль, парящие потолки, световые линии, скрытые карнизы, треки и продажа трекового света. Цены «от», бесплатный замер.",
  keywords: [
    "натяжные потолки москва",
    "услуги натяжные потолки",
    "теневой профиль",
    "световые линии",
    "трековое освещение",
  ],
  alternates: { canonical: "/uslugi" },
  openGraph: {
    title: "Услуги ПОТОЛКОВО — натяжные потолки и освещение",
    description:
      "Девять направлений: от простых полотен до световых линий и трековых систем. Цены «от» и бесплатный замер.",
    url: "/uslugi",
    images: [{ url: "/svc-shadow.jpeg" }],
  },
};

function buildItemListSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Услуги ПОТОЛКОВО",
    numberOfItems: phase2Services.length,
    itemListElement: phase2Services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: service.hero.breadcrumbLabel,
      url: `https://potolkovo-msk.ru${service.pathname}`,
    })),
  };
}

export default function UslugiHubPage() {
  return (
    <>
      <JsonLd data={buildItemListSchema()} />
      <JsonLd
        data={buildBreadcrumbSchema([
          { name: "Главная", path: "/" },
          { name: "Услуги", path: "/uslugi" },
        ])}
      />

      <header className="border-b border-slate-200 bg-white">
        <Container className="flex min-h-[var(--header-height)] items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={contacts.brandName}
            className="inline-flex shrink-0 items-center font-mono text-sm font-bold uppercase tracking-[0.24em] text-slate-950 sm:text-[15px]"
          >
            {contacts.brandShortName}
          </Link>

          <Link
            href="/#action"
            className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Записаться на замер
          </Link>
        </Container>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-slate-50">
          <Container className="py-14 sm:py-16">
            <nav aria-label="Хлебные крошки" className="text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-950">
                Главная
              </Link>
              <span className="px-2">/</span>
              <span className="text-slate-950">Услуги</span>
            </nav>

            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Натяжные потолки и освещение в Москве и МО
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Девять направлений — от простого полотна до световых линий и трековых систем.
              Работаю лично: замер, смета и монтаж без посредников. Цены ниже — стартовые,
              точная сумма считается на замере.
            </p>
          </Container>
        </section>

        <section>
          <Container className="py-14 sm:py-16">
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {phase2Services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={service.pathname}
                    className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/3] bg-slate-100">
                      <Picture
                        src={service.hero.imageSrc}
                        alt={service.hero.imageAlt}
                        fill
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                        imgClassName="object-cover"
                      />
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                        {service.hero.breadcrumbLabel}
                      </h2>

                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {service.price.fromLabel}
                      </p>

                      <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                        {service.hero.subtitle}
                      </p>

                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                        Подробнее
                        <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section className="border-t border-slate-200 bg-slate-950 text-white">
          <Container className="py-14 text-center sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Не знаете, какой узел подойдёт?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-white/70">
              Приеду на замер бесплатно, посмотрю геометрию и предложу решение под бюджет.
            </p>
            <Link
              href="/#action"
              className="mt-7 inline-flex rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              Записаться на бесплатный замер
            </Link>
          </Container>
        </section>
      </main>
    </>
  );
}
