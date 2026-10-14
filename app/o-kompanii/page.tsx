import { brandSocialImage } from "@/content/brand-social";
import type { Metadata } from "next";
import Link from "next/link";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFooter } from "@/components/home/home-footer";
import { BrandPicture } from "@/components/brand/brand-picture";
import { EditorialContact } from "@/components/brand/editorial-contact";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";
import { brandPages, companyDiscussion } from "@/content/brand-pages";
import { company } from "@/content/company";
import { contacts } from "@/content/contacts";

const page = brandPages.company;
export const metadata: Metadata = {
  title: { absolute: page.title }, description: page.description,
  alternates: { canonical: page.path },
  openGraph: { title: page.title, description: page.description, url: page.path, images: [brandSocialImage(page.path)] },
  twitter: { card: "summary_large_image", title: page.title, description: page.description, images: [brandSocialImage(page.path)] },
};

export default function CompanyPage() {
  return <>
    <JsonLd data={buildBreadcrumbSchema([{ name: "Главная", path: "/" }, { name: "Компания", path: page.path }])} />
    <JsonLd data={{ "@context": "https://schema.org", "@type": "AboutPage", "@id": `https://potolkovo-msk.ru${page.path}#page`, url: `https://potolkovo-msk.ru${page.path}`, name: page.title, description: page.description, about: { "@id": "https://potolkovo-msk.ru#organization" } }} />
    <HomeHeader consultation />
    <main className="pk-editorial pk-company-page">
      <section className="pk-wrap pk-editorial-hero" id="hero">
        <nav className="pk-editorial-breadcrumb" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">Компания</span></nav>
        <div className="pk-editorial-hero-grid">
          <div className="pk-editorial-hero-copy"><p className="pk-eyebrow">Компания ПОТОЛКОВО</p><h1>За решением —<br />люди и подход.</h1><p className="pk-editorial-lead">Потолок, свет и детали интерьера связаны между собой. Мы начинаем с общей задачи — каким вы хотите видеть своё пространство.</p><p className="pk-editorial-body">{company.about.description}</p><div className="pk-editorial-actions"><a className="pk-link-button" href="#action">Обсудить задачу <span aria-hidden="true">↗</span></a><Link className="pk-text-link" href="/uslugi">Выбрать решение <span aria-hidden="true">↗</span></Link></div><p className="pk-editorial-footnote">Москва и область · Потолки · Свет · Монтаж</p></div>
          <BrandPicture id="architectural-living" priority sizes="(max-width: 900px) 100vw, 50vw" />
        </div>
        <nav className="pk-editorial-jumps" aria-label="О компании подробнее"><a href="#approach">Что важно в проекте <span aria-hidden="true">↓</span></a><a href="#people">Кто за этим стоит <span aria-hidden="true">↓</span></a><a href="#action">Контакты <span aria-hidden="true">↓</span></a></nav>
      </section>
      <section id="approach" className="pk-wrap pk-editorial-section">
        <div className="pk-editorial-section-head"><div><p className="pk-eyebrow">От идеи к деталям</p><h2>Сначала договориться.<br />Потом монтировать.</h2></div><p>Красивого изображения недостаточно. До начала работ важно обсудить состав решения, ограничения помещения и условия выполнения.</p></div>
        <ol className="pk-editorial-steps">{companyDiscussion.map((item, index) => <li key={item.title}><span className="pk-step-number">0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></li>)}</ol>
      </section>
      <section id="people" className="pk-editorial-people"><div className="pk-wrap pk-editorial-people-grid">
        <div><p className="pk-eyebrow">Люди за названием</p><h2>Личный опыт.<br />Совместная работа.</h2><p>Компания развивается вокруг опыта основателя и работы с привлечёнными мастерами. Для проектов потолков и освещения участвуют мастера и партнёрские монтажные бригады.</p><p>Основатель не обязательно выполняет каждый заказ лично. Участие конкретных исполнителей и условия работ обсуждаются под задачу объекта.</p></div>
        <div className="pk-founder-note"><span className="pk-founder-monogram" aria-hidden="true">ВС</span><p className="pk-eyebrow">{company.about.founderRole}</p><h3>{company.about.founder}</h3><p>Потолки, освещение и детали монтажа — основа работы, из которой развивается ПОТОЛКОВО.</p><a href={contacts.phoneHref} className="pk-text-link">Связаться с компанией <span aria-hidden="true">↗</span></a></div>
      </div></section>
      <section className="pk-wrap pk-editorial-section" aria-labelledby="directions-title">
        <div className="pk-editorial-section-head"><div><p className="pk-eyebrow">На чём сосредоточены</p><h2 id="directions-title">Архитектура потолка.<br />Продуманный свет.</h2></div><Link className="pk-text-link" href="/uslugi">Все девять направлений <span aria-hidden="true">↗</span></Link></div>
        <div className="pk-editorial-directions">{company.solutions.map((item, index) => <Link href={`/uslugi/${item.slug}`} key={item.slug}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><span aria-hidden="true">↗</span></Link>)}</div>
        <div className="pk-editorial-legal"><h3>Название компании и реквизиты</h3><p>ПОТОЛКОВО — название компании. Договорную сторону, состав работ и условия необходимо сверять с документами по вашему заказу.</p><p>На сайте указаны реквизиты: {contacts.legalName}. {contacts.legalStatus}. ИНН {contacts.inn}.</p><Link href="/privacy">Политика обработки персональных данных <span aria-hidden="true">↗</span></Link></div>
      </section>
      <EditorialContact />
    </main>
    <HomeFooter />
  </>;
}
