import { getCatalogData } from "@/lib/eks-feed2-catalog";
import { CatalogSectionClient } from "./CatalogSectionClient";
import { isRemovedColibriVendorCode } from "@/lib/catalog-ui-config";

export async function CatalogSection() {
  const data = await getCatalogData();

  const filteredProducts = (data.products ?? []).filter((product) => {
    return !isRemovedColibriVendorCode(product.vendorCode);
  });

  return (
    <CatalogSectionClient
      data={{
        ...data,
        products: filteredProducts,
      }}
    />
  );
}
