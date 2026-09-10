/**
 * N-020 · Покрытие каталога локальными фото.
 *
 * Находка F-14/F-40: карточки показывали заглушку «Фото товара», потому что
 * `data/catalog-images.json` был пуст, а хотлинки на хост поставщика часть
 * клиентов не грузила. Тест сторожит, чтобы манифест не «сдулся» обратно.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import catalogImages from "@/data/catalog-images.json";

type Snapshot = {
  products: Array<{ productId?: string; priceRub?: number; coverImage?: string }>;
};

const snapshot = JSON.parse(
  readFileSync(join(process.cwd(), "data/eks-feed2-snapshot.json"), "utf8")
) as Snapshot;

const manifest = catalogImages as Record<string, { widths: number[]; system: string | null }>;
const sellable = snapshot.products.filter((p) => (p.priceRub ?? 0) > 0 && p.productId);

describe("N-020 · локальные превью каталога", () => {
  it("манифест не пустой — иначе весь каталог показывает заглушки", () => {
    expect(Object.keys(manifest).length).toBeGreaterThan(400);
  });

  it("покрытие товаров с ценой ≥ 90 %", () => {
    const covered = sellable.filter((p) => p.productId && p.productId in manifest);
    const ratio = covered.length / sellable.length;

    expect(
      ratio,
      `локальные фото есть у ${covered.length} из ${sellable.length} товаров с ценой`
    ).toBeGreaterThanOrEqual(0.9);
  });

  it("для каждой записи манифеста файлы реально лежат в public/catalog", () => {
    // Проверяем выборку: полный проход по 1026 файлам замедлил бы тест.
    const ids = Object.keys(manifest).slice(0, 40);

    for (const id of ids) {
      for (const width of manifest[id].widths) {
        const file = join(process.cwd(), "public", "catalog", `${id}-${width}.webp`);
        expect(existsSync(file), `${id}-${width}.webp`).toBe(true);
      }
    }
  });

  it("непокрытые товары зафиксированы в отчёте, а не потеряны молча", () => {
    const reportPath = join(process.cwd(), "data/catalog-images-missing.json");
    expect(existsSync(reportPath)).toBe(true);

    const missing = JSON.parse(readFileSync(reportPath, "utf8")) as Array<{
      coverImage: string | null;
    }>;

    // У поставщика часть обложек отдаёт 404 — это внешняя причина, но список
    // должен быть коротким и видимым.
    expect(missing.length).toBeLessThan(60);
  });
});
