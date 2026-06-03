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

const ART_NO_LAMP_FIXTURE_VENDORS = new Set(["0У-00006476", "0У-00006475", "0У-00006358"]);

// Расширяем whitelist профилей ART, чтобы совпадало с catalog-ui-config.ts + добавленные вами артикулы
export const ART_TRACK_PROFILE_VENDOR_WHITELIST = [
  "0У-00006342",
  "0У-00006341",
  "0У-00001613",
  "0У-00001356",
  "0У-00001355",
  "0У-00001354",
  "0У-00001353",
  "0У-00001341",
  "0У-00001342",
] as const;

const ART_PROFILE_VENDORS = new Set<string>(ART_TRACK_PROFILE_VENDOR_WHITELIST);

const COLIBRI_PROFILE_VENDORS = new Set<string>([
  "0У-00006089",
  "0У-00006090",
  "0У-00006986",
]);

const CLARUS_PROFILE_VENDORS = new Set<string>(["0У-00006633", "0У-00006634"]);

const COLIBRI_ACCESSORY_PANELS = new Set(["0У-00002099", "0У-00002100"]);

const TRACK_PROFILE_PIECE_LENGTH_METERS: Record<string, number> = {
  // COLIBRI profiles
  "0У-00006089": 1,
  "0У-00006090": 2,
  "0У-00006986": 3,

  // CLARUS profiles
  "0У-00006633": 1,
  "0У-00006634": 2,

  // ART profiles
  "0У-00001353": 1,
  "0У-00001354": 1,
  "0У-00001355": 2,
  "0У-00001356": 2,
  "0У-00001341": 3,
  "0У-00001342": 3,
};

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * Единое место, где мы “чиним” грязную разметку в snapshot по vendorCode.
 * Задача: чтобы каталог был полным и предсказуемым.
 */
export function applyVendorOverrides(product: FeedCatalogProduct): FeedCatalogProduct {
  const vendorCode = toText(product.vendorCode);
  if (!vendorCode) return product;

  let next: FeedCatalogProduct = product;

  // COLIBRI: эти две панели должны быть в аксессуарах
  if (COLIBRI_ACCESSORY_PANELS.has(vendorCode)) {
    next = {
      ...next,
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
    next = {
      ...next,
      system: "TRACK_220" as System,
      kind: "TRACK_FIXTURE" as Kind,
    };
  }

  // TRACK PROFILES: принудительно классифицируем профили по известным vendorCode
  if (COLIBRI_PROFILE_VENDORS.has(vendorCode)) {
    next = {
      ...next,
      system: "COLIBRI_220" as System,
      kind: "TRACK_PROFILE" as Kind,
    };
  }

  if (CLARUS_PROFILE_VENDORS.has(vendorCode)) {
    next = {
      ...next,
      system: "CLARUS_48" as System,
      kind: "TRACK_PROFILE" as Kind,
    };
  }

  // ART: профиль/шинопровод
  if (ART_PROFILE_VENDORS.has(vendorCode)) {
    next = {
      ...next,
      system: "TRACK_220" as System,
      kind: "TRACK_PROFILE" as Kind,
    };
  }

  // Длина профиля (м на 1 шт) — чтобы корректно считались погонные метры трека
  const pieceMeters = TRACK_PROFILE_PIECE_LENGTH_METERS[vendorCode];
  if (pieceMeters && pieceMeters > 0) {
    const hasPiece = typeof next.pieceLengthMeters === "number" && next.pieceLengthMeters > 0;
    const hasLen = typeof next.lengthMeters === "number" && next.lengthMeters > 0;

    if (!hasPiece && !hasLen && next.unit !== "m") {
      next = {
        ...next,
        pieceLengthMeters: pieceMeters,
      };
    }
  }

  return next;
}
