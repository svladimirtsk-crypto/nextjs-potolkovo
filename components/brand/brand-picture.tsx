import manifest from "@/data/brand-image-manifest.json";

export type BrandImageId = keyof typeof manifest.images;

type Props = {
  id: BrandImageId;
  priority?: boolean;
  sizes?: string;
  className?: string;
};

/** The caption is part of the image, never a hover-only disclosure. */
export function BrandPicture({ id, priority = false, sizes = "(max-width: 640px) 100vw, 50vw", className = "" }: Props) {
  const image = manifest.images[id];
  const fallback = image.sources.webp[image.sources.webp.length - 1];
  return (
    <figure className={`pk-picture ${className}`} data-image-kind={image.kind}>
      <picture>
        <source type="image/avif" srcSet={image.sources.avif.map(s => `${s.src} ${s.width}w`).join(", ")} sizes={sizes} />
        <source type="image/webp" srcSet={image.sources.webp.map(s => `${s.src} ${s.width}w`).join(", ")} sizes={sizes} />
        {/* Static srcsets are built locally; Next Image optimization is disabled in this repository. */}
        <img src={fallback.src} alt={image.alt} width={image.width} height={image.height}
          loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" />
      </picture>
      <figcaption>{image.label}</figcaption>
    </figure>
  );
}
