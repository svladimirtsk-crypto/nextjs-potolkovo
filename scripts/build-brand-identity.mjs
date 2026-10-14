#!/usr/bin/env node
/** Local-only R7 identity assets. No network, generated claims or upscaled photography. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public/brand/v7");
const fontfile = path.join(root, "design/brand/v7/typefaces/Inter-CyrillicLatin.ttf");
const covers = JSON.parse(await readFile(path.join(root, "design/brand/v7/social-covers.json"), "utf8"));
const assets = JSON.parse(await readFile(path.join(root, "design/brand/v7/assets.json"), "utf8"));
await mkdir(path.join(out, "social"), { recursive: true });
const svg = (body, width = 64, height = 64) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`);
const mark = (paper = "#f6f5ef", accent = "#d7ed89") => `<path d="M4 33V8h30v25" fill="none" stroke="${paper}" stroke-width="3"/><path d="M12 16h14M19 16v11" fill="none" stroke="${accent}" stroke-width="3"/>`;
const icon = svg(`<rect width="64" height="64" rx="12" fill="#173c36"/><g transform="translate(9 7) scale(1.2)">${mark()}</g>`);
await writeFile(path.join(root, "app/icon.svg"), icon);
await writeFile(path.join(root, "design/brand/v7/brand-icon.svg"), icon);
const iconFiles = [];
for (const size of [16, 32, 48, 180, 192, 512]) {
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  const buffer = await sharp(icon).resize(size, size).png().toBuffer();
  await writeFile(path.join(out, name), buffer);
  iconFiles.push({ size, buffer });
}
// Standard ICO directory with PNG-encoded 16/32/48px entries (32-bit RGBA).
const frames = iconFiles.filter(item => item.size <= 48);
const header = Buffer.alloc(6 + 16 * frames.length);
header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach(({ size, buffer }, index) => {
  const at = 6 + index * 16;
  header[at] = size; header[at + 1] = size;
  header.writeUInt16LE(1, at + 4); header.writeUInt16LE(32, at + 6);
  header.writeUInt32LE(buffer.length, at + 8); header.writeUInt32LE(offset, at + 12);
  offset += buffer.length;
});
await writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([header, ...frames.map(item => item.buffer)]));

const escape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function textLayer(text, size, color, left, top, weight = 400) {
  const input = await sharp({ text: { text: `<span foreground="${color}" size="${size * 1024}" weight="${weight}">${escape(text)}</span>`, font: "Inter", fontfile, rgba: true, dpi: 72 } }).png().toBuffer();
  return { input, left, top };
}
for (const cover of covers) {
  const layers = [
    { input: svg(`<g transform="translate(0 0) scale(1.35)">${mark("#173c36", "#a9844b")}</g>`, 54, 54), left: 42, top: 40 },
    await textLayer("ПОТОЛКОВО", 31, "#173c36", 112, 48, 650),
    await textLayer(cover.eyebrow, 13, "#53675e", 48, 175, 500),
    await textLayer("Москва и область", 15, "#53675e", 48, 525),
    await textLayer("potolkovo-msk.ru", 16, "#173c36", 48, 555, 500),
  ];
  for (let i = 0; i < cover.lines.length; i++) {
    let size = 45;
    let layer = await textLayer(cover.lines[i], size, "#173c36", 45, 220 + i * 59, 500);
    while ((await sharp(layer.input).metadata()).width > 550 && size > 30) layer = await textLayer(cover.lines[i], --size, "#173c36", 45, 220 + i * 59, 500);
    if ((await sharp(layer.input).metadata()).width > 550) throw new Error(`Text too wide: ${cover.id}`);
    layers.push(layer);
  }
  if (cover.image) {
    const asset = assets[cover.image];
    if (!asset || asset.kind !== "ai-visualization") throw new Error(`Unexpected provenance: ${cover.id}`);
    const photo = await sharp(path.join(root, "design/brand/v7/originals", asset.source)).resize(560, 630, { fit: "cover", position: "centre", withoutEnlargement: true }).toBuffer();
    layers.push({ input: photo, left: 640, top: 0 });
    layers.push({ input: svg('<rect width="234" height="35" rx="3" fill="#f6f5ef"/>', 234, 35), left: 662, top: 572 });
    layers.push(await textLayer("Визуализация решения", 14, "#173c36", 675, 582));
  } else {
    layers.push({ input: svg(`<rect width="560" height="630" fill="#173c36"/><g transform="translate(117 125) scale(8)">${mark()}</g>`, 560, 630), left: 640, top: 0 });
  }
  const buffer = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#f6f5ef" } }).composite(layers).jpeg({ quality: 89, mozjpeg: true }).toBuffer();
  if (buffer.length > 200 * 1024) throw new Error(`Social cover exceeds 200KB: ${cover.id}`);
  await writeFile(path.join(out, "social", `${cover.id}.jpg`), buffer);
  console.log(`[brand-identity] ${cover.id}: 1200×630, ${Math.round(buffer.length / 1024)}KB`);
}
console.log("[brand-identity] icons: SVG, ICO 16/32/48, PNG 16/32/48/180/192/512; local Inter font");
