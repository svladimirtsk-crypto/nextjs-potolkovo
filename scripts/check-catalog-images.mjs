/**
 * N-020 · Страж покрытия каталога локальными фото (запускается в prebuild).
 *
 * Скачивание в сборку НЕ входит — она не должна зависеть от доступности хоста
 * поставщика. Здесь только проверка уже собранного манифеста: если покрытие
 * упало ниже порога, каталог поедет в прод с заглушками, и это надо заметить
 * до деплоя, а не по жалобе клиента.
 *
 * Обновить фото: `npm run build:catalog-images`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_COVERAGE = 0.9;

async function readJson(relative, fallback) {
  try {
    return JSON.parse(await readFile(path.join(ROOT, relative), "utf8"));
  } catch {
    return fallback;
  }
}

const manifest = await readJson("data/catalog-images.json", {});
const snapshot = await readJson("data/eks-feed2-snapshot.json", { products: [] });

const sellable = (snapshot.products ?? []).filter(
  (product) => Number(product.priceRub ?? 0) > 0 && product.productId
);

if (sellable.length === 0) {
  console.log("[catalog-images] в снапшоте нет товаров с ценой — пропускаю проверку");
  process.exit(0);
}

const covered = sellable.filter((product) => product.productId in manifest);
const ratio = covered.length / sellable.length;
const pct = Math.round(ratio * 100);

if (ratio < MIN_COVERAGE) {
  console.error(
    `[catalog-images] ✖ покрытие ${pct}% (${covered.length}/${sellable.length}), ` +
      `нужно ≥ ${Math.round(MIN_COVERAGE * 100)}%.\n` +
      `   Запустите: npm run build:catalog-images`
  );
  process.exit(1);
}

console.log(`[catalog-images] ok — ${pct}% товаров с ценой имеют локальное фото`);
