"use client";

import { useMemo, useState } from "react";

import catalogImages from "@/data/catalog-images.json";

const IMG_FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
      <rect width="100%" height="100%" fill="#f1f5f9"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#64748b">Фото товара</text>
    </svg>`
  );

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  /**
   * T-061: если превью скачано локально (`npm run build:catalog-images`),
   * отдаём WebP 256/512 из `public/catalog` вместо ссылки на хост поставщика.
   */
  productId?: string | null;
};

export function ProductImage({
  src,
  alt,
  className,
  containerClassName,
  productId,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const safeSrc = useMemo(() => String(src ?? "").trim(), [src]);
  const safeAlt = useMemo(() => String(alt ?? ""), [alt]);

  const local = useMemo(() => {
    const id = String(productId ?? "").trim();
    return id && id in catalogImages ? id : null;
  }, [productId]);

  const imageSrc = failed
    ? IMG_FALLBACK
    : local
      ? `/catalog/${local}-512.webp`
      : safeSrc || IMG_FALLBACK;

  return (
    <div
      className={
        containerClassName ??
        "aspect-square h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageSrc}
        srcSet={local ? `/catalog/${local}-256.webp 256w, /catalog/${local}-512.webp 512w` : undefined}
        sizes={local ? "(max-width: 768px) 45vw, 256px" : undefined}
        alt={safeAlt}
        width={512}
        height={512}
        loading="lazy"
        decoding="async"
        className={className ?? "h-full w-full object-contain"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
