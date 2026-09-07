import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { getRequiredServicePageBySlug } from "@/content/services";
import { buildFaqSchema, buildProductListSchema } from "@/lib/seo-schema";
import { ServicePageLayoutV2 } from "../_components/ServicePageLayoutV2";
import { ServiceHero } from "../_components/ServiceHero";
import { getKitsPriceAnchorRub, getTrackSaleProductOffers } from "./_components/LightKitShowcase";
import { formatFromAnchorRub } from "@/lib/home-price-anchor";
import { ServiceActionSection } from "../_components/ServiceActionSection";
import { ServiceRelatedServices } from "../_components/ServiceRelatedServices";
import { AvitoReviewsSection } from "@/components/home/avito-reviews-section";
import { LightKitShowcase } from "./_components/LightKitShowcase";
import { CatalogSection } from "./_components/CatalogSection";
import { TrackSaleSystemGuideSection } from "./_components/TrackSaleSystemGuideSection";
import { TrackSaleFaqSection, trackSaleFaqItems } from "./_components/TrackSaleFaqSection";
import { TrackSaleOrderingSection } from "./_components/TrackSaleOrderingSection";
import { TrackSaleTermsSection } from "./_components/TrackSaleTermsSection";
import { ServiceAboutSection } from "../_components/ServiceAboutSection";
import { ServiceUseCasesSection } from "../_components/ServiceUseCasesSection";
import snapshotData from "@/data/eks-feed2-snapshot.json";

const service = getRequiredServicePageBySlug("prodazha-trekovogo-osveshcheniya");

export const metadata: Metadata = {
  title: { absolute: service.metadata.title },
  description: service.metadata.description,
  keywords:    service.metadata.keywords,
  alternates:  { canonical: service.metadata.canonicalPath },
  openGraph: {
    title:       service.metadata.ogTitle,
    description: service.metadata.ogDescription,
    url:         service.pathname,
    images:      [{ url: service.metadata.ogImage }],
  },
};

export default function ProdazhaTrekovogoOsveshcheniyaPage() {
  const kitsAnchorRub = getKitsPriceAnchorRub();
  const { kits, topProducts } = getTrackSaleProductOffers();

  /** N-040 (F-42): наличие и дата прайса — то, чего не было на первом экране. */
  const priceListDate = new Date(String((snapshotData as { updatedAt?: unknown }).updatedAt ?? ""));
  const availabilityNote = Number.isNaN(priceListDate.getTime())
    ? "Со склада поставщика · сроки уточню при заказе"
    : `Со склада поставщика · наличие по прайсу от ${priceListDate.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`;
  /**
   * N-040 (F-42): «от 2 418 ₽» — точность до рубля в слове «от».
   * Округляем вниз до 100 ₽ общим roundFromAnchor из N-031: вниз, чтобы
   * названная цена не оказалась выше реальной минимальной.
   */
  const kitsPriceBadge = kitsAnchorRub ? formatFromAnchorRub(kitsAnchorRub) : undefined;

  return (
    <>
      <JsonLd data={buildFaqSchema(trackSaleFaqItems)} />
      {/* T-063: комплекты и топ каталога — товарные офферы, а не услуга */}
      {kits.length > 0 ? (
        <JsonLd data={buildProductListSchema(kits, "Готовые комплекты трекового света")} />
      ) : null}
      {topProducts.length > 0 ? (
        <JsonLd data={buildProductListSchema(topProducts, "Трековое освещение COLIBRI, CLARUS, ART")} />
      ) : null}
      <ServicePageLayoutV2
        service={service}
        hero={
          <ServiceHero
            service={service}
            priceBadgeOverride={kitsPriceBadge}
            availabilityNote={availabilityNote}
          />
        }
        proof={<LightKitShowcase />}
        price={
          <>
            {/*
              N-040 (F-43): объяснение систем стоит ПЕРЕД каталогом.
              Раньше «COLIBRI / CLARUS / ART — что подойдёт» шло после
              длинного каталога, то есть после момента, когда систему уже
              нужно было выбрать.
            */}
            <TrackSaleSystemGuideSection />
            <CatalogSection />
            {/* T-045: контент страницы уже был в content/services.ts, но не рендерился */}
            <ServiceAboutSection service={service} />
            <ServiceUseCasesSection service={service} />
          </>
        }
        trust={<TrackSaleFaqSection />}
        promise={
          <>
            <TrackSaleOrderingSection />
            <TrackSaleTermsSection />
          </>
        }
        reviews={<AvitoReviewsSection filter="light" />}
        action={<ServiceActionSection service={service} />}
        related={<ServiceRelatedServices service={service} />}
      />
    </>
  );
}
