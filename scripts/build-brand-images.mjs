#!/usr/bin/env node
/** R7: deterministic, local-only responsive assets; never upscale originals. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const config = JSON.parse(await readFile(path.join(root, "design/brand/v7/assets.json"), "utf8"));
const out = path.join(root, "public/brand/v7");
await mkdir(out, { recursive: true });
const images = {};
for (const [id, asset] of Object.entries(config)) {
  if (!["ai-visualization", "owner-photo"].includes(asset.kind)) throw new Error(`Unknown image kind: ${id}`);
  if (!asset.label || !asset.alt || !asset.rights) throw new Error(`Missing provenance: ${id}`);
  const source = path.join(root, "design/brand/v7/originals", path.basename(asset.source));
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error(`Missing dimensions: ${id}`);
  const widths = [...new Set([480, 800, 1280, Math.min(1920, meta.width)].filter(w => w <= meta.width))].sort((a, b) => a - b);
  const sources = { avif: [], webp: [] };
  for (const width of widths) {
    for (const format of ["avif", "webp"]) {
      const filename = `${id}-${width}.${format}`;
      const image = sharp(source).rotate().resize({ width, withoutEnlargement: true });
      await (format === "avif" ? image.avif({ quality: 65, effort: 5 }) : image.webp({ quality: 89, effort: 5 })).toFile(path.join(out, filename));
      sources[format].push({ src: `/brand/v7/${filename}`, width });
    }
  }
  images[id] = { ...asset, width: meta.width, height: meta.height, sources };
  console.log(`[brand-images] ${id}: original ${meta.width}×${meta.height}, widths ${widths.join(", ")}`);
}
await writeFile(path.join(root, "data/brand-image-manifest.json"), JSON.stringify({ version: 1, images }, null, 2) + "\n");
// Dedicated social asset. It does not overwrite the old photographic case/OG source.
await sharp(path.join(root, "design/brand/v7/originals", config["architectural-living"].source))
  .resize(1200, 630, { fit: "cover", position: "centre", withoutEnlargement: true })
  .webp({ quality: 89 }).toFile(path.join(out, "company-og.webp"));
