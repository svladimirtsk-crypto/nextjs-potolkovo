// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSection.tsx
import { getCatalogData } from "@/lib/eks-feed2-catalog";
import { CatalogSectionClient } from "./CatalogSectionClient";

export async function CatalogSection() {
  const data = await getCatalogData();
  return <CatalogSectionClient data={data} />;
}
