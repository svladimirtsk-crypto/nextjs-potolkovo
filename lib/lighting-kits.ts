export const LIGHTING_KITS = [
  {
    kitId: "colibri-start-5",
    kitName: "Старт COLIBRI 220V · 5 спотов",
    items: [
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 1, priceRub: 7400 },
      { sku: "colibri-london-10w", name: "COLIBRI LONDON 10W", qty: 5, priceRub: 1540 },
    ],
    totalRub: 7400 + 5 * 1540,
  },
  {
    kitId: "clarus-start-5",
    kitName: "Старт CLARUS 48V · 5 спотов",
    items: [
      { sku: "clarus-profile-48v", name: "Профиль CLARUS 48V", qty: 1, priceRub: 8000 },
      { sku: "clarus-psu-48v", name: "Блок питания CLARUS", qty: 1, priceRub: 1530 },
      { sku: "clarus-spot-12w-4000k", name: "CLARUS SPOT 12W", qty: 5, priceRub: 3520 },
    ],
    totalRub: 8000 + 1530 + 5 * 3520,
  },
  {
    kitId: "colibri-rio-8",
    kitName: "Комфорт COLIBRI RIO · 8 спотов",
    items: [
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 2, priceRub: 7400 },
      { sku: "colibri-rio-12w", name: "COLIBRI RIO 12W", qty: 8, priceRub: 3080 },
    ],
    totalRub: 2 * 7400 + 8 * 3080,
  },
] as const;

export type LightingKit = (typeof LIGHTING_KITS)[number];
