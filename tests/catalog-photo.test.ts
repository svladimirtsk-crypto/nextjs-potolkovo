import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { buildFallback } from "@/components/feed2/ProductImage";
import { ProductImageLightbox } from "@/components/feed2/ProductImageLightbox";
import { ProductCard } from "@/components/lighting/CatalogProductCard";
import catalogImages from "@/data/catalog-images.json";
import snapshot from "@/data/eks-feed2-snapshot.json";
import {
  PHOTO_PENDING_LABEL,
  PHOTO_RANK,
  createPhotoRanker,
  hasLocalPhoto,
  isPhotoPending,
  photoCoverage,
  photoRank,
  sortByPhoto,
} from "@/lib/catalog-photo";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

/**
 * PT-017 (B-F109, T-323) · товары без фотографии.
 *
 * Требование ТЗ: НЕ скрывать (обязательное комплектующее без снимка остаётся
 * обязательным), понижать в выдаче и автоподборе, показывать с пометкой
 * «Фото уточняется», сохранять доступность через прямой поиск.
 *
 * ВАЖНО про исходные данные. В ТЗ задача сформулирована как «34 SKU без
 * локального фото» — на текущем снапшоте эта цифра НЕ воспроизводится:
 * `npm run check:catalog-images` отдаёт 100 % покрытия (547 из 547). Механизм
 * всё равно нужен: еженедельный `refresh-catalog.yml` добавляет новые SKU, и
 * любая обложка, которую поставщик отдаст с ошибкой, снова даст товар без фото.
 * Поэтому здесь два слоя проверок: синтетика (правило работает) и живой
 * снапшот (сколько позиций затронуто сегодня).
 */

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
    categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
    available: true, params: [], keyAttributes: [], system: "NONE", kind: "OTHER",
    unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
  }) as FeedCatalogProduct;

/** Реальный товар из снапшота — у него гарантированно есть локальное превью. */
const withPhotoId = Object.keys(catalogImages)[0];
const realProducts = (snapshot as unknown as { products: FeedCatalogProduct[] }).products;

describe("PT-017 · ранг фотографии", () => {
  it("локальное превью — ранг 0", () => {
    expect(hasLocalPhoto(withPhotoId)).toBe(true);
    expect(photoRank(product({ productId: withPhotoId }))).toBe(PHOTO_RANK.local);
  });

  it("только внешняя обложка — ранг 1: пробуем показать, но не гарантируем", () => {
    const item = product({ productId: "new-sku", coverImage: "https://example.test/a.jpg" });
    expect(photoRank(item)).toBe(PHOTO_RANK.remote);
    expect(isPhotoPending(item)).toBe(false);
  });

  it("ни превью, ни обложки — ранг 2 и пометка", () => {
    const item = product({ productId: "no-photo", coverImage: "" });
    expect(photoRank(item)).toBe(PHOTO_RANK.none);
    expect(isPhotoPending(item)).toBe(true);
  });

  it("обложка, которую сборщик уже не скачал, считается отсутствующей", () => {
    // Реальный `data/catalog-images-missing.json` сейчас пуст, поэтому ветка
    // проверяется на выдуманном отчёте — иначе она осталась бы непокрытой.
    const rank = createPhotoRanker(
      new Set(["local-1"]),
      new Set(["https://example.test/dead.jpg"]),
      new Set(["broken-id"]),
    );

    expect(rank({ productId: "local-1", coverImage: "https://example.test/dead.jpg" })).toBe(
      PHOTO_RANK.local,
    );
    expect(rank({ productId: "x", coverImage: "https://example.test/dead.jpg" })).toBe(
      PHOTO_RANK.none,
    );
    expect(rank({ productId: "broken-id", coverImage: "https://example.test/other.jpg" })).toBe(
      PHOTO_RANK.none,
    );
    expect(rank({ productId: "x", coverImage: "https://example.test/other.jpg" })).toBe(
      PHOTO_RANK.remote,
    );
  });

  it("пустой и нестроковый идентификатор не дают ложного «фото есть»", () => {
    expect(hasLocalPhoto("")).toBe(false);
    expect(hasLocalPhoto(null)).toBe(false);
    expect(hasLocalPhoto(undefined)).toBe(false);
    expect(photoRank({})).toBe(PHOTO_RANK.none);
  });
});

describe("PT-017 · порядок показа", () => {
  const a = product({ productId: "a", coverImage: "" });
  const b = product({ productId: withPhotoId });
  const c = product({ productId: "c", coverImage: "" });
  const d = product({ productId: "d", coverImage: "https://example.test/d.jpg" });

  it("сначала локальное фото, потом внешняя обложка, потом заглушка", () => {
    expect(sortByPhoto([a, b, c, d]).map((p) => p.productId)).toEqual([
      withPhotoId,
      "d",
      "a",
      "c",
    ]);
  });

  it("порядок внутри группы сохраняется — цена и релевантность не перемешиваются", () => {
    const list = [
      product({ productId: "n1", coverImage: "" }),
      product({ productId: "n2", coverImage: "" }),
      product({ productId: "n3", coverImage: "" }),
    ];
    expect(sortByPhoto(list).map((p) => p.productId)).toEqual(["n1", "n2", "n3"]);
  });

  it("ничего не теряется и входной массив не мутируется", () => {
    const list = [a, b, c, d];
    const got = sortByPhoto(list);

    expect(got).toHaveLength(list.length);
    expect(got).toEqual(expect.arrayContaining(list));
    expect(list.map((p) => p.productId)).toEqual(["a", withPhotoId, "c", "d"]);
  });
});

describe("PT-017 · пометка в заглушке", () => {
  const svgOf = (name: string) =>
    decodeURIComponent(buildFallback(name).replace("data:image/svg+xml;utf8,", ""));

  it("рядом с названием печатается «Фото уточняется»", () => {
    // Название короче 22 символов — перенос строк не вмешивается в проверку.
    const svg = svgOf("Профиль COLIBRI");
    expect(svg).toContain("Профиль COLIBRI");
    expect(svg).toContain(PHOTO_PENDING_LABEL);
  });

  it("длинное название переносится, пометка остаётся", () => {
    const svg = svgOf(
      "Светильник точечный встраиваемый поворотный MR16 GU10 белый матовый с патроном",
    );
    expect(svg).toContain(PHOTO_PENDING_LABEL);
    expect(svg).toContain("…"); // последняя строка обрезана с многоточием
  });

  it("без названия пометка одна — дубля нет", () => {
    const svg = svgOf("   ");
    expect(svg.split(PHOTO_PENDING_LABEL).length - 1).toBe(1);
  });

  it("пометка не вылезает за пределы холста 512×512", () => {
    const longName = "Светильник точечный встраиваемый поворотный MR16 с патроном GU10 белый матовый";
    const svg = svgOf(longName);
    const ys = [...svg.matchAll(/y="(\d+)"/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(512);
  });
});

describe("PT-017 · карточка товара", () => {
  const render = (item: FeedCatalogProduct) =>
    renderToStaticMarkup(
      createElement(ProductCard, { product: item, qty: 1, onDec: () => {}, onInc: () => {} }),
    );

  it("товар без фото показывается с пометкой", () => {
    const html = render(product({ productId: "no-photo", name: "Соединитель прямой", coverImage: "" }));
    expect(html).toContain('data-testid="photo-pending-badge"');
    expect(html).toContain(PHOTO_PENDING_LABEL);
    // Товар остаётся в выдаче: цена и кнопка количества на месте.
    expect(html).toContain("Соединитель прямой");
  });

  it("товар с локальным фото показывается без пометки", () => {
    const html = render(product({ productId: withPhotoId, name: "Профиль" }));
    expect(html).not.toContain(PHOTO_PENDING_LABEL);
    expect(html).toContain(`/catalog/${withPhotoId}-512.webp`);
  });

  it("товар с непроверенной внешней обложкой показывается без пометки", () => {
    const html = render(
      product({ productId: "new-sku", name: "Новинка", coverImage: "https://example.test/n.jpg" }),
    );
    expect(html).not.toContain(PHOTO_PENDING_LABEL);
    expect(html).toContain("https://example.test/n.jpg");
  });
});

describe("PT-017 · лайтбокс карточки", () => {
  const render = (props: { src: string; productId: string | null }) =>
    renderToStaticMarkup(
      createElement(ProductImageLightbox, {
        src: props.src,
        alt: "Профиль",
        productId: props.productId,
        kind: "TRACK_PROFILE",
      }),
    );

  it("локальное превью показывается, даже если внешняя обложка пустая", () => {
    // Регрессия: при пустом `src` рисовалась плашка «нет фото», хотя снимок
    // лежал в public/catalog — товар с фотографией выглядел товаром без неё.
    const html = render({ src: "", productId: withPhotoId });
    expect(html).toContain(`/catalog/${withPhotoId}-512.webp`);
    expect(html).not.toContain("нет фото");
    expect(html).not.toContain(PHOTO_PENDING_LABEL);
  });

  it("без снимка показывается общая заглушка с пометкой, а не плашка «нет фото»", () => {
    const html = render({ src: "", productId: "no-photo" });
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain("нет фото");
  });

  it("внешняя обложка без локального превью открывается в лайтбоксе", () => {
    const html = render({ src: "https://example.test/a.jpg", productId: "new-sku" });
    expect(html).toContain("https://example.test/a.jpg");
    expect(html).toContain("Открыть фото");
  });
});

describe("PT-017 · живой каталог", () => {
  const coverage = photoCoverage(realProducts);

  it("сегодня без фото ноль позиций — цифра «34» из ТЗ не воспроизводится", () => {
    expect(coverage.total).toBeGreaterThan(0);
    expect(coverage.none).toBe(0);
    expect(coverage.local).toBe(coverage.total);
  });

  it("если после обновления фида появятся товары без фото, их останется меньше десятой части", () => {
    // Та же граница, что в страже `check-catalog-images` (MIN_COVERAGE = 0.9)
    // и в `tests/catalog-images.test.ts`: при её превышении каталог уже нельзя
    // считать покрытым, и разбираться надо со сборщиком превью, а не с вёрсткой.
    expect(coverage.none).toBeLessThanOrEqual(Math.ceil(coverage.total * 0.1));
  });
});
