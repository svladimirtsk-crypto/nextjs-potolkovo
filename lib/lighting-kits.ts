// lib/lighting-kits.ts

import type { LightingItem } from "@/lib/calculator-modal-types";

export type LightingKit = {
  kitId: string;
  kitBaseName: string;
  kitCategory: "track-built-in" | "track-surface" | "point";
  defaultSpotsQty: number;
  spotsItemSku: string;
  items: readonly LightingItem[];
  totalRub: number;
};

// ─── Профили: таблица SKU → длина (мм) и цена ────────────────────────────────

export type ProfileLength = 1000 | 2000 | 3000;

export type ProfileEntry = {
  sku: string;
  lengthMm: ProfileLength;
  priceRub: number;
};

/**
 * Все доступные профили COLIBRI 220V по длине.
 * Используется для подбора набора профилей под заданную длину трека.
 */
export const COLIBRI_PROFILES: readonly ProfileEntry[] = [
  { sku: "colibri-profile-220v-1000", lengthMm: 1000, priceRub: 3900 },
  { sku: "colibri-profile-220v-2000", lengthMm: 2000, priceRub: 7400 },
  { sku: "colibri-profile-220v-3000", lengthMm: 3000, priceRub: 10500 },
];

/**
 * Все доступные профили CLARUS 48V по длине.
 */
export const CLARUS_PROFILES: readonly ProfileEntry[] = [
  { sku: "clarus-profile-48v-1000", lengthMm: 1000, priceRub: 4200 },
  { sku: "clarus-profile-48v-2000", lengthMm: 2000, priceRub: 8000 },
  { sku: "clarus-profile-48v-3000", lengthMm: 3000, priceRub: 11500 },
];

// ─── Утилиты для набора профилей ─────────────────────────────────────────────

export type ProfilePiece = {
  sku: string;
  lengthMm: ProfileLength;
  priceRub: number;
  qty: number;
  /** Отображаемое название для итога */
  name: string;
};

/**
 * Подбирает минимальный набор профилей для заданной длины трека (в мм).
 *
 * Алгоритм: жадный подбор от большего к меньшему.
 * Пример: 5000 мм → [3000×1, 2000×1] = 5000 мм (точно).
 * Если точного набора нет — округляем вверх до ближайшего перекрытия.
 *
 * @param trackLengthMm - длина трека в мм
 * @param profiles - доступные профили (отсортированы по убыванию длины)
 */
export function calcProfilesForTrackLength(
  trackLengthMm: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  if (trackLengthMm <= 0 || profiles.length === 0) return [];

  // Сортируем по убыванию длины для жадного алгоритма
  const sorted = [...profiles].sort((a, b) => b.lengthMm - a.lengthMm);

  const result: Map<string, ProfilePiece> = new Map();
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

  // Если остаток > 0 — добавляем наименьший профиль чтобы перекрыть
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

/**
 * Конвертирует метры трека (из Step 0 калькулятора) в миллиметры
 * и возвращает набор профилей для отображения пользователю.
 */
export function calcProfilesForTrackMeters(
  trackLengthMeters: number,
  profiles: readonly ProfileEntry[]
): ProfilePiece[] {
  const mm = Math.round(trackLengthMeters * 1000);
  return calcProfilesForTrackLength(mm, profiles);
}

/**
 * Суммарная стоимость набора профилей.
 */
export function calcProfilesTotalRub(pieces: ProfilePiece[]): number {
  return pieces.reduce((sum, p) => sum + p.qty * p.priceRub, 0);
}

/**
 * Возвращает человекочитаемое описание набора профилей.
 * Пример: "2 × 2000 мм + 1 × 1000 мм = 5000 мм"
 */
export function formatProfilePieces(pieces: ProfilePiece[]): string {
  if (pieces.length === 0) return "";
  const parts = pieces.map((p) => `${p.qty} × ${p.lengthMm} мм`);
  const totalMm = pieces.reduce((sum, p) => sum + p.qty * p.lengthMm, 0);
  return `${parts.join(" + ")} = ${totalMm} мм`;
}

// ─── Lighting Kits ────────────────────────────────────────────────────────────

export const LIGHTING_KITS: readonly LightingKit[] = [
  // ── Встроенные треки (COLIBRI / CLARUS) — используем 2000 мм как дефолт ──
  {
    kitId: "colibri-start-5",
    kitBaseName: "Старт COLIBRI 220V",
    kitCategory: "track-built-in",
    defaultSpotsQty: 5,
    spotsItemSku: "colibri-london-10w",
    items: [
      {
        sku: "colibri-profile-220v-2000",
        name: "Профиль COLIBRI 220V 2000 мм",
        qty: 1,
        priceRub: 7400,
      },
      {
        sku: "colibri-london-10w",
        name: "COLIBRI LONDON 10W",
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
    items: [
      {
        sku: "clarus-profile-48v-2000",
        name: "Профиль CLARUS 48V 2000 мм",
        qty: 1,
        priceRub: 8000,
      },
      {
        sku: "clarus-psu-48v",
        name: "Блок питания CLARUS",
        qty: 1,
        priceRub: 1530,
      },
      {
        sku: "clarus-spot-12w-4000k",
        name: "CLARUS SPOT 12W",
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
    items: [
      {
        sku: "colibri-profile-220v-2000",
        name: "Профиль COLIBRI 220V 2000 мм",
        qty: 2,
        priceRub: 7400,
      },
      {
        sku: "colibri-rio-12w",
        name: "COLIBRI RIO 12W",
        qty: 8,
        priceRub: 3080,
      },
    ],
    totalRub: 2 * 7400 + 8 * 3080,
  },

  // ── Накладные треки (ART 220V) ────────────────────────────────────────────
  {
    kitId: "art-start-surface-4",
    kitBaseName: "Накладной ART START",
    kitCategory: "track-surface",
    defaultSpotsQty: 4,
    spotsItemSku: "art-start-30w",
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

  // ── Точечные светильники (GX53 / MR16) ───────────────────────────────────
  {
    kitId: "gx53-optima-6",
    kitBaseName: "Точечный GX53 OPTIMA",
    kitCategory: "point",
    defaultSpotsQty: 6,
    spotsItemSku: "gx53-optima",
    items: [
      {
        sku: "gx53-optima",
        name: "GX53 OPTIMA",
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
    items: [
      {
        sku: "mr16-zoom-circle",
        name: "MR16 ZOOM круг",
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
