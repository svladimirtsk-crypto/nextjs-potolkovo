import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { HomePage } from "@/components/home/home-page";
import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import { buildHomeServiceSchema } from "@/lib/seo-schema";

const ogAsset = homepage.metadata.ogImageAssetKey
  ? homeAssets.find((asset) => asset.assetKey === homepage.metadata.ogImageAssetKey)
  : null;

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
    images: [
      {
        url: homepage.metadata.ogImageSrc,
        width: homepage.metadata.ogImageWidth,
        height: homepage.metadata.ogImageHeight,
        alt: ogAsset?.alt ?? homepage.metadata.title,
      },
    ],
  },
};

export default function Page() {
  return (
    <>
      <JsonLd data={buildHomeServiceSchema()} />
      <HomePage />
    </>
  );
}
