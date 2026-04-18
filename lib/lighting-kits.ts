// lib/lighting-kits.ts

import type { LightingItem } from "@/lib/calculator-modal-types";

export type LightingKit = {
  kitId: string;
  /**
   * Базовое название без количества спотов.
   * Количество добавляется динамически в UI: `${kitBaseName} · ${scaledQty} шт.`
   */
  kitBaseName: string;
  kitCategory: "track-built-in" | "track-surface" | "point";
  defaultSpotsQty: number;
  spotsItemSku: string;
  items: readonly LightingItem[];
  totalRub: number;
};

export const LIGHTING_KITS: readonly LightingKit[] = [
  // ── Встроенные треки (COLIBRI / CLARUS) ──────────────────────────────
  {
    kitId: "colibri-start-5",
    kitBaseName: "Старт COLIBRI 220V",
    kitCategory: "track-built-in",
    defaultSpotsQty: 5,
    spotsItemSku: "colibri-london-10w",
    items: [
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 1, priceRub: 7400 },
      { sku: "colibri-london-10w",   name: "COLIBRI LONDON 10W",   qty: 5, priceRub: 1540 },
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
      { sku: "clarus-profile-48v",    name: "Профиль CLARUS 48V",  qty: 1, priceRub: 8000 },
      { sku: "clarus-psu-48v",        name: "Блок питания CLARUS", qty: 1, priceRub: 1530 },
      { sku: "clarus-spot-12w-4000k", name: "CLARUS SPOT 12W",     qty: 5, priceRub: 3520 },
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
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 2, priceRub: 7400 },
      { sku: "colibri-rio-12w",      name: "COLIBRI RIO 12W",      qty: 8, priceRub: 3080 },
    ],
    totalRub: 2 * 7400 + 8 * 3080,
  },

  // ── Накладные треки (ART 220V) ────────────────────────────────────────
  {
    kitId: "art-start-surface-4",
    kitBaseName: "Накладной ART START",
    kitCategory: "track-surface",
    defaultSpotsQty: 4,
    spotsItemSku: "art-start-30w",
    items: [
      { sku: "art-start-30w", name: "ART START 30W 4000K", qty: 4, priceRub: 2090 },
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
      { sku: "art-monolit-30w", name: "ART MONOLIT 30W 4000K", qty: 4, priceRub: 2530 },
    ],
    totalRub: 4 * 2530,
  },

  // ── Точечные светильники (GX53 / MR16) ───────────────────────────────
  {
    kitId: "gx53-optima-6",
    kitBaseName: "Точечный GX53 OPTIMA",
    kitCategory: "point",
    defaultSpotsQty: 6,
    spotsItemSku: "gx53-optima",
    items: [
      { sku: "gx53-optima",        name: "GX53 OPTIMA",         qty: 6, priceRub: 130 },
      { sku: "gx53-lamp-8w-4200k", name: "Лампа GX53 8W 4200K", qty: 6, priceRub: 114 },
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
      { sku: "mr16-zoom-circle",     name: "MR16 ZOOM круг",       qty: 6, priceRub: 260 },
      { sku: "mr16-module-7w-4200k", name: "Модуль MR16 7W 4200K", qty: 6, priceRub: 174 },
    ],
    totalRub: 6 * (260 + 174),
  },
];
