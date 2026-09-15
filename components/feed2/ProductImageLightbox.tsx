"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ProductImage } from "@/components/feed2/ProductImage";
import { hasLocalPhoto, isPhotoPending } from "@/lib/catalog-photo";

type Props = {
  src: string;
  alt: string;
  thumbClassName?: string;
  /** N-020: локальное превью и осмысленная заглушка. */
  productId?: string | null;
  kind?: string | null;
};

export function ProductImageLightbox({ src, alt, thumbClassName, productId, kind }: Props) {
  const [open, setOpen] = useState(false);

  const safeSrc = String(src ?? "").trim();
  /**
   * PT-017 (B-F109): локальное превью важнее ссылки на хост поставщика.
   * Раньше при пустом `src` рисовалась плашка «нет фото» даже тогда, когда
   * снимок лежал в `public/catalog` — товар с фотографией выглядел товаром
   * без фотографии и терял доверие покупателя.
   */
  const id = String(productId ?? "").trim();
  const localSrc = hasLocalPhoto(id) ? `/catalog/${id}-512.webp` : null;
  const fullSrc = safeSrc || localSrc || "";
  // PT-017: увеличивать нечего, если снимка нет, — вместо битой картинки
  // на весь экран показываем заглушку с пометкой «Фото уточняется».
  const hasSrc = fullSrc.length > 0 && !isPhotoPending({ productId: id, coverImage: safeSrc });

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const portal = useMemo(() => {
    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр изображения"
        onMouseDown={() => setOpen(false)}
      >
        <div
          className="relative max-h-[86vh] w-[min(94vw,1100px)] overflow-hidden rounded-2xl bg-black shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* без фиксированного aspect ratio -> ничего не обрезается */}
          <div className="flex max-h-[86vh] items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullSrc}
              alt={alt}
              className="max-h-[80vh] w-auto max-w-[90vw] object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-950 hover:bg-white"
            aria-label="Закрыть"
            title="Закрыть (Esc)"
          >
            ×
          </button>
        </div>
      </div>,
      document.body
    );
  }, [alt, open, fullSrc]);

  if (!hasSrc) {
    // Увеличивать нечего, но и прятать товар нельзя: показываем ту же заглушку,
    // что и во всём каталоге, — иконка типа, название и пометка «Фото уточняется».
    return (
      <ProductImage
        src={null}
        alt={alt}
        productId={productId}
        kind={kind}
        containerClassName={
          thumbClassName ? `overflow-hidden rounded-xl ${thumbClassName}` : undefined
        }
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "relative overflow-hidden rounded-xl bg-slate-100",
          "cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
          thumbClassName ?? "",
        ].join(" ")}
        aria-label="Открыть фото"
        title="Нажмите, чтобы увеличить"
      >
        <ProductImage
          src={fullSrc}
          alt={alt}
          productId={productId}
          kind={kind}
          className="object-cover"
        />
      </button>

      {portal}
    </>
  );
}
