"use client";

import { useMemo, useState } from "react";

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
};

export function ProductImage({
  src,
  alt,
  className,
  containerClassName,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const safeSrc = useMemo(() => String(src ?? ""), [src]);

  const imageSrc = failed || !safeSrc ? IMG_FALLBACK : safeSrc;

  return (
    <div
      className={
        containerClassName ??
        "aspect-square h-32 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3"
      }
    >
      <img
        src={imageSrc}
        alt={alt}
        loading="lazy"
        className={className ?? "h-full w-full object-contain"}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
