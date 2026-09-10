import { NextResponse } from "next/server";

import { getCatalogData } from "@/lib/eks-feed2-catalog";

export const runtime = "nodejs";

export async function GET() {
  const data = await getCatalogData();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
    },
  });
}
