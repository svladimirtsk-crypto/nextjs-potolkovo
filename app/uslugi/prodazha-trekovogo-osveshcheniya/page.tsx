import type { Metadata } from "next";

import { getRequiredServicePageBySlug } from "@/content/services";
import type { IntentMode } from "./_components/TrackSaleIntentContext";
import { TrackSaleIntentProvider } from "./_components/TrackSaleIntentContext";
import { ServicePageLayoutV2 } from "../_components/ServicePageLayoutV2";
import { ServiceHero } from "../_components/ServiceHero";
import { ServiceRelatedServices } from "../_components/ServiceRelatedServices";
import { TrackSaleIntentSwitch } from "./_components/TrackSaleIntentSwitch";
import { TrackSaleDiscountSection } from "./_components/TrackSaleDiscountSection";
import { TrackSaleCatalogSection } from "./_components/TrackSaleCatalogSection";
import { TrackSaleFaqSection } from "./_components/TrackSaleFaqSection";
import { TrackSaleOrderingSection } from "./_components/TrackSaleOrderingSection";
import { TrackSaleActionSection } from "./_components/TrackSaleActionSection";

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

type PageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function ProdazhaTrekovogoOsveshcheniyaPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const initialMode: IntentMode =
    params.mode === "buy" ? "buy" : "install";

  return (
    <TrackSaleIntentProvider initialMode={initialMode}>
      <ServicePageLayoutV2
        service={service}
        hero={<ServiceHero service={service} />}
        proof={
          <>
            <TrackSaleIntentSwitch />
            <TrackSaleDiscountSection />
          </>
        }
        price={
          <TrackSaleCatalogSection
            preset={service.price.calculatorPreset}
            sectionTitle={service.price.sectionTitle}
            sectionIntro={service.price.sectionIntro}
          />
        }
        trust={<TrackSaleFaqSection />}
        promise={<TrackSaleOrderingSection />}
        action={<TrackSaleActionSection service={service} />}
        related={<ServiceRelatedServices service={service} />}
      />
    </TrackSaleIntentProvider>
  );
}
