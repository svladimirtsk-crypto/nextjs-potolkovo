import type { Metadata } from "next";

import { HomePage } from "@/components/home/home-page";
import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";

const ogAsset = homepage.metadata.ogImageAssetKey
  ? homeAssets.find((asset) => asset.assetKey === homepage.metadata.ogImageAssetKey)
  : null;

export const metadata: Metadata = {
  title: homepage.metadata.title,
  description: homepage.metadata.description,
  alternates: {
    canonical: homepage.metadata.canonicalPath,
  },
  robots: homepage.metadata.robots,
  openGraph: {
    title: homepage.metadata.ogTitle ?? homepage.metadata.title,
    description: homepage.metadata.ogDescription ?? homepage.metadata.description,
    url: homepage.metadata.canonicalPath,
    images: ogAsset
      ? [
          {
            url: ogAsset.src,
            width: ogAsset.width,
            height: ogAsset.height,
            alt: ogAsset.alt,
          },
        ]
      : undefined,
  },
};

export default function Page() {
  return <HomePage />;
}
