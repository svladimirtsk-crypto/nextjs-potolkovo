import type { Metadata } from "next";
import ServicePageLayout from "../_components/ServicePageLayout";
import { getServiceBySlug, getOtherServices } from "@/lib/data";

const service = getServiceBySlug("svetoprozrachnye-potolki")!;

export const metadata: Metadata = {
  title: service.metaTitle,
  description: service.metaDescription,
  keywords: service.metaKeywords,
};

export default function Page() {
  return (
    <ServicePageLayout
      breadcrumb={service.breadcrumb}
      badge={service.badge}
      h1={service.h1}
      h1sub={service.h1sub}
      description={service.heroDescription}
      ctaText={service.ctaText}
      price={service.price}
      image={service.image}
      imageAlt={service.imageAlt}
      sectionTitle={service.sectionTitle}
      sectionParagraphs={service.sectionParagraphs}
      whereTitle={service.whereTitle}
      whereParagraphs={service.whereParagraphs}
      advantagesTitle={service.advantagesTitle}
      advantages={service.advantages}
      otherServices={getOtherServices("svetoprozrachnye-potolki")}
    />
  );
}
