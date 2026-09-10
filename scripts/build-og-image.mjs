#!/usr/bin/env node
/**
 * N-062 · Картинка для соцсетей (F-30).
 *
 * В `og:image` уходил `public/hero1.jpeg` — 752 КБ и пропорции 3:2. Соцсети
 * ждут 1200×630 (примерно 1.91:1): всё, что не попадает в это соотношение,
 * они обрезают сами и обычно неудачно — по центру, отрезая верх и низ кадра.
 * Плюс три четверти мегабайта на превью, которое чаще всего так и не увидят.
 *
 * Скрипт режет hero в нужный формат один раз на сборке. Кадрирование —
 * `attention`: sharp выбирает область с наибольшей детализацией, а не
 * геометрический центр, поэтому потолок не срезается ради пустой стены.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "public/hero1.jpeg");
const OUT_DIR = path.join(ROOT, "public/optimized");
const OUT = path.join(OUT_DIR, "og-cover-1200x630.webp");

/** Требования соцсетей и бюджет веса. */
const WIDTH = 1200;
const HEIGHT = 630;
const MAX_KB = 200;

async function isFresh() {
  try {
    const [src, out] = await Promise.all([stat(SOURCE), stat(OUT)]);
    return out.mtimeMs >= src.mtimeMs;
  } catch {
    return false;
  }
}

async function main() {
  if (await isFresh()) {
    const { size } = await stat(OUT);
    console.log(`[og-image] ok — уже собрана, ${Math.round(size / 1024)} КБ`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  /**
   * Качество подбираем от большего: лучше отдать 190 КБ хорошей картинки,
   * чем сразу пережать до 60 КБ «на всякий случай».
   */
  let buffer = null;
  for (const quality of [82, 74, 66, 58, 50]) {
    buffer = await sharp(SOURCE)
      .resize(WIDTH, HEIGHT, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality })
      .toBuffer();

    if (buffer.length <= MAX_KB * 1024) {
      console.log(`[og-image] качество ${quality} → ${Math.round(buffer.length / 1024)} КБ`);
      break;
    }
  }

  if (!buffer || buffer.length > MAX_KB * 1024) {
    console.error(
      `[og-image] не удалось уложиться в ${MAX_KB} КБ (получилось ${Math.round((buffer?.length ?? 0) / 1024)} КБ)`
    );
    process.exit(1);
  }

  await writeFile(OUT, buffer);
  console.log(`[og-image] ok — ${WIDTH}×${HEIGHT}, ${Math.round(buffer.length / 1024)} КБ`);
}

main().catch((error) => {
  console.error(`[og-image] ${error?.message ?? error}`);
  process.exit(1);
});
