#!/usr/bin/env node
/**
 * T-011 · Валидация каталога перед сборкой.
 * Проверяет, что все SKU, на которые ссылается код, существуют в фиде,
 * и что у каждого профиля трека определяется длина куска.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSnapshot() {
  const file = path.join(root, "data", "eks-feed2-snapshot.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(raw.products) ? raw.products : [];
}

/** Достаём массивы/объекты SKU из TS-исходников без сборки — по регуляркам. */
function readSource(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function extractSkus(source) {
  const matches = source.matchAll(/"(0У-\d{8}|UTA\d+|UTT\d+)"/g);
  return [...matches].map((m) => m[1]);
}

/** Точное извлечение тела массива/объекта по имени идентификатора. */
function extractBlock(source, name) {
  const idx = source.indexOf(name);
  if (idx < 0) return "";
  const openIdx = source.slice(idx).search(/[[{]/);
  if (openIdx < 0) return "";
  const start = idx + openIdx;
  const open = source[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === open) depth += 1;
    else if (source[i] === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  return "";
}

function extractWhitelist(source, name) {
  return extractSkus(extractBlock(source, name));
}

function parseMetersFromText(raw) {
  const s = String(raw ?? "").toLowerCase().replace(/\s+/g, " ");
  const dims = s.match(
    /(\d+(?:[.,]\d+)?)\s*[*х×x]\s*(\d+(?:[.,]\d+)?)(?:\s*[*х×x]\s*(\d+(?:[.,]\d+)?))?\s*(мм|mm)(?![\p{L}])/u
  );
  if (dims) {
    const nums = [dims[1], dims[2], dims[3]]
      .filter(Boolean)
      .map((n) => Number(String(n).replace(",", ".")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length) return Math.max(...nums) / 1000;
  }
  const units = [
    [/(\d+(?:[.,]\d+)?)\s*(мм|mm)(?![\p{L}])/gu, 1 / 1000],
    [/(\d+(?:[.,]\d+)?)\s*(см|cm)(?![\p{L}])/gu, 1 / 100],
    [/(\d+(?:[.,]\d+)?)\s*(м|m)(?![\p{L}])/gu, 1],
  ];
  for (const [re, factor] of units) {
    const values = [...s.matchAll(re)]
      .map((m) => Number(String(m[1]).replace(",", ".")) * factor)
      .filter((n) => Number.isFinite(n) && n > 0);
    if (values.length) return Math.max(...values);
  }
  return 0;
}

function main() {
  const products = readSnapshot();
  const byVendor = new Map();
  for (const p of products) {
    const code = String(p.vendorCode ?? "").trim();
    if (code) byVendor.set(code, p);
  }

  const problems = [];

  const sources = [
    "lib/catalog-ui-config.ts",
    "lib/vendor-code-overrides.ts",
    "app/uslugi/prodazha-trekovogo-osveshcheniya/_components/LightKitShowcase.tsx",
  ];

  const referenced = new Set();
  for (const rel of sources) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const sku of extractSkus(readSource(rel))) referenced.add(sku);
  }

  // Позиции, которые мы намеренно скрываем, в фиде могут отсутствовать.
  const removed = new Set(
    extractSkus(extractBlock(readSource("lib/catalog-ui-config.ts"), "REMOVED_COLIBRI_VENDOR_CODES"))
  );

  for (const sku of referenced) {
    if (removed.has(sku)) continue;
    if (!byVendor.has(sku)) problems.push(`SKU ${sku} отсутствует в фиде`);
  }

  // Профили трека из whitelist должны иметь ненулевую длину куска
  const uiConfig = readSource("lib/catalog-ui-config.ts");
  const overrides = readSource("lib/vendor-code-overrides.ts");
  const pieceLengths = new Map();
  for (const m of overrides.matchAll(/"(0У-\d{8})":\s*([\d.]+)/g)) {
    pieceLengths.set(m[1], Number(m[2]));
  }

  const profileSkus = new Set([
    ...extractWhitelist(uiConfig, "TRACK_PROFILE_WHITELIST"),
    ...extractWhitelist(overrides, "ART_TRACK_PROFILE_VENDOR_WHITELIST"),
  ]);

  for (const sku of profileSkus) {
    const product = byVendor.get(sku);
    if (!product) continue;
    const declared = pieceLengths.get(sku) ?? 0;
    const inferred = declared > 0 ? declared : parseMetersFromText(product.name);
    if (!(inferred > 0)) {
      problems.push(`Профиль ${sku} (${product.name}) — не определяется длина куска`);
    }
  }

  if (problems.length > 0) {
    console.error("validate-catalog: найдены проблемы:");
    for (const p of problems) console.error(` - ${p}`);
    process.exit(1);
  }

  console.log(`validate-catalog: ok (${referenced.size} SKU, ${profileSkus.size} профилей)`);
}

main();
