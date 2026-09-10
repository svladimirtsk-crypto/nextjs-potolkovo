#!/usr/bin/env node
/**
 * T-029 · Сборка лёгкого каталога для клиента.
 *
 * Полный фид `data/eks-feed2-snapshot.json` весит ~940 КБ и не должен попадать
 * в браузерный бандл. Скрипт (запускается в `prebuild`) выжимает из него два файла:
 *
 *   data/catalog-index.json   — минимум полей для UI каталога   (цель ≤ 120 КБ)
 *   data/catalog-prefill.json — sku → {kind, system, lengthMm}  (цель ≤ 20 КБ)
 *
 * Серверные компоненты (LightKitShowcase, home-proof-pricing) продолжают читать
 * полный фид — они рендерятся на сервере и в клиентский бандл его не тянут.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SOURCE = resolve(ROOT, "data/eks-feed2-snapshot.json");
const INDEX_OUT = resolve(ROOT, "data/catalog-index.json");
const PREFILL_OUT = resolve(ROOT, "data/catalog-prefill.json");
const PRICING_OUT = resolve(ROOT, "data/proof-pricing-inputs.json");

/** Бюджеты из ТЗ, КБ. */
const INDEX_BUDGET_KB = 120;
const PREFILL_BUDGET_KB = 20;

function text(value) {
  return String(value ?? "");
}

/** Зеркало normalizeSocketText из lib/feed2-products.ts. */
function normalizeSocketText(raw) {
  return text(raw)
    .toLowerCase()
    .replace(/\s*[-–—]\s*/g, "")
    .replace(/gu\s*10/g, "gu10")
    .replace(/gu\s*5\s*[.,]\s*3/g, "gu5.3")
    .replace(/gx\s*53/g, "gx53")
    .replace(/mr\s*16/g, "mr16")
    .replace(/\s+/g, " ");
}

/**
 * Цоколь считаем на этапе сборки: параметры товара нужны только здесь,
 * поэтому в клиент уезжает уже готовое значение, а не весь массив params.
 */
function detectSocket(product) {
  const parts = [
    product.name,
    product.categoryPath,
    ...(product.params ?? []).map((p) => `${p.label} ${p.value}`),
    ...(product.keyAttributes ?? []).map((p) => `${p.label} ${p.value}`),
  ];
  const haystack = normalizeSocketText(parts.join(" "));

  if (haystack.includes("gx53")) return "GX53";
  if (haystack.includes("gu10")) return "GU10";
  if (haystack.includes("mr16") || haystack.includes("gu5.3")) return "MR16";
  return null;
}

const feed = JSON.parse(readFileSync(SOURCE, "utf8"));
const products = Array.isArray(feed.products) ? feed.products : [];

if (products.length === 0) {
  console.error("[catalog-index] В фиде нет товаров — сборка индекса остановлена.");
  process.exit(1);
}

/**
 * Индекс кодируем компактно: имена полей повторялись бы 547 раз, а строковые
 * enum'ы и общий префикс картинок — сотни раз. Поэтому товар = кортеж, а
 * system/kind/unit/socket вынесены в словари. Расшифровка — в
 * lib/lighting/catalog-index.ts, форма для потребителей не меняется.
 */
const IMAGE_PREFIX = "https://eksmarket.ru/upload/iblock/";

/** Собирает словарь уникальных значений и отдаёт индексатор. */
function makeDictionary() {
  const values = [];
  const seen = new Map();
  return {
    values,
    idOf(value) {
      const key = text(value);
      if (!key) return -1;
      const existing = seen.get(key);
      if (existing !== undefined) return existing;
      const id = values.push(key) - 1;
      seen.set(key, id);
      return id;
    },
  };
}

/**
 * T-043: в фиде пульты лежат в категории блоков питания. Оставить их как PSU
 * нельзя — они попадут в автоподбор блоков питания по мощности.
 */
function resolveKind(product) {
  const name = text(product.name).toLowerCase();
  if (/пульт|контроллер|диммер/.test(name)) return "CONTROL";
  return text(product.kind);
}

const systems = makeDictionary();
const kinds = makeDictionary();
const units = makeDictionary();
const sockets = makeDictionary();

const rows = products.map((product) => {
  const pieceLength = product.pieceLengthMeters;
  const cover = text(product.coverImage);

  return [
    text(product.productId),
    text(product.vendorCode),
    text(product.name),
    Number(product.priceRub) || 0,
    product.available ? 1 : 0,
    systems.idOf(product.system),
    kinds.idOf(resolveKind(product)),
    units.idOf(product.unit),
    pieceLength === null || pieceLength === undefined ? null : Number(pieceLength),
    sockets.idOf(detectSocket(product)),
    cover.startsWith(IMAGE_PREFIX) ? cover.slice(IMAGE_PREFIX.length) : cover,
  ];
});

const prefill = {};
for (const product of products) {
  const sku = text(product.vendorCode) || text(product.productId);
  if (!sku) continue;

  const lengthMeters = product.pieceLengthMeters ?? product.lengthMeters;
  // Кортеж [kindId, systemId, lengthMm] вместо объекта с ключами.
  prefill[sku] = [
    kinds.idOf(resolveKind(product)),
    systems.idOf(product.system),
    lengthMeters ? Math.round(Number(lengthMeters) * 1000) : null,
  ];
}

const payload = {
  updatedAt: text(feed.updatedAt),
  discountPercentForCeilingOrder: feed.discountPercentForCeilingOrder ?? null,
  imagePrefix: IMAGE_PREFIX,
  // Порядок полей в кортеже — контракт с lib/lighting/catalog-index.ts.
  columns: [
    "productId",
    "vendorCode",
    "name",
    "priceRub",
    "available",
    "system",
    "kind",
    "unit",
    "pieceLengthMeters",
    "socket",
    "coverImage",
  ],
  dictionaries: {
    system: systems.values,
    kind: kinds.values,
    unit: units.values,
    socket: sockets.values,
  },
  rows,
};

writeFileSync(INDEX_OUT, JSON.stringify(payload));
writeFileSync(
  PREFILL_OUT,
  JSON.stringify({ dictionaries: { kind: kinds.values, system: systems.values }, items: prefill })
);

/**
 * Витринные расчёты на главной (`lib/home-proof-pricing.ts`) читаются из
 * `content/homepage.ts`, который попадает в клиентский бандл. Им нужны только
 * трековые профили и цены по артикулам — выносим этот минимум отдельным файлом.
 */
const pricingInputs = {
  profiles: products
    .filter((p) => text(p.kind) === "TRACK_PROFILE" && (Number(p.priceRub) || 0) > 0)
    .map((p) => ({
      vendorCode: text(p.vendorCode),
      name: text(p.name),
      system: text(p.system),
      priceRub: Number(p.priceRub) || 0,
      pieceLengthMeters: p.pieceLengthMeters ?? null,
    })),
  prices: Object.fromEntries(
    products
      .filter((p) => text(p.vendorCode) && (Number(p.priceRub) || 0) > 0)
      .map((p) => [text(p.vendorCode), Number(p.priceRub) || 0])
  ),
};

writeFileSync(PRICING_OUT, JSON.stringify(pricingInputs));
const pricingKb = Buffer.byteLength(JSON.stringify(pricingInputs)) / 1024;
console.log(`[catalog-index] proof-pricing ${pricingKb.toFixed(1)} КБ (${pricingInputs.profiles.length} профилей)`);

const indexKb = Buffer.byteLength(JSON.stringify(payload)) / 1024;
const prefillKb = Buffer.byteLength(readFileSync(PREFILL_OUT)) / 1024;

console.log(
  `[catalog-index] ${rows.length} товаров · index ${indexKb.toFixed(1)} КБ · prefill ${prefillKb.toFixed(1)} КБ`
);

let overBudget = false;
if (indexKb > INDEX_BUDGET_KB) {
  console.error(`[catalog-index] index превышает бюджет ${INDEX_BUDGET_KB} КБ`);
  overBudget = true;
}
if (prefillKb > PREFILL_BUDGET_KB) {
  console.error(`[catalog-index] prefill превышает бюджет ${PREFILL_BUDGET_KB} КБ`);
  overBudget = true;
}
if (overBudget) process.exit(1);
