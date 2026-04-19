// lib/lighting-kits.ts
import type { LightingItem } from "@/lib/calculator-modal-types";
import { scaleKitItemQty } from "@/lib/lighting-formulas";

export type LightingKit = {
  kitId: string;
  kitBaseName: string;
  kitCategory: "track-built-in" | "track-surface" | "point";
  defaultSpotsQty: number;
  spotsItemSku: string;
  scaleGroup: readonly string[];
  items: readonly LightingItem[];
  totalRub: number;
};

export type ProfileLength = 1000 | 2000 | 3000;

export type ProfileEntry = {
  sku: string;
  lengthMm: ProfileLength;
  priceRub: number | null;
};

export const COLIBRI_PROFILES: readonly ProfileEntry[] = [
  { sku: "colibri-profile-220v-1000", lengthMm: 1000, priceRub: 3900 },
  { sku: "colibri-profile-220v-2000", lengthMm: 2000, priceRub: 7400 },
  { sku: "colibri-profile-220v-3000", lengthMm: 3000, priceRub: 10500 },
];

export const CLARUS_PROFILES: readonly ProfileEntry[] = [
  { sku: "clarus-profile-48v-1000", lengthMm: 1000, priceRub: 4200 },
  { sku: "clarus-profile-48v-2000", lengthMm: 2000, priceRub: 8000 },
  { sku: "clarus-profile-48v-3000", lengthMm: 3000, priceRub: 11500 },
];

export type ProfilePiece = {
  sku: string;
  lengthMm: ProfileLength;
  priceRub: number | null;
  qty: number;
  name: string;
};

export function calcProfilesForTrackLength(
  trackLengthMm: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  if (trackLengthMm <= 0 || profiles.length === 0) return [];

  const sorted = [...profiles].sort((a, b) => b.lengthMm - a.lengthMm);
  const result = new Map<string, ProfilePiece>();
  let remaining = trackLengthMm;

  for (const profile of sorted) {
    if (remaining <= 0) break;
    const count = Math.floor(remaining / profile.lengthMm);
    if (count > 0) {
      result.set(profile.sku, {
        sku: profile.sku,
        lengthMm: profile.lengthMm,
        priceRub: profile.priceRub,
        qty: count,
        name: `Профиль ${profile.lengthMm} мм`,
      });
      remaining -= count * profile.lengthMm;
    }
  }

  if (remaining > 0) {
    const smallest = sorted[sorted.length - 1];
    const existing = result.get(smallest.sku);
    if (existing) {
      result.set(smallest.sku, { ...existing, qty: existing.qty + 1 });
    } else {
      result.set(smallest.sku, {
        sku: smallest.sku,
        lengthMm: smallest.lengthMm,
        priceRub: smallest.priceRub,
        qty: 1,
        name: `Профиль ${smallest.lengthMm} мм`,
      });
    }
  }

  return Array.from(result.values());
}

export function calcProfilesForTrackMeters(
  trackLengthMeters: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  return calcProfilesForTrackLength(Math.round(trackLengthMeters * 1000), profiles);
}

export function calcProfilesTotalRub(pieces: ProfilePiece[]): number | null {
  for (const p of pieces) {
    if (p.priceRub === null) return null;
  }
  return pieces.reduce((sum, p) => sum + p.qty * (p.priceRub as number), 0);
}

export function formatProfilePieces(pieces: ProfilePiece[]): string {
  if (pieces.length === 0) return "";
  const parts = pieces.map((p) => `${p.qty} × ${p.lengthMm} мм`);
  const totalMm = pieces.reduce((sum, p) => sum + p.qty * p.lengthMm, 0);
  return `${parts.join(" + ")} = ${totalMm} мм`;
}

export function scaleKit(
  kit: LightingKit,
  targetQty: number
): { items: LightingItem[]; totalRub: number; scaledSpotsQty: number } {
  const effectiveTarget = targetQty > 0 ? targetQty : kit.defaultSpotsQty;
  const scaleSet = new Set(kit.scaleGroup);

  const items: LightingItem[] = kit.items.map((item) => {
    if (scaleSet.has(item.sku)) {
      return {
        ...item,
        qty: scaleKitItemQty(item.qty, kit.defaultSpotsQty, effectiveTarget),
      };
    }
    return { ...item };
  });

  const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
  const scaledSpotsQty =
    items.find((i) => i.sku === kit.spotsItemSku)?.qty ?? effectiveTarget;

  return { items, totalRub, scaledSpotsQty };
}

export const LIGHTING_KITS: readonly LightingKit[] = [
  {
    kitId: "colibri-start-5",
    kitBaseName: "Старт COLIBRI 220V",
    kitCategory: "track-built-in",
    defaultSpotsQty: 5,
    spotsItemSku: "colibri-london-10w",
    scaleGroup: ["colibri-london-10w"],
    items: [
      {
        sku: "colibri-profile-220v-2000",
        name: "Профиль COLIBRI 220V 2000 мм",
        qty: 1,
        priceRub: 7400,
      },
      {
        sku: "colibri-london-10w",
        name: "COLIBRI LONDON 10W 4000K",
        qty: 5,
        priceRub: 1540,
      },
    ],
    totalRub: 7400 + 5 * 1540,
  },
  {
    kitId: "clarus-start-5",
    kitBaseName: "Старт CLARUS 48V",
    kitCategory: "track-built-in",
    defaultSpotsQty: 5,
    spotsItemSku: "clarus-spot-12w-4000k",
    scaleGroup: ["clarus-spot-12w-4000k"],
    items: [
      {
        sku: "clarus-profile-48v-2000",
        name: "Профиль CLARUS 48V 2000 мм",
        qty: 1,
        priceRub: 8000,
      },
      {
        sku: "clarus-psu-48v",
        name: "Блок питания CLARUS 48V",
        qty: 1,
        priceRub: 1530,
      },
      {
        sku: "clarus-spot-12w-4000k",
        name: "CLARUS SPOT 12W 4000K",
        qty: 5,
        priceRub: 3520,
      },
    ],
    totalRub: 8000 + 1530 + 5 * 3520,
  },
  {
    kitId: "colibri-rio-8",
    kitBaseName: "Комфорт COLIBRI RIO",
    kitCategory: "track-built-in",
    defaultSpotsQty: 8,
    spotsItemSku: "colibri-rio-12w",
    scaleGroup: ["colibri-rio-12w"],
    items: [
      {
        sku: "colibri-profile-220v-2000",
        name: "Профиль COLIBRI 220V 2000 мм",
        qty: 2,
        priceRub: 7400,
      },
      {
        sku: "colibri-rio-12w",
        name: "COLIBRI RIO 12W 4000K",
        qty: 8,
        priceRub: 3080,
      },
    ],
    totalRub: 2 * 7400 + 8 * 3080,
  },
  {
    kitId: "art-start-surface-4",
    kitBaseName: "Накладной ART START",
    kitCategory: "track-surface",
    defaultSpotsQty: 4,
    spotsItemSku: "art-start-30w",
    scaleGroup: ["art-start-30w"],
    items: [
      {
        sku: "art-start-30w",
        name: "ART START 30W 4000K",
        qty: 4,
        priceRub: 2090,
      },
    ],
    totalRub: 4 * 2090,
  },
  {
    kitId: "art-monolit-surface-4",
    kitBaseName: "Накладной ART MONOLIT",
    kitCategory: "track-surface",
    defaultSpotsQty: 4,
    spotsItemSku: "art-monolit-30w",
    scaleGroup: ["art-monolit-30w"],
    items: [
      {
        sku: "art-monolit-30w",
        name: "ART MONOLIT 30W 4000K",
        qty: 4,
        priceRub: 2530,
      },
    ],
    totalRub: 4 * 2530,
  },
  {
    kitId: "gx53-optima-6",
    kitBaseName: "Точечный GX53 OPTIMA",
    kitCategory: "point",
    defaultSpotsQty: 6,
    spotsItemSku: "gx53-optima",
    scaleGroup: ["gx53-optima", "gx53-lamp-8w-4200k"],
    items: [
      {
        sku: "gx53-optima",
        name: "GX53 OPTIMA (корпус)",
        qty: 6,
        priceRub: 130,
      },
      {
        sku: "gx53-lamp-8w-4200k",
        name: "Лампа GX53 8W 4200K",
        qty: 6,
        priceRub: 114,
      },
    ],
    totalRub: 6 * (130 + 114),
  },
  {
    kitId: "mr16-zoom-6",
    kitBaseName: "Точечный MR16 ZOOM",
    kitCategory: "point",
    defaultSpotsQty: 6,
    spotsItemSku: "mr16-zoom-circle",
    scaleGroup: ["mr16-zoom-circle", "mr16-module-7w-4200k"],
    items: [
      {
        sku: "mr16-zoom-circle",
        name: "MR16 ZOOM круг (корпус)",
        qty: 6,
        priceRub: 260,
      },
      {
        sku: "mr16-module-7w-4200k",
        name: "Модуль MR16 7W 4200K",
        qty: 6,
        priceRub: 174,
      },
    ],
    totalRub: 6 * (260 + 174),
  },
];
