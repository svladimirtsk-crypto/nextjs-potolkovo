import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { getRequiredServicePageBySlug } from "@/content/services";
import { buildFaqSchema } from "@/lib/seo-schema";
import { ServicePageLayoutV2 } from "../_components/ServicePageLayoutV2";
import { ServiceHero } from "../_components/ServiceHero";
import { getKitsPriceAnchorRub } from "./_components/LightKitShowcase";
import { formatRub } from "@/content/pricing";
import { ServiceActionSection } from "../_components/ServiceActionSection";
import { ServiceRelatedServices } from "../_components/ServiceRelatedServices";
import { LightKitShowcase } from "./_components/LightKitShowcase";
import { CatalogSection } from "./_components/CatalogSection";
import { TrackSaleSystemGuideSection } from "./_components/TrackSaleSystemGuideSection";
import { TrackSaleFaqSection, trackSaleFaqItems } from "./_components/TrackSaleFaqSection";
import { TrackSaleOrderingSection } from "./_components/TrackSaleOrderingSection";
import { TrackSaleTermsSection } from "./_components/TrackSaleTermsSection";
import { ServiceAboutSection } from "../_components/ServiceAboutSection";
import { ServiceUseCasesSection } from "../_components/ServiceUseCasesSection";

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
  const kitsPriceBadge = kitsAnchorRub ? `от ${formatRub(kitsAnchorRub)}` : undefined;

  return (
    <>
      <JsonLd data={buildFaqSchema(trackSaleFaqItems)} />
      <ServicePageLayoutV2
        service={service}
        hero={<ServiceHero service={service} priceBadgeOverride={kitsPriceBadge} />}
        proof={<LightKitShowcase />}
        price={
          <>
            <CatalogSection />
            <TrackSaleSystemGuideSection />
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
        action={<ServiceActionSection service={service} />}
        related={<ServiceRelatedServices service={service} />}
      />
    </>
  );
}
