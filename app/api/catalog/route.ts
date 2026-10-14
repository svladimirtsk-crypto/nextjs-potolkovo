import { isRetiredCatalogProduct } from "@/lib/catalog-retirement";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { NextResponse } from "next/server";

import { getCatalogData } from "@/lib/eks-feed2-catalog";

export const runtime = "nodejs";

export async function GET() {
  const raw = await getCatalogData();
  const data = { ...raw, products: raw.products.filter(p => !isRetiredCatalogProduct(p)).map(applyVendorOverrides) };

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
