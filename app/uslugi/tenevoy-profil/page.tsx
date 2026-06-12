import type { Metadata } from "next";
import { getRequiredServicePageBySlug } from "@/content/services";
import { ServicePageLayoutV2 } from "../_components/ServicePageLayoutV2";
import { ServiceActionSection } from "../_components/ServiceActionSection";
import { ServiceCompareSection } from "../_components/ServiceCompareSection";
import { ServiceHero } from "../_components/ServiceHero";
import { AvitoReviewsSection } from "@/components/home/avito-reviews-section";
import { ServicePriceSection } from "../_components/ServicePriceSection";
import { ServicePromiseSection } from "../_components/ServicePromiseSection";
import { ServiceProofStrip } from "../_components/ServiceProofStrip";
import { ServiceRelatedServices } from "../_components/ServiceRelatedServices";
import { ServiceTrustSection } from "../_components/ServiceTrustSection";

const service = getRequiredServicePageBySlug("tenevoy-profil");

export const metadata: Metadata = {
  title: service.metadata.title,
  description: service.metadata.description,
  keywords: service.metadata.keywords,
  alternates: {
    canonical: service.metadata.canonicalPath,
  },
  openGraph: {
    title: service.metadata.ogTitle,
    description: service.metadata.ogDescription,
    url: service.pathname,
    images: [
      {
        url: service.metadata.ogImage,
      },
    ],
  },
};

export default function TenevoyProfilPage() {
  return (
    <ServicePageLayoutV2
      service={service}
      hero={<ServiceHero service={service} />}
      proof={<ServiceProofStrip service={service} />}
      price={<ServicePriceSection service={service} />}
      compare={<ServiceCompareSection />}
      trust={<ServiceTrustSection service={service} />}
      promise={<ServicePromiseSection service={service} />}
      reviews={<AvitoReviewsSection />}
      related={<ServiceRelatedServices service={service} />}
      action={<ServiceActionSection service={service} />}
    />
  );
}
