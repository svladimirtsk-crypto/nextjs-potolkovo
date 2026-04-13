import type { Metadata } from "next";

import { getRequiredServicePageBySlug } from "@/content/services";
import { ServicePageLayoutV2 } from "../_components/ServicePageLayoutV2";
import { ServiceHero } from "../_components/ServiceHero";
import { ServiceActionSection } from "../_components/ServiceActionSection";
import { ServiceRelatedServices } from "../_components/ServiceRelatedServices";
import { LightKitShowcase } from "./_components/LightKitShowcase";
import { LightCustomSection } from "./_components/LightCustomSection";
import { TrackSaleFaqSection } from "./_components/TrackSaleFaqSection";
import { TrackSaleOrderingSection } from "./_components/TrackSaleOrderingSection";

const service = getRequiredServicePageBySlug(
  "prodazha-trekovogo-osveshcheniya"
);

export const metadata: Metadata = {
  title: service.metadata.title,
  description: service.metadata.description,
  keywords: service.metadata.keywords,
  alternates: { canonical: service.metadata.canonicalPath },
  openGraph: {
    title: service.metadata.ogTitle,
    description: service.metadata.ogDescription,
    url: service.pathname,
    images: [{ url: service.metadata.ogImage }],
  },
};

export default function ProdazhaTrekovogoOsveshcheniyaPage() {
  return (
    <ServicePageLayoutV2
      service={service}
      hero={<ServiceHero service={service} />}
      proof={<LightKitShowcase />}
      price={<LightCustomSection />}
      trust={<TrackSaleFaqSection />}
      promise={<TrackSaleOrderingSection />}
      action={<ServiceActionSection service={service} />}
      related={<ServiceRelatedServices service={service} />}
    />
  );
}
