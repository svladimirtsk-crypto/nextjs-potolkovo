import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * PT-017 (B-F109) · поведение карточки, когда обложка заведомо битая.
 *
 * Само правило «есть ли фото» проверяется на реальных данных в
 * `tests/catalog-photo.test.ts`. Здесь оно подменено: в сегодняшнем каталоге
 * покрытие 100 % (`data/catalog-images-missing.json` пуст), поэтому ветку
 * «поставщик отдаёт 404» на живых данных не поймать — а именно она вернётся
 * после первого же обновления фида с новым SKU.
 */
vi.mock("@/lib/catalog-photo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/catalog-photo")>();
  const badIds = new Set(["bad-id"]);
  const badCovers = new Set(["https://example.test/dead.jpg"]);

  return {
    ...actual,
    hasLocalPhoto: (productId: unknown) => String(productId ?? "") === "local-id",
    isPhotoPending: (product: { productId?: unknown; coverImage?: unknown }) =>
      badIds.has(String(product?.productId ?? "")) ||
      badCovers.has(String(product?.coverImage ?? "")),
  };
});

const { ProductImage } = await import("@/components/feed2/ProductImage");
const { ProductImageLightbox } = await import("@/components/feed2/ProductImageLightbox");
const { ProductCard } = await import("@/components/lighting/CatalogProductCard");
const { PHOTO_PENDING_LABEL } = await import("@/lib/catalog-photo");

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";

const product = (over: Partial<FeedCatalogProduct>): FeedCatalogProduct =>
  ({
    productId: "p", vendorCode: "", offerId: "", name: "Товар", url: "",
    categoryId: "", categoryPath: "", images: [], coverImage: "", priceRub: 100,
    available: true, params: [], keyAttributes: [], system: "NONE", kind: "OTHER",
    unit: "pcs", lengthMeters: null, pieceLengthMeters: null, ...over,
  }) as FeedCatalogProduct;

const DEAD = "https://example.test/dead.jpg";

/** Достаёт SVG заглушки из разметки и расшифровывает его. */
function svgOf(html: string): string {
  const prefix = "data:image/svg+xml;utf8,";
  const start = html.indexOf(prefix);
  if (start < 0) return "";
  return decodeURIComponent(html.slice(start + prefix.length).split("&quot;")[0].split('"')[0]);
}

describe("PT-017 · заведомо битая обложка", () => {
  it("заглушка показывается сразу, без запроса к хосту поставщика", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImage, { src: DEAD, alt: "Профиль", productId: "bad-id" }),
    );

    expect(svgOf(html)).toContain(PHOTO_PENDING_LABEL);
    expect(svgOf(html)).toContain("Профиль");
    // Обречённый запрос не уходит: битой картинки в разметке нет.
    expect(html).not.toContain(DEAD);
  });

  it("рабочая обложка показывается как раньше", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImage, {
        src: "https://example.test/ok.jpg",
        alt: "Профиль",
        productId: "new-sku",
      }),
    );

    expect(html).toContain("https://example.test/ok.jpg");
    expect(html).not.toContain("data:image/svg+xml");
  });

  it("локальное превью важнее внешней ссылки", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImage, { src: DEAD, alt: "Профиль", productId: "local-id" }),
    );

    expect(html).toContain("/catalog/local-id-512.webp");
    expect(html).not.toContain(DEAD);
  });

  it("лайтбокс не предлагает увеличить то, чего нет", () => {
    const html = renderToStaticMarkup(
      createElement(ProductImageLightbox, {
        src: DEAD,
        alt: "Профиль",
        productId: "bad-id",
        kind: "TRACK_PROFILE",
      }),
    );

    expect(html).not.toContain("Открыть фото");
    expect(html).toContain("data:image/svg+xml");
    expect(html).not.toContain(DEAD);
  });

  it("карточка товара: пометка есть, цена и кнопки — на месте", () => {
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        product: product({
          productId: "bad-id",
          name: "Ввод питания COLIBRI",
          coverImage: DEAD,
          priceRub: 500,
        }),
        qty: 1,
        onDec: () => {},
        onInc: () => {},
      }),
    );

    expect(html).toContain(PHOTO_PENDING_LABEL);
    expect(html).toContain("Ввод питания COLIBRI");
    expect(html).not.toContain(DEAD);
    // Товар не спрятан: его по-прежнему можно положить в корзину.
    expect(html).toContain("1 шт");
  });
});
