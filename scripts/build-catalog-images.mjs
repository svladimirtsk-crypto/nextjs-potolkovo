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
const TIMEOUT_MS = 8_000;
const RETRIES = 2;
const MISSING_PATH = path.join(ROOT, "data", "catalog-images-missing.json");

// Хост поставщика отдаёт 403 на запросы без браузерного UA.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchBuffer(url) {
  // N-020: ретраи с паузой — часть 5xx/таймаутов у поставщика разовые,
  // без повтора мы теряли товары на ровном месте.
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: "image/*,*/*" },
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      // 404 не лечится повтором.
      if (res.status === 404) return null;
    } catch {
      // сеть/таймаут — пробуем ещё раз
    } finally {
      clearTimeout(timer);
    }

    if (attempt < RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  return null;
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
    return [id, { widths: WIDTHS, system: product.system ?? null }];
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

  return [id, { widths: WIDTHS, system: product.system ?? null }];
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(MAP_PATH), { recursive: true });

  const snapshot = JSON.parse(await readFile(SNAPSHOT, "utf8"));
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];

  const map = {};
  const missing = [];

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (product) => [product, await processOne(product)])
    );
    for (const [product, entry] of results) {
      if (entry) {
        map[entry[0]] = entry[1];
      } else {
        missing.push({
          productId: product.productId ?? null,
          vendorCode: product.vendorCode ?? null,
          name: product.name ?? null,
          coverImage: product.coverImage ?? null,
        });
      }
    }
    if (i % 120 === 0) {
      console.log(`[catalog-images] обработано ${Math.min(i + CONCURRENCY, products.length)}/${products.length}`);
    }
  }

  await writeFile(MAP_PATH, JSON.stringify(map, null, 2));
  await writeFile(MISSING_PATH, JSON.stringify(missing, null, 2));

  const covered = Object.keys(map).length;
  const pct = products.length ? Math.round((covered / products.length) * 100) : 0;
  console.log(
    `[catalog-images] ${covered} из ${products.length} обложек локально (${pct}%); ` +
      `без фото: ${missing.length} — список в data/catalog-images-missing.json`
  );
}

await main();
