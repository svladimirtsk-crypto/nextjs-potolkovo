/**
 * T-061 · Пайплайн изображений.
 *
 * Исходники в `public/*.jpeg` весят до 2,4 МБ штука (всего ~24 МБ) и грузятся
 * as-is: `next.config.ts` стоит с `images.unoptimized`, потому что хостинг без
 * оптимизатора. Поэтому пережимаем заранее, на сборке.
 *
 * Для каждого исходника генерируем WebP и AVIF в ширинах 480/960/1440 в
 * `public/optimized/` плюс крошечный blur-плейсхолдер (base64) — манифест с
 * размерами и плейсхолдерами кладём в `data/image-manifest.json`, чтобы
 * `<Picture>` мог отдать srcset и width/height без рантайм-чтения файлов.
 *
 * Идемпотентно: файл пересобирается, только если исходник новее результата.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const OUT_DIR = path.join(PUBLIC_DIR, "optimized");
const MANIFEST_PATH = path.join(ROOT, "data", "image-manifest.json");

const WIDTHS = [480, 960, 1440];

/**
 * Кейсы (`proj-*`) выводятся карточками в сетке — шире 960 CSS-пикселей они
 * не показываются ни на одном брейкпоинте. Гнать для них 1440 значило бы
 * тянуть лишние ~100 КБ ради невидимой детализации.
 */
const MAX_WIDTH_BY_PREFIX = [{ prefix: "proj-", maxWidth: 960 }];

/** Бюджеты из ТЗ: hero ≤ 150 КБ, кейсы ≤ 80 КБ (на самый широкий WebP). */
const BUDGETS_KB = [
  { test: (name) => name.startsWith("hero"), limitKb: 150, label: "hero" },
  { test: (name) => name.startsWith("proj-"), limitKb: 80, label: "кейс" },
];

/**
 * Качество подбирается адаптивно: стартуем с приятного глазу 72 и снижаем,
 * пока файл не влезет в бюджет. Фото интерьеров с мелкой фактурой (штукатурка,
 * дерево) жмутся заметно хуже гладких — фиксированное качество загоняло часть
 * кейсов в 250+ КБ.
 */
const WEBP_QUALITY_STEPS = [72, 64, 56, 48, 40];
const AVIF_QUALITY_STEPS = [50, 44, 38, 32];
const WEBP_EFFORT = 5;
const AVIF_EFFORT = 4;

async function isStale(source, target) {
  try {
    const [src, dst] = await Promise.all([stat(source), stat(target)]);
    return src.mtimeMs > dst.mtimeMs;
  } catch {
    return true;
  }
}

async function buildOne(fileName) {
  const source = path.join(PUBLIC_DIR, fileName);
  const base = fileName.replace(/\.jpe?g$/i, "");
  const image = sharp(source);
  const meta = await image.metadata();
  const originalWidth = meta.width ?? WIDTHS.at(-1);
  const originalHeight = meta.height ?? Math.round(originalWidth * 0.66);
  const aspect = originalHeight / originalWidth;

  // Апскейлить бессмысленно — нет исходного разрешения.
  const maxWidth =
    MAX_WIDTH_BY_PREFIX.find((r) => base.startsWith(r.prefix))?.maxWidth ?? Infinity;
  const widths = WIDTHS.filter((w) => w <= originalWidth && w <= maxWidth);
  if (widths.length === 0) widths.push(originalWidth);

  const generated = [];

  const budgetBytes = budgetForBase(base) * 1024;

  for (const width of widths) {
    for (const [format, steps, effort] of [
      ["webp", WEBP_QUALITY_STEPS, WEBP_EFFORT],
      ["avif", AVIF_QUALITY_STEPS, AVIF_EFFORT],
    ]) {
      const outName = `${base}-${width}.${format}`;
      const target = path.join(OUT_DIR, outName);

      if (await isStale(source, target)) {
        // Бюджет задан для самой широкой версии; узкие масштабируем пропорционально.
        const scaledBudget = budgetBytes * (width / widths.at(-1)) ** 1.6;

        for (const [index, quality] of steps.entries()) {
          await sharp(source)
            .resize({ width, withoutEnlargement: true })
            .toFormat(format, { quality, effort })
            .toFile(target);

          const { size } = await stat(target);
          // AVIF заметно меньше WebP — держим его в том же бюджете.
          if (size <= scaledBudget || index === steps.length - 1) break;
        }
      }

      const { size } = await stat(target);
      generated.push({ width, format, path: `/optimized/${outName}`, bytes: size });
    }
  }

  // Плейсхолдер: 16px WebP в data URI — десятки байт, снимает "белую дыру".
  const blurBuffer = await sharp(source)
    .resize({ width: 16 })
    .webp({ quality: 40 })
    .toBuffer();

  return {
    src: `/${fileName}`,
    base,
    width: originalWidth,
    height: originalHeight,
    aspect: Number(aspect.toFixed(4)),
    widths,
    blurDataURL: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
    generated,
  };
}

/** Бюджет (КБ) для самой широкой версии; для прочих картинок — мягкий дефолт. */
function budgetForBase(base) {
  return BUDGETS_KB.find((r) => r.test(base))?.limitKb ?? 200;
}

function checkBudget(entry) {
  const rule = BUDGETS_KB.find((r) => r.test(entry.base));
  if (!rule) return null;

  const widest = entry.generated
    .filter((g) => g.format === "webp")
    .sort((a, b) => b.width - a.width)[0];
  if (!widest) return null;

  const kb = widest.bytes / 1024;
  return kb > rule.limitKb
    ? `${entry.base}: ${rule.label} ${kb.toFixed(1)} КБ > ${rule.limitKb} КБ (${widest.path})`
    : null;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });

  const files = (await readdir(PUBLIC_DIR))
    .filter((f) => /\.jpe?g$/i.test(f))
    .sort();

  const manifest = {};
  const overBudget = [];

  for (const file of files) {
    const entry = await buildOne(file);
    manifest[entry.src] = {
      width: entry.width,
      height: entry.height,
      widths: entry.widths,
      blurDataURL: entry.blurDataURL,
    };

    const problem = checkBudget(entry);
    if (problem) overBudget.push(problem);
  }

  const json = JSON.stringify(manifest, null, 2);
  const hash = createHash("sha1").update(json).digest("hex").slice(0, 8);

  let previous = "";
  try {
    previous = await readFile(MANIFEST_PATH, "utf8");
  } catch {
    /* первого манифеста ещё нет */
  }
  if (previous !== json) await writeFile(MANIFEST_PATH, json);

  console.log(
    `[images] ${files.length} исходников → ${OUT_DIR.replace(ROOT + "/", "")} (манифест ${hash})`
  );

  if (overBudget.length > 0) {
    console.error("[images] превышены бюджеты:");
    for (const line of overBudget) console.error(`  ✖ ${line}`);
    process.exit(1);
  }

  console.log("[images] бюджеты соблюдены: hero ≤ 150 КБ, кейсы ≤ 80 КБ");
}

await main();
