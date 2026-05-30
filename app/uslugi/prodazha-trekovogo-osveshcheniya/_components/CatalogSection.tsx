import { getCatalogData } from "@/lib/eks-feed2-catalog";
import { CatalogSectionClient } from "./CatalogSectionClient";
import { REMOVED_COLIBRI_VENDOR_CODES } from "@/lib/catalog-ui-config";

export async function CatalogSection() {
  const data = await getCatalogData();

  const filteredProducts = (data.products ?? []).filter((product) => {
    const vendorCode = String(product.vendorCode ?? "");
    return !REMOVED_COLIBRI_VENDOR_CODES.has(vendorCode);
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
