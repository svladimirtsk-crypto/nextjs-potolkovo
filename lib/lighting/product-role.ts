import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

type ProductIdentity = Pick<FeedCatalogProduct, "name" | "vendorCode"> & Partial<Pick<FeedCatalogProduct, "offerId" | "kind">>;
export type NonLuminaireRole = "track-control" | "fixture-accessory";

/** Owner-confirmed roles, 15.10.2026. No electrical/pairing compatibility is implied. */
const ACCESSORY_CODES = new Set([
  "ЦБ-00010285", "ЦБ-00010286", "ЦБ-00010287", // reflectors
  "ЦБ-00010705", "ЦБ-00010706", "УУ-00007943", "УУ-00007941", // surface ART mounts and current aliases
  "0У-00004814", "0У-00004815", // surface suspensions
]);
const ACCESSORY_OFFERS = new Set(["1076", "1077", "1078", "1246", "1247", "3031", "3032"]);
const TRACK_CONTROL_CODES = new Set(["0У-00002005", "0У-00002099", "0У-00002100", "0У-00002331", "0У-00002332"]);

export function nonLuminaireRole(product: ProductIdentity): NonLuminaireRole | null {
  const name = String(product.name ?? "").toLowerCase().replaceAll("ё", "е");
  if (product.kind === "FIXTURE_ACCESSORY" || ACCESSORY_CODES.has(product.vendorCode)
    || ACCESSORY_OFFERS.has(product.offerId ?? "") || /^отражател/.test(name)
    || /^крепление арт накладное круглое поворотное/.test(name) || /^подвес накладной/.test(name)) return "fixture-accessory";
  if (product.kind === "TRACK_CONTROL" || TRACK_CONTROL_CODES.has(product.vendorCode)
    || (/(колибри|colibri|кларус|clarus)/.test(name) && /(конвертер|панель управления|пульт|шлюз)/.test(name))) return "track-control";
  return null;
}
