"use client";

import { useCallback, useRef, useState } from "react";
import { useDialogFocus } from "@/lib/use-dialog-focus";
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
  const [imageFailed, setImageFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDialogFocus(open, dialogRef, close);

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

  const portal = open && typeof document !== "undefined" ? createPortal(
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="pk-product-lightbox fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
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
            {fallbackFailed || (imageFailed && !localSrc) ? <p className="p-8 text-white">Фото не загрузилось. Уточним изображение у поставщика.</p> : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageFailed ? localSrc! : fullSrc} alt={alt}
                onError={() => imageFailed ? setFallbackFailed(true) : setImageFailed(true)}
                className="max-h-[80vh] w-auto max-w-[90vw] object-contain" />
            )}
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
    ) : null;

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
        onClick={() => { setImageFailed(false); setFallbackFailed(false); setOpen(true); }}
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
          className="h-full w-full object-contain"
        />
      </button>

      {portal}
    </>
  );
}
