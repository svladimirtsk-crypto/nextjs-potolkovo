#!/usr/bin/env node
/**
 * Восполнение обложек товаров из фида поставщика.
 *
 * У части позиций `coverImage` в снапшоте ведёт на удалённый файл: поставщик
 * перезалил картинки, и старые ссылки отдают 404. Такие товары выпадают из
 * `catalog-images.json`, и в каталоге вместо фото остаётся плейсхолдер.
 * На момент написания это 34 позиции из 547, включая все подвесы.
 *
 * Ключевая деталь: ссылка в снапшоте непустая и внешне корректная — понять,
 * что она мёртвая, можно только запросом. Поэтому скрипт сверяет обложку с
 * актуальным фидом и заменяет её, если она изменилась у поставщика, а не
 * ориентируется на пустоту поля.
 *
 * Скрипт берёт ссылки из актуального фида по `vendorCode` — единственному
 * ключу, который совпадает между снапшотом и выгрузкой поставщика
 * (`productId` у нас `eks-00008487`, у него `ЦБ-00008487`).
 *
 * Трогает только `coverImage` и `images` у товаров, где обложки не было.
 * Цены, состав каталога и классификация остаются как есть: обновление
 * каталога целиком — отдельная задача с проверкой 151 нового товара.
 *
 *   node scripts/fill-missing-covers.mjs --dry-run
 *   FEED_URL=... node scripts/fill-missing-covers.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = resolve(ROOT, "data/eks-feed2-snapshot.json");

const DRY_RUN = process.argv.includes("--dry-run");
const FEED_URL = process.env.FEED_URL ?? "https://eksmarket.ru/api/personal/feed2/";

function fail(message) {
  console.error(`[covers] ${message}`);
  process.exit(1);
}

async function loadFeed(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "potolkovo-fill-covers" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) fail(`фид недоступен: HTTP ${res.status}`);
  return res.text();
}

/**
 * Разбор YML без внешних зависимостей: нужны только `vendorCode` и `picture`.
 * Полноценный парсер живёт в `lib/eks-feed2-catalog.ts`, но он отбрасывает
 * товары без `categoryId` — а в текущей выгрузке его нет ни у одного offer.
 */
function picturesByVendorCode(xml) {
  const map = new Map();

  for (const block of xml.split("<offer ").slice(1)) {
    const offer = block.slice(0, block.indexOf("</offer>"));

    const vendorCode = offer.match(/<vendorCode>([^<]+)<\/vendorCode>/)?.[1]?.trim();
    if (!vendorCode) continue;

    const pictures = [...offer.matchAll(/<picture>([^<]+)<\/picture>/g)]
      .map((m) => m[1].trim())
      .filter((src) => src.startsWith("http"));

    if (pictures.length) map.set(vendorCode, pictures);
  }

  return map;
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const products = snapshot.products ?? [];

const pictures = picturesByVendorCode(await loadFeed(FEED_URL));
if (pictures.size === 0) fail("в фиде не нашлось ни одной картинки — формат изменился");

console.log(`[covers] в фиде картинок у ${pictures.size} товаров`);

const filled = [];
const stillEmpty = [];

/** Товары, у которых локальной копии фото ещё нет. */
const localImages = JSON.parse(readFileSync(resolve(ROOT, "data/catalog-images.json"), "utf8"));
const withoutLocal = new Set(
  products
    .filter((product) => !(String(product.productId ?? "") in localImages))
    .map((product) => String(product.productId ?? ""))
);

for (const product of products) {
  // Чиним только то, что реально не отображается в каталоге.
  if (!withoutLocal.has(String(product.productId ?? ""))) continue;

  const vendorCode = String(product.vendorCode ?? "").trim();
  const found = pictures.get(vendorCode);

  if (!found) {
    stillEmpty.push(product);
    continue;
  }

  // Ссылка та же — значит дело не в перезаливке, и менять нечего.
  if (found[0] === String(product.coverImage ?? "")) {
    stillEmpty.push(product);
    continue;
  }

  if (!DRY_RUN) {
    product.coverImage = found[0];
    // Галерея не используется в карточке, но пусть данные будут полными.
    product.images = found;
  }
  filled.push({ name: String(product.name ?? "").slice(0, 60), src: found[0] });
}

console.log(`[covers] без локального фото: ${filled.length + stillEmpty.length}`);
console.log(`[covers] обложка обновлена:   ${filled.length}`);
console.log(`[covers] осталось без фото: ${stillEmpty.length}`);

for (const item of filled.slice(0, 10)) {
  console.log(`  + ${item.name}`);
}
if (filled.length > 10) console.log(`  … и ещё ${filled.length - 10}`);

for (const product of stillEmpty) {
  console.log(`  - ${String(product.name ?? "").slice(0, 60)} (${product.vendorCode})`);
}

if (DRY_RUN) {
  console.log("\n[covers] dry-run: снапшот не изменён");
} else if (filled.length) {
  writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log("\n[covers] снапшот обновлён — запустите build-catalog-images.mjs");
}
