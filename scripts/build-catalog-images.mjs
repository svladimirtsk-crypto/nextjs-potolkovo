/**
 * T-061 · Локальные превью товаров каталога.
 *
 * Карточки каталога тянут `coverImage` прямо с внешнего хоста поставщика: это
 * сторонняя сеть, часть ссылок отдаёт 404, размеры не заданы (сдвиги layout).
 * Скрипт скачивает обложки на сборке и кладёт WebP 256/512 в
 * `public/catalog/{productId}-{w}.webp`, а карта путей — в
 * `data/catalog-images.json`.
 *
 * Работает мягко: сеть недоступна или картинка битая — товар просто не попадёт
 * в карту, и UI покажет прежний внешний src или плейсхолдер. Поэтому скрипт
 * НЕ подключён к `prebuild` (сборка не должна зависеть от чужого хоста) —
 * запускать вручную: `npm run build:catalog-images`.
 */
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "catalog");
const MAP_PATH = path.join(ROOT, "data", "catalog-images.json");
const SNAPSHOT = path.join(ROOT, "data", "eks-feed2-snapshot.json");

const WIDTHS = [256, 512];
const CONCURRENCY = 6;
const TIMEOUT_MS = 15_000;

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function processOne(product) {
  const id = String(product.productId ?? product.vendorCode ?? "").trim();
  const url = String(product.coverImage ?? "").trim();
  if (!id || !url.startsWith("http")) return null;

  const targets = WIDTHS.map((w) => ({
    width: w,
    file: path.join(OUT_DIR, `${id}-${w}.webp`),
    href: `/catalog/${id}-${w}.webp`,
  }));

  // Уже скачано в прошлый раз — не ходим в сеть повторно.
  if ((await Promise.all(targets.map((t) => exists(t.file)))).every(Boolean)) {
    return [id, { widths: WIDTHS, system: product.systemId ?? null }];
  }

  const buffer = await fetchBuffer(url);
  if (!buffer) return null;

  try {
    for (const t of targets) {
      await sharp(buffer)
        .resize({ width: t.width, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(t.file);
    }
  } catch {
    return null; // не картинка / повреждена
  }

  return [id, { widths: WIDTHS, system: product.systemId ?? null }];
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(MAP_PATH), { recursive: true });

  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];

  const map = {};
  let failed = 0;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(processOne));
    for (const entry of results) {
      if (entry) map[entry[0]] = entry[1];
      else failed += 1;
    }
  }

  await writeFile(MAP_PATH, JSON.stringify(map, null, 2));

  console.log(
    `[catalog-images] ${Object.keys(map).length} из ${products.length} обложек локально; недоступно: ${failed}`
  );
}

await main();
