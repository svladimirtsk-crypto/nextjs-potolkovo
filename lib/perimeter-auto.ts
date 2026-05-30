import { PROFILE_PERIMETER_AUTO_RATIO } from "@/lib/catalog-ui-config";

export type CeilingTypeSlug = "standard" | "shadow" | "floating";

export function isPerimeterProfileCeilingType(slug: unknown): boolean {
  const value = String(slug ?? "").trim();
  return value === "shadow" || value === "floating";
}

export function getPerimeterAutoValueByArea(area: unknown): number {
  const safeArea = Number(area ?? 0);
  if (!Number.isFinite(safeArea) || safeArea <= 0) return 0;

  const raw = safeArea * PROFILE_PERIMETER_AUTO_RATIO;
  return Math.max(0, Math.round(raw));
}
