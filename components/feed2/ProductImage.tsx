"use client";

import { useMemo, useState } from "react";

import { PHOTO_PENDING_LABEL, hasLocalPhoto, isPhotoPending } from "@/lib/catalog-photo";

/**
 * N-020 · Честная заглушка: вместо безликого «Фото товара» показываем иконку
 * типа и само название. Часть обложек поставщик отдаёт с ошибкой — карточка
 * должна оставаться информативной, а не выглядеть сломанной.
 *
 * PT-017 (B-F109): сколько именно таких позиций, решает не комментарий, а
 * `data/catalog-images-missing.json` — отчёт сборщика превью. Заглушка всегда
 * несёт пометку «Фото уточняется», чтобы отсутствие снимка не читалось как
 * ошибка вёрстки.
 */
const KIND_GLYPH: Record<string, string> = {
  LED_STRIP: "M8 32h48M8 40h48",
  PSU: "M16 24h32v16H16z M24 40v6 M40 40v6",
  LAMP: "M32 16a12 12 0 0 1 7 21.7V44H25v-6.3A12 12 0 0 1 32 16z M26 50h12",
  CHANDELIER: "M32 12v10 M14 22h36 M20 22l-4 14h8zM44 22l4 14h-8z",
  CEILING_COMPONENT: "M10 20h44v8H10z M18 28v18 M46 28v18",
  CONTROL: "M20 20h24v24H20z M28 28h8v8h-8z",
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Переносит длинное название на несколько строк — иначе оно уезжает за край. */
function wrap(text: string, perLine = 22, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= perLine) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  }
  return lines;
}

/**
 * Заглушка в виде data-URI. Экспортирована ради теста: это единственное место,
 * где пометка «Фото уточняется» попадает в картинку, и проверять её глазами
 * на каждой сборке — не метод.
 */
export function buildFallback(name: string, kind?: string | null): string {
  const glyph = KIND_GLYPH[String(kind ?? "")] ?? KIND_GLYPH.CEILING_COMPONENT;
  const title = name.trim();
  const lines = wrap(title || PHOTO_PENDING_LABEL);
  const text = lines
    .map(
      (line, index) =>
        `<text x="50%" y="${300 + index * 34}" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" fill="#475569">${escapeXml(line)}</text>`
    )
    .join("");

  // PT-017: пометка отдельной строкой под названием. Если названия нет,
  // пометка уже напечатана первой строкой — второй раз её не повторяем.
  // #64748b на #f8fafc = 4.55:1 — проходит норму WCAG 4.5 для мелкого текста
  // (N-063), в отличие от slate-400, которым нарисована иконка.
  const pending = title
    ? `<text x="50%" y="${300 + lines.length * 34 + 16}" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#64748b" letter-spacing="0.5">${PHOTO_PENDING_LABEL}</text>`
    : "";

  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="100%" height="100%" fill="#f8fafc"/>
        <g transform="translate(192 140) scale(2)" fill="none" stroke="#94a3b8" stroke-width="3" stroke-linecap="round">
          <path d="${glyph}"/>
        </g>
        ${text}${pending}
      </svg>`
    )
  );
}

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
  /** Тип товара — задаёт иконку заглушки. */
  kind?: string | null;
};

export function ProductImage({
  src,
  alt,
  className,
  containerClassName,
  productId,
  kind,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  const safeSrc = useMemo(() => String(src ?? "").trim(), [src]);
  const safeAlt = useMemo(() => String(alt ?? ""), [alt]);

  const local = useMemo(() => {
    const id = String(productId ?? "").trim();
    return hasLocalPhoto(id) ? id : null;
  }, [productId]);

  const fallback = useMemo(() => buildFallback(safeAlt, kind), [safeAlt, kind]);

  /**
   * PT-017 (B-F109): если сборщик превью уже сходил по этой обложке и получил
   * не картинку, запрос заведомо обречён — показываем заглушку сразу, без
   * моргания битой картинки и без лишнего 404 в сети покупателя.
   */
  const pending = useMemo(
    () => isPhotoPending({ productId, coverImage: safeSrc }),
    [productId, safeSrc],
  );

  const imageSrc = failed || pending
    ? fallback
    : local
      ? `/catalog/${local}-512.webp`
      : safeSrc || fallback;

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
