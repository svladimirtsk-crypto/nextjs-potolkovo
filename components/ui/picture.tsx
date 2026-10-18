import imageManifest from "@/data/image-manifest.json";
import type { ReactEventHandler } from "react";

/**
 * T-061 · `<Picture>` — обёртка над `<picture>` c srcset на предсобранные
 * AVIF/WebP из `public/optimized/` (см. `scripts/build-images.mjs`).
 *
 * Почему не `next/image`: в проекте стоит `images.unoptimized` — хостинг без
 * рантайм-оптимизатора, поэтому `next/image` отдавал бы исходные 2-мегабайтные
 * JPEG. Здесь варианты сгенерированы заранее, а браузер выбирает формат сам.
 *
 * Всегда проставляет `width`/`height` из манифеста, чтобы не было сдвигов
 * layout (CLS), и blur-плейсхолдер фоном под картинкой.
 */

type ManifestEntry = {
  width: number;
  height: number;
  widths: number[];
  blurDataURL: string;
};

const manifest = imageManifest as Record<string, ManifestEntry | undefined>;

/** Quiz cards need a text fallback, not a full-size original, if a thumbnail was not built. */
export function hasOptimizedPicture(src: string): boolean {
  return Object.prototype.hasOwnProperty.call(manifest, src);
}

export type PictureProps = {
  /** Путь к исходнику как он лежит в `public`, например `/hero1.jpeg`. */
  src: string;
  alt: string;
  /** Значение атрибута `sizes`; по умолчанию — во всю ширину вьюпорта. */
  sizes?: string;
  className?: string;
  /** Класс для самого `<img>` (обычно object-cover / скругления). */
  imgClassName?: string;
  /** Hiding failed quiz media preserves the text-only card and its controls. */
  onError?: ReactEventHandler<HTMLImageElement>;
  /**
   * LCP-картинка: грузим сразу и в высоком приоритете.
   * Для всего остального — ленивая загрузка.
   */
  priority?: boolean;
  /**
   * Растянуть картинку по родителю (`position: absolute; inset: 0`) — аналог
   * `fill` у `next/image`. Родитель должен быть `relative` с заданной высотой
   * или aspect-ratio.
   */
  fill?: boolean;
};

/** `fill`: перекрыть собой relative-родителя, как это делает next/image. */
const FILL_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
} as const;

function srcSetFor(base: string, widths: number[], format: "avif" | "webp") {
  return widths.map((w) => `/optimized/${base}-${w}.${format} ${w}w`).join(", ");
}

export function Picture({
  src,
  alt,
  sizes = "100vw",
  className,
  imgClassName,
  onError,
  priority = false,
  fill = false,
}: PictureProps) {
  const entry = manifest[src];

  // Картинки нет в манифесте (например, добавили файл и не пересобрали) —
  // отдаём оригинал, чтобы страница не осталась с дырой.
  if (!entry) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        onError={onError}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={imgClassName ?? className}
        style={fill ? FILL_STYLE : undefined}
      />
    );
  }

  const base = src.replace(/^\//, "").replace(/\.jpe?g$/i, "");
  const fallbackWidth = entry.widths.at(-1) ?? entry.width;

  return (
    <picture className={fill ? `absolute inset-0 ${className ?? ""}`.trim() : className}>
      <source type="image/avif" sizes={sizes} srcSet={srcSetFor(base, entry.widths, "avif")} />
      <source type="image/webp" sizes={sizes} srcSet={srcSetFor(base, entry.widths, "webp")} />
      <img
        src={`/optimized/${base}-${fallbackWidth}.webp`}
        alt={alt}
        onError={onError}
        width={entry.width}
        height={entry.height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={imgClassName}
        style={{
          backgroundImage: `url(${entry.blurDataURL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          ...(fill ? FILL_STYLE : null),
        }}
      />
    </picture>
  );
}
