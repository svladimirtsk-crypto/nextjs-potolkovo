import Link from "next/link";
import { servicePriceAnchor } from "@/content/pricing";
import type { ServicePageContent } from "@/content/services";
import { servicePresentation, servicePriceScope } from "@/content/service-presentation";
import { BrandPicture } from "@/components/brand/brand-picture";
import { Container } from "@/components/ui/container";
import { ServiceHeroLightingCta } from "./ServiceHeroLightingCta";
import { ServiceHeroCta } from "./ServiceHeroCta";
import { serviceCtaLabel } from "@/lib/service-page-actions";

type ServiceHeroProps = { priceBadgeOverride?: string; availabilityNote?: string; service: ServicePageContent };

export function ServiceHero({ service, priceBadgeOverride, availabilityNote }: ServiceHeroProps) {
  const price = servicePriceAnchor(service.slug);
  const view = servicePresentation[service.slug];
  const sale = service.slug === "prodazha-trekovogo-osveshcheniya";
  return <section id="hero" className="pk-service-hero" aria-labelledby={`${service.slug}-hero-title`}>
    <Container>
      <nav aria-label="Хлебные крошки" className="pk-service-breadcrumb"><Link href="/">Главная</Link><span aria-hidden="true">/</span><Link href="/uslugi">Решения</Link><span aria-hidden="true">/</span><span aria-current="page">{service.hero.breadcrumbLabel}</span></nav>
      <div className="pk-service-hero-grid">
        <div className="pk-service-hero-copy">
          <p className="pk-service-eyebrow">ПОТОЛКОВО / {view.category}</p>
          <h1 id={`${service.slug}-hero-title`}>{view.title}</h1>
          <p className="pk-service-intro">{view.summary}</p>
          <div className="pk-service-anchor"><span>{servicePriceScope[service.slug].label}</span><strong>{priceBadgeOverride ?? price.label}</strong>
            {!priceBadgeOverride && price.note && <p>{price.note}</p>}
            <p>{servicePriceScope[service.slug].note}</p>
            {sale && availabilityNote && <p>{availabilityNote}</p>}
          </div>
          <div className="pk-service-hero-actions">
            {sale ? <><a className="pk-service-primary" href="#price">{service.hero.primaryCtaLabel}<span aria-hidden="true">↗</span></a><ServiceHeroLightingCta label="Открыть в калькуляторе" /></> : <><ServiceHeroCta label={serviceCtaLabel(service.slug)} /><a href="#action">Записаться на замер <span aria-hidden="true">↗</span></a></>}
          </div>
          <p className="pk-service-company">Потолки · свет · монтаж<br /><span>Основатель, мастера и партнёрские бригады ПОТОЛКОВО</span></p>
        </div>
        <BrandPicture id={view.image} priority sizes="(max-width: 1023px) 100vw, 55vw" className="pk-service-visual" />
      </div>
      <nav className="pk-service-jumps" aria-label="Разделы страницы">
        {!sale && <a href="#proof">Примеры решений <span aria-hidden="true">↓</span></a>}
        <a href="#price">{sale ? "Каталог и комплектация" : "Стоимость и состав"} <span aria-hidden="true">↓</span></a>
        <a href="#action">Обсудить задачу <span aria-hidden="true">↓</span></a>
      </nav>
    </Container>
  </section>;
}
