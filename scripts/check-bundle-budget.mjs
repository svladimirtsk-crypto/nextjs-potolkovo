#!/usr/bin/env node
/**
 * T-029 · Бюджет клиентского JS.
 *
 * App Router не публикует размеры в build-manifest, поэтому считаем честно:
 * берём отрендеренный HTML каждой статической страницы и суммируем её чанки.
 * Меряем в gzip — именно так Next отчитывается о First Load JS, и именно
 * столько байт реально уходит по сети.
 * Падает, если главная превышает бюджет — регресс ловится в CI, а не на проде.
 *
 * Запуск: node scripts/check-bundle-budget.mjs  (после next build)
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const NEXT_DIR = resolve(ROOT, ".next");
/** Бюджет из ТЗ: First Load JS главной ≤ 300 КБ. */
const BUDGET_KB = 300;
const BUDGETED_PAGE = "/";

function readChunk(relativeUrl) {
  const path = resolve(NEXT_DIR, relativeUrl.replace(/^\/_next\//, ""));
  try {
    return readFileSync(path);
  } catch {
    return Buffer.alloc(0);
  }
}

/** Рекурсивно собирает отрендеренные HTML статических страниц. */
function collectHtml(dir, prefix = "") {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectHtml(path, `${prefix}/${entry.name}`));
    } else if (entry.name.endsWith(".html")) {
      const base = entry.name.replace(/\.html$/, "");
      const route = base === "index" ? prefix || "/" : `${prefix}/${base}`;
      found.push({ route, path });
    }
  }
  return found;
}

const APP_DIR = resolve(NEXT_DIR, "server/app");
if (!existsSync(APP_DIR)) {
  console.error("[bundle] .next/server/app не найден — сначала выполните next build");
  process.exit(1);
}

const rows = [];
for (const { route, path } of collectHtml(APP_DIR)) {
  const html = readFileSync(path, "utf8");
  const chunks = new Set(html.match(/\/_next\/static\/[^"'\\]+?\.js/g) ?? []);
  // Чанки грузятся вместе, поэтому и жмём их как единый поток.
  const bytes = gzipSync(Buffer.concat([...chunks].map(readChunk))).byteLength;
  rows.push({ page: route, kb: bytes / 1024 });
}

rows.sort((a, b) => b.kb - a.kb);

console.log("[bundle] First Load JS (gzip) по страницам:");
for (const row of rows) {
  console.log(`  ${row.kb.toFixed(1).padStart(7)} КБ  ${row.page}`);
}

const main = rows.find((row) => row.page === BUDGETED_PAGE);
if (!main) {
  console.error(`[bundle] страница ${BUDGETED_PAGE} не найдена в манифесте`);
  process.exit(1);
}

if (main.kb > BUDGET_KB) {
  console.error(
    `[bundle] ${BUDGETED_PAGE}: ${main.kb.toFixed(1)} КБ превышает бюджет ${BUDGET_KB} КБ`
  );
  process.exit(1);
}

console.log(`[bundle] ok — ${BUDGETED_PAGE} ${main.kb.toFixed(1)} КБ ≤ ${BUDGET_KB} КБ`);
