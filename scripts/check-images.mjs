/**
 * T-061 · Проверка целостности картинок.
 *
 * Ловит две регрессии, которые иначе видно только глазами в проде:
 *  1) в коде/контенте есть ссылка на `/что-то.jpeg`, а файла в `public` нет;
 *  2) исходник есть, но для него не собраны варианты в `public/optimized`
 *     (значит `npm run build:images` забыли прогнать после добавления фото).
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(ROOT, "data", "image-manifest.json");
const SCAN_DIRS = ["app", "components", "content", "lib"];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

async function main() {
  const problems = [];

  const files = (await Promise.all(SCAN_DIRS.map((d) => walk(path.join(ROOT, d))))).flat();
  const referenced = new Set();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/["'`](\/[\w./-]+\.jpe?g)["'`]/g)) {
      referenced.add(match[1]);
    }
  }

  // 1. Ссылки без файла.
  for (const ref of referenced) {
    try {
      await stat(path.join(PUBLIC_DIR, ref.replace(/^\//, "")));
    } catch {
      problems.push(`нет файла для ссылки ${ref}`);
    }
  }

  // 2. Исходники без собранных вариантов.
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    problems.push("нет data/image-manifest.json — запустите npm run build:images");
  }

  const sources = (await readdir(PUBLIC_DIR)).filter((f) => /\.jpe?g$/i.test(f));
  for (const source of sources) {
    const key = `/${source}`;
    const entry = manifest[key];
    if (!entry) {
      problems.push(`${source} нет в манифесте — запустите npm run build:images`);
      continue;
    }
    for (const width of entry.widths) {
      const base = source.replace(/\.jpe?g$/i, "");
      for (const format of ["webp", "avif"]) {
        try {
          await stat(path.join(PUBLIC_DIR, "optimized", `${base}-${width}.${format}`));
        } catch {
          problems.push(`нет ${base}-${width}.${format}`);
        }
      }
    }
  }

  if (problems.length > 0) {
    console.error("[images] проблемы:");
    for (const p of problems) console.error(`  ✖ ${p}`);
    process.exit(1);
  }

  console.log(
    `[images] ok — ${referenced.size} ссылок, ${sources.length} исходников, варианты на месте`
  );
}

await main();
