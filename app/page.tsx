import { brandSocialImage } from "@/content/brand-social";
import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { HomePage } from "@/components/home/home-page";
import { homepage } from "@/content/homepage";
import { buildHomeServiceSchema } from "@/lib/seo-schema";

export const metadata: Metadata = {
  title: { absolute: homepage.metadata.title },
  description: homepage.metadata.description,
  alternates: {
    canonical: homepage.metadata.canonicalPath,
  },
  robots: homepage.metadata.robots,
  openGraph: {
    title: homepage.metadata.ogTitle ?? homepage.metadata.title,
    description: homepage.metadata.ogDescription ?? homepage.metadata.description,
    url: homepage.metadata.canonicalPath,
    /**
     * N-062: первым идёт кадр 1200×630 — соцсети берут первую подходящую
     * картинку, и обрезать её им уже не придётся.
     */
    images: [brandSocialImage("/")],
  },
  twitter: { card: "summary_large_image", title: homepage.metadata.ogTitle ?? homepage.metadata.title, description: homepage.metadata.ogDescription ?? homepage.metadata.description, images: [brandSocialImage("/")] },
};

export default function Page() {
  return (
    <>
      <JsonLd data={buildHomeServiceSchema()} />
      <HomePage />
    </>
  );
}
