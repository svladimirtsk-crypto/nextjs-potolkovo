"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ProductImage } from "@/components/feed2/ProductImage";

type Props = {
  src: string;
  alt: string;
  thumbClassName?: string;
  imageClassName?: string;
};

export function ProductImageLightbox({
  src,
  alt,
  thumbClassName,
  imageClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasSrc = Boolean(String(src ?? "").trim());

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
          className="relative w-[min(92vw,960px)] overflow-hidden rounded-2xl bg-black shadow-2xl"
          style={{ aspectRatio: "16 / 10" }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ProductImage
            src={src}
            alt={alt}
            className={["object-contain", imageClassName ?? ""].join(" ")}
          />

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
  }, [alt, imageClassName, open, src]);

  if (!hasSrc) {
    return (
      <div
        className={[
          "flex items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-500",
          thumbClassName ?? "",
        ].join(" ")}
      >
        нет фото
      </div>
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
        <ProductImage src={src} alt={alt} className="object-cover" />
      </button>

      {portal}
    </>
  );
}
