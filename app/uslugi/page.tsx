import { brandSocialImage } from "@/content/brand-social";
import { servicePriceAnchor } from "@/content/pricing";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { JsonLd } from "@/components/seo/json-ld";
import { BrandPicture } from "@/components/brand/brand-picture";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFooter } from "@/components/home/home-footer";
import { servicePresentation, serviceDisplayOrder } from "@/content/service-presentation";
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
    images: [brandSocialImage("/uslugi")],
  },
  twitter: { card: "summary_large_image", title: "Решения ПОТОЛКОВО — потолки и освещение", description: "Девять направлений потолков и освещения.", images: [brandSocialImage("/uslugi")] },
};

const orderedServices = serviceDisplayOrder.map(slug => phase2Services.find(service => service.slug === slug)!);

function buildItemListSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Услуги ПОТОЛКОВО",
    numberOfItems: phase2Services.length,
    itemListElement: orderedServices.map((service, index) => ({
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

      <HomeHeader />
      <main className="pk-services-hub">
        <section className="pk-services-intro">
          <Container>
            <nav aria-label="Хлебные крошки" className="pk-service-breadcrumb"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">Решения</span></nav>
            <p className="pk-service-eyebrow">Потолки · свет · монтаж</p>
            <div className="pk-services-intro-grid">
              <h1>Потолок и свет.<br />Под ваш интерьер.</h1>
              <div><p>От простого матового полотна до теневого примыкания, парящего контура и встроенного света. Начните с результата, который хотите видеть каждый день.</p><p>ПОТОЛКОВО — основатель, мастера и партнёрские бригады. Состав решения и работ согласуем до монтажа.</p><span className="pk-services-count">{String(orderedServices.length).padStart(2, "0")} направлений / Москва и область</span></div>
            </div>
            <nav className="pk-services-shortcuts" aria-label="Быстрый выбор решения"><a href="#service-tenevoy-profil">Теневые</a><a href="#service-paryashchie-potolki">Парящие</a><a href="#service-svetovye-linii">Световые линии</a><a href="#service-skrytye-karnizy">Карнизы</a><a href="#service-prostye-potolki">Стандартный потолок</a></nav>
          </Container>
        </section>
        <section id="solutions" aria-label="Все девять направлений" className="pk-services-solutions"><Container>
          <ul className="pk-services-grid">
            {orderedServices.map((service, index) => {
              const view = servicePresentation[service.slug];
              return <li key={service.slug} id={`service-${service.slug}`}><Link href={service.pathname} className="pk-service-card">
                <BrandPicture id={view.image} sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 45vw" />
                <div className="pk-service-card-copy"><p className="pk-service-eyebrow"><span>{String(index + 1).padStart(2, "0")}</span>{view.category}</p><h2>{service.hero.breadcrumbLabel}</h2><p>{view.summary}</p><div className="pk-service-card-footer"><strong>{servicePriceAnchor(service.slug).label}</strong><span>Подробнее <span aria-hidden="true">↗</span></span></div></div>
              </Link></li>;
            })}
          </ul>
        </Container></section>
        <section className="pk-services-help"><Container><div><p className="pk-service-eyebrow">Начнём с вашей задачи</p><h2>Не обязательно знать<br />название профиля.</h2><p>Расскажите о помещении и желаемом результате. Обсудим потолок, освещение и ограничения ремонта — без добавления лишних опций.</p><Link href="/#action">Обсудить проект <span aria-hidden="true">↗</span></Link></div></Container></section>
      </main>
      <HomeFooter />
    </>
  );
}
