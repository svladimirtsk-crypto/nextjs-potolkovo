/**
 * T-044 · «От X ₽/м с светильниками» для карточек трековых систем.
 *
 * Считаем из фида, а не хардкодом: самый дешёвый профиль в пересчёте на метр
 * плюс самый дешёвый светильник этой системы. Так цифра не разъезжается с
 * прайсом поставщика, а посетитель видит честный порог входа.
 */
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";
import { inferPieceLengthMeters } from "@/lib/product-length-meters";

export type SystemEntryPrice = {
  /** Профиль (1 м) + один светильник, ₽. */
  perMeterWithFixtureRub: number;
  profilePerMeterRub: number;
  fixtureRub: number;
};

function perMeterPrice(product: FeedCatalogProduct): number | null {
  const price = toNumber(product.priceRub);
  if (price <= 0) return null;
  if (product.unit === "m") return price;

  const meters = toNumber(inferPieceLengthMeters(product));
  if (meters <= 0) return null;
  return price / meters;
}

export function calcSystemEntryPrice(
  system: string,
  products: readonly FeedCatalogProduct[]
): SystemEntryPrice | null {
  let profilePerMeter = Number.POSITIVE_INFINITY;
  let fixture = Number.POSITIVE_INFINITY;

  for (const product of products) {
    if (toText(product.system) !== system) continue;

    if (product.kind === "TRACK_PROFILE") {
      const value = perMeterPrice(product);
      if (value !== null && value < profilePerMeter) profilePerMeter = value;
    } else if (product.kind === "TRACK_FIXTURE") {
      const price = toNumber(product.priceRub);
      if (price > 0 && price < fixture) fixture = price;
    }
  }

  if (!Number.isFinite(profilePerMeter) || !Number.isFinite(fixture)) return null;

  return {
    profilePerMeterRub: Math.round(profilePerMeter),
    fixtureRub: Math.round(fixture),
    perMeterWithFixtureRub: Math.round(profilePerMeter + fixture),
  };
}
