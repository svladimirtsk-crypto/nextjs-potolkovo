import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

type System = FeedCatalogProduct["system"];
type Kind = FeedCatalogProduct["kind"];

const ART_GX53_FIXTURE_VENDORS = new Set([
  "0У-00006334",
  "0У-00006333",
  "0У-00006332",
  "0У-00006331",
  "0У-00006330",
  "0У-00006329",
]);

const ART_MR16_FIXTURE_VENDORS = new Set([
  "0У-00006324",
  "0У-00006325",
  "0У-00006326",
  "0У-00006327",
  "0У-00006328",
]);

const ART_NO_LAMP_FIXTURE_VENDORS = new Set([
  "0У-00006476",
  "0У-00006475",
  "0У-00006358",
]);

export const ART_TRACK_PROFILE_VENDOR_WHITELIST = [
  "0У-00006342",
  "0У-00006341",
  "0У-00001356",
  "0У-00001355",
  "0У-00001354",
  "0У-00001353",
] as const;

const ART_PROFILE_VENDORS = new Set<string>(ART_TRACK_PROFILE_VENDOR_WHITELIST);

const COLIBRI_ACCESSORY_PANELS = new Set([
  "0У-00002099",
  "0У-00002100",
]);

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Единое место, где мы “чинем” грязную разметку в snapshot по vendorCode.
 * Задача: чтобы каталог был полным и предсказуемым.
 */
export function applyVendorOverrides(product: FeedCatalogProduct): FeedCatalogProduct {
  const vendorCode = toText(product.vendorCode);
  if (!vendorCode) return product;

  // COLIBRI: эти две панели должны быть в аксессуарах
  if (COLIBRI_ACCESSORY_PANELS.has(vendorCode)) {
    return {
      ...product,
      system: "COLIBRI_220" as System,
      kind: "TRACK_ACCESSORY" as Kind,
    };
  }

  // ART: светильники
  if (
    ART_GX53_FIXTURE_VENDORS.has(vendorCode) ||
    ART_MR16_FIXTURE_VENDORS.has(vendorCode) ||
    ART_NO_LAMP_FIXTURE_VENDORS.has(vendorCode)
  ) {
    return {
      ...product,
      system: "TRACK_220" as System,
      kind: "TRACK_FIXTURE" as Kind,
    };
  }

  // ART: профиль/шинопровод
  if (ART_PROFILE_VENDORS.has(vendorCode)) {
    return {
      ...product,
      system: "TRACK_220" as System,
      kind: "TRACK_PROFILE" as Kind,
    };
  }

  return product;
}
