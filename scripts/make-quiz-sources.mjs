/**
 * PT-046 · Производные исходники миниатюр квиза.
 *
 * Миниатюра в карточке варианта показывается не шире ~200 CSS px, поэтому
 * полноразмерный `proj-*` (до 2,4 МБ) для неё избыточен: он тянет в бандл
 * десятки килобайт, которых на экране не видно. Скрипт один раз делает из
 * утверждённого кадра аккуратный исходник шириной 480 px — дальше
 * `scripts/build-images.mjs` собирает из него `quiz-*-240/480.avif|webp`
 * по бюджету квиза (≤ 20 КБ на самый широкий WebP, PT-046).
 *
 * Почему отдельным шагом, а не «на лету» в пайплайне: исходник `quiz-*`
 * лежит в git и ревьюится глазами — если подмена кадра или кроп изменят
 * смысл миниатюры, это видно в диффе, а не только в собранных WebP.
 *
 * Атрибуция сохраняется: `SOURCES[].source` — тот самый `proj-*` из
 * `content/home-assets.ts`, `alt` берётся оттуда же, а не сочиняется.
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");

/** Ширина производного исходника: вдвое больше самого крупного варианта (480). */
const SOURCE_WIDTH = 480;

const SOURCES = [
  { target: "quiz-lines.jpeg", source: "proj-lines-1.jpeg" },
  { target: "quiz-cornice-hidden-niche.jpeg", source: "proj-cornice-1.jpeg" },
  // PT-039 (экран «Тип потолка») здесь намеренно отсутствует: в UX-R2 экран
  // уже показывает три схематичных разреза в одном языке (CeilingDiagram), и
  // подмешать туда фотографии значило бы смешать в одной группе фото и схемы —
  // против принципа «всё или ничего» раздела 4.
];

async function isFresh(source, target) {
  try {
    const [src, dst] = await Promise.all([stat(source), stat(target)]);
    return dst.mtimeMs > src.mtimeMs;
  } catch {
    return false;
  }
}

await mkdir(PUBLIC_DIR, { recursive: true });

let built = 0;
for (const { target, source } of SOURCES) {
  const from = path.join(PUBLIC_DIR, source);
  const to = path.join(PUBLIC_DIR, target);

  if (await isFresh(from, to)) continue;

  await sharp(from)
    .resize({ width: SOURCE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(to);

  const { size } = await stat(to);
  console.log(`[quiz] ${source} → ${target} (${Math.round(size / 1024)} КБ)`);
  built += 1;
}

console.log(
  built === 0
    ? "[quiz] производные исходники актуальны"
    : `[quiz] собрано производных исходников: ${built}`
);
