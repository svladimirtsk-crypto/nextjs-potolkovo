import { brandSocialImage } from "@/content/brand-social";
import type { Metadata } from "next";
import Link from "next/link";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFooter } from "@/components/home/home-footer";
import { LightingScenes } from "@/components/brand/lighting-scenes";
import { EditorialContact } from "@/components/brand/editorial-contact";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbSchema } from "@/lib/seo-schema";
import { brandPages, lightingChecks } from "@/content/brand-pages";

const page = brandPages.lighting;
export const metadata: Metadata = {
  title: { absolute: page.title }, description: page.description,
  alternates: { canonical: page.path },
  openGraph: { title: page.title, description: page.description, url: page.path, images: [brandSocialImage(page.path)] },
  twitter: { card: "summary_large_image", title: page.title, description: page.description, images: [brandSocialImage(page.path)] },
};

export default function ManagedLightingPage() {
  return <>
    <JsonLd data={buildBreadcrumbSchema([{ name: "Главная", path: "/" }, { name: "Управляемый свет", path: page.path }])} />
    <HomeHeader consultation />
    <main className="pk-editorial pk-lighting-page">
      <section className="pk-smart-hero" id="hero"><div className="pk-wrap">
        <nav className="pk-editorial-breadcrumb" aria-label="Хлебные крошки"><Link href="/">Главная</Link><span aria-hidden="true">/</span><span aria-current="page">Управляемый свет</span></nav>
        <div className="pk-smart-hero-grid"><div className="pk-editorial-hero-copy"><p className="pk-eyebrow">Освещение и управление</p><h1>Не просто <br />включить. <br /><em>Настроить <br />под себя.</em></h1><p className="pk-editorial-lead">Свет для дел, мягкий вечерний режим, подсветка ночью. Начните с того, как вы живёте, — не со списка артикулов.</p><div className="pk-editorial-actions"><a className="pk-link-button" href="#action">Обсудить сценарии <span aria-hidden="true">↗</span></a></div><p className="pk-editorial-footnote">Подбор по задаче. Функции и совместимость — после проверки конкретного комплекта.</p></div><LightingScenes /></div>
      </div></section>
      <section className="pk-wrap pk-editorial-section" id="layers">
        <div className="pk-editorial-section-head"><div><p className="pk-eyebrow">Свет начинается с пространства</p><h2>Не один источник.<br />Несколько задач.</h2></div><p>Разделите общий свет, освещение отдельных зон и декоративную подсветку. Управление связывает их в сценарии — если выбранные компоненты это поддерживают.</p></div>
        <div className="pk-light-layers">
          <Link href="/uslugi/trekovoe-osveshchenie"><span className="pk-layer-drawing pk-layer-track" aria-hidden="true"><i /><i /><i /></span><span className="pk-step-number">01 / Основной и направленный</span><h3>Свет там,<br />где он нужен.</h3><p>Треки и светильники для общего освещения и отдельных зон. Расположение зависит от мебели и задач.</p><span className="pk-text-link">Трековое освещение <span aria-hidden="true">↗</span></span></Link>
          <Link href="/uslugi/svetovye-linii"><span className="pk-layer-drawing pk-layer-line" aria-hidden="true"><i /></span><span className="pk-step-number">02 / Встроенный в потолок</span><h3>Линия света.<br />Часть архитектуры.</h3><p>Световые линии задают геометрию. Их мощность и расположение подбираются для конкретного помещения.</p><span className="pk-text-link">Световые линии <span aria-hidden="true">↗</span></span></Link>
          <Link href="/uslugi/paryashchie-potolki"><span className="pk-layer-drawing pk-layer-perimeter" aria-hidden="true"><i /></span><span className="pk-step-number">03 / Мягкая подсветка</span><h3>Свет, который<br />создаёт настроение.</h3><p>Парящий контур или подсветка карниза как отдельная световая группа, а не автоматическая замена основного света.</p><span className="pk-text-link">Парящие потолки <span aria-hidden="true">↗</span></span></Link>
        </div>
      </section>
      <section id="compatibility" className="pk-smart-checks"><div className="pk-wrap pk-smart-checks-grid"><div><p className="pk-eyebrow">До выбора оборудования</p><h2>«Хочу с Алисой» —<br />хорошее начало<br />разговора.</h2><p>Но не подтверждение совместимости. Приложение, голос и сценарии зависят от конкретных устройств и того, как они соединены.</p><div className="pk-smart-supplier"><span>Компоненты EKS</span><p>Рассматриваем оборудование EKS для комплектации. Наличие товара в каталоге само по себе не означает поддержку SMART. Проверять нужно характеристики выбранных моделей и всего комплекта.</p><Link className="pk-text-link" href="/uslugi/prodazha-trekovogo-osveshcheniya">Каталог оборудования <span aria-hidden="true">↗</span></Link></div></div><ol>{lightingChecks.map((item, index) => <li key={item.title}><span>0{index + 1}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></li>)}</ol></div></section>
      <section className="pk-wrap pk-editorial-section pk-smart-start" aria-labelledby="smart-start-title"><div><p className="pk-eyebrow">Что подготовить к разговору</p><h2 id="smart-start-title">Можно начать<br />с обычного плана.</h2><p>Не нужно заранее разбираться во всех протоколах и контроллерах. Важнее понять помещение, ограничения ремонта и ваши привычки.</p><Link className="pk-text-link" href="/uslugi/skrytye-karnizy">Подсветка и скрытые карнизы <span aria-hidden="true">↗</span></Link></div><ul><li><b>Помещение</b><span>Размеры или план, расстановка мебели, высота потолка.</span></li><li><b>Этап ремонта</b><span>Новый потолок или готовая отделка, доступная проводка.</span></li><li><b>Сценарии</b><span>Где нужен яркий свет, где мягкий, что хотите включать отдельно.</span></li><li><b>Управление</b><span>Выключатель, приложение или голос. Модели уже купленных устройств, если они есть.</span></li></ul></section>
      <EditorialContact lighting />
    </main>
    <HomeFooter />
  </>;
}
