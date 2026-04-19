// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSection.tsx
import { getFeed2Catalog } from "@/lib/eks-feed2-catalog";
import { CatalogSectionClient } from "./CatalogSectionClient";

export async function CatalogSection() {
  const data = await getFeed2Catalog();
  return <CatalogSectionClient data={data} />;
}
