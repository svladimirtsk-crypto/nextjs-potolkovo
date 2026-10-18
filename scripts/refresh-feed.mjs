#!/usr/bin/env node
/**
 * N-041 · Обновление каталога поставщика (F-44).
 *
 * Фид выгружался вручную, и это главная причина, по которой цены тихо
 * стареют: пока никто не вспомнит — на сайте висит прайс полугодовой
 * давности, а клиент читает суммы как действующие.
 *
 * Скрипт скачивает фид, нормализует его в тот же формат, что лежит в
 * `data/eks-feed2-snapshot.json`, и пересобирает производные файлы. Дальше
 * его запускает workflow по расписанию и открывает PR — правки каталога
 * должны проходить ревью, а не приезжать в main молча.
 *
 * Запуск:
 *   FEED_URL="https://…" node scripts/refresh-feed.mjs
 *   node scripts/refresh-feed.mjs --dry-run   # только показать диффы
 *   node scripts/refresh-feed.mjs --check     # проверить staging, ничего не публиковать
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = resolve(ROOT, "data/eks-feed2-snapshot.json");

const DRY_RUN = process.argv.includes("--dry-run");
const CHECK_ONLY = process.argv.includes("--check");
/** Сколько строк дельты цен показать в теле PR. */
const TOP_CHANGES = 20;

function fail(message) {
  console.error(`[refresh-feed] ${message}`);
  process.exit(1);
}

function text(value) {
  return String(value ?? "");
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function downloadFeed(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "potolkovo-refresh-feed" },
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) fail(`фид недоступен: HTTP ${res.status}`);
  return res.json();
}

/**
 * Приводит выгрузку к форме снапшота.
 *
 * Namespace полей у поставщика меняется от версии к версии, поэтому берём
 * первый непустой из известных вариантов, а не жёстко один ключ.
 */
function normalizeFeed(raw, before) {
  const products = Array.isArray(raw?.products)
    ? raw.products
    : Array.isArray(raw?.offers)
      ? raw.offers
      : null;

  if (!products) fail("в ответе нет ни products, ни offers — формат фида изменился");
  if (products.length === 0) fail("фид пустой — не перезаписываю рабочий снапшот");

  const codes = new Set();
  const ids = new Set();
  for (const [index, product] of products.entries()) {
    const id = text(product?.productId).trim();
    const code = text(product?.vendorCode).trim();
    const price = Number(product?.priceRub);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) || !code || !text(product?.name).trim() ||
        !Number.isFinite(price) || price <= 0 || codes.has(code) || ids.has(id)) {
      fail(`неполная/дублирующаяся позиция №${index + 1} (id, SKU, название или цена) — не заменяю снапшот`);
    }
    // Скачивание обложек из фида не должно обращаться к произвольному хосту.
    const cover = text(product?.coverImage).trim();
    if (cover && !cover.startsWith("https://eksmarket.ru/")) {
      fail(`обложка позиции №${index + 1} не с HTTPS-хоста EKS — не заменяю снапшот`);
    }
    codes.add(code);
    ids.add(id);
  }

  return {
    updatedAt: text(raw.updatedAt || raw.date || new Date().toISOString()),
    source: text(raw.source || "eks-feed2"),
    // Скидка при заказе потолка — правило нашего сайта, не параметр поставщика.
    // Не теряем его (и справочник категорий) при обновлении только offers.
    ...(Number.isFinite(before.discountPercentForCeilingOrder)
      ? { discountPercentForCeilingOrder: before.discountPercentForCeilingOrder }
      : {}),
    categories: Array.isArray(raw.categories) && raw.categories.length > 0
      ? raw.categories : (Array.isArray(before.categories) ? before.categories : []),
    products,
  };
}

/** Топ подорожаний и удешевлений — то, ради чего PR вообще смотрят. */
function diffPrices(before, after) {
  const oldPrices = new Map(
    (before.products ?? []).map((p) => [text(p.vendorCode || p.productId), num(p.priceRub)])
  );

  const changes = [];
  let added = 0;

  for (const product of after.products) {
    const key = text(product.vendorCode || product.productId);
    const now = num(product.priceRub);
    const was = oldPrices.get(key);

    if (was === undefined) {
      added += 1;
      continue;
    }

    /**
     * Ключ вычёркиваем сразу: остаток map — это то, чего в новом фиде нет.
     * Раньше удаление стояло после проверки на изменение цены, и товары с
     * неизменной ценой попадали в «пропало из фида» — счётчик показывал 543
     * пропажи на 547 позиций.
     */
    oldPrices.delete(key);

    if (was === now || was === 0) continue;

    changes.push({
      name: text(product.name).replace(/[\r\n\x00-\x1f]+/g, " ").replace(/\s+/g, " ").slice(0, 140),
      was,
      now,
      deltaPct: ((now - was) / was) * 100,
    });
  }

  return { changes, added, removed: oldPrices.size };
}

function formatReport({ changes, added, removed }) {
  const lines = [];
  lines.push(`Новых позиций: ${added}`);
  lines.push(`Пропало из фида: ${removed}`);
  lines.push(`Изменились в цене: ${changes.length}`);

  const top = [...changes]
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, TOP_CHANGES);

  if (top.length) {
    lines.push("", `Топ-${top.length} изменений цены:`);
    for (const item of top) {
      const sign = item.deltaPct > 0 ? "+" : "";
      lines.push(
        `- ${item.name}: ${item.was} → ${item.now} ₽ (${sign}${item.deltaPct.toFixed(1)} %)`
      );
    }
  }

  return lines.join("\n");
}

const VALIDATION_INPUTS = [
  "scripts/validate-catalog.mjs",
  "scripts/build-catalog-index.mjs",
  "scripts/build-catalog-images.mjs",
  "data/catalog-retired.json",
  "content/catalog-retired.json",
  "lib/catalog-ui-config.ts",
  "lib/vendor-code-overrides.ts",
  "app/uslugi/prodazha-trekovogo-osveshcheniya/_components/LightKitShowcase.tsx",
];

/**
 * LED-26 · Все валидаторы и сборщики работают с копией каталога в /tmp.
 * Ни снапшот, ни индекс, ни обложки рабочего дерева до их успеха не меняются.
 * PR по-прежнему требует ревью: это защита локального last-known-good, а не
 * подтверждение цены, упаковки, склада или транзакция нескольких файлов ОС.
 */
function prepareStage(candidate) {
  const stage = mkdtempSync(join(tmpdir(), "potolkovo-feed-"));
  try {
    for (const rel of VALIDATION_INPUTS) {
      const source = resolve(ROOT, rel);
      if (!existsSync(source)) continue;
      const dest = resolve(stage, rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(source, dest);
    }
    const originalImages = resolve(ROOT, "public/catalog");
    const stageImages = resolve(stage, "public/catalog");
    if (existsSync(originalImages)) cpSync(originalImages, stageImages, { recursive: true });
    else mkdirSync(stageImages, { recursive: true });
    // sharp зависит от локальных node_modules; staging не копирует их в /tmp.
    symlinkSync(resolve(ROOT, "node_modules"), resolve(stage, "node_modules"), "dir");
    writeFileSync(resolve(stage, "data/eks-feed2-snapshot.json"), `${JSON.stringify(candidate, null, 2)}\n`);
    return stage;
  } catch (error) {
    rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function runStaged(stage, script) {
  console.log(`[refresh-feed] staging: ${script}`);
  execFileSync(process.execPath, [resolve(stage, "scripts", script)], { stdio: "inherit", cwd: stage });
}

function atomicWrite(dest, content) {
  mkdirSync(dirname(dest), { recursive: true });
  const tmp = join(dirname(dest), `.${basename(dest)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    writeFileSync(tmp, content);
    renameSync(tmp, dest);
  } finally {
    rmSync(tmp, { force: true });
  }
}

function publishStage(stage, report) {
  const stagedImages = resolve(stage, "public/catalog");
  const imageOutputs = readdirSync(stagedImages, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => `public/catalog/${entry.name}`)
    .filter((rel) => {
      const candidate = readFileSync(resolve(stage, rel));
      const live = resolve(ROOT, rel);
      return !existsSync(live) || !candidate.equals(readFileSync(live));
    });

  const dataOutputs = [
    "data/catalog-retired.json", "data/catalog-index.json", "data/catalog-prefill.json",
    "data/proof-pricing-inputs.json", "data/catalog-images.json",
    "data/catalog-images-missing.json", "data/eks-feed2-snapshot.json",
  ];
  const outputs = [
    ...imageOutputs.map((rel) => ({ rel, content: readFileSync(resolve(stage, rel)) })),
    ...dataOutputs.map((rel) => ({ rel, content: readFileSync(resolve(stage, rel)) })),
    { rel: "feed-diff.md", content: Buffer.from(`${report}\n`) },
  ];
  const backups = new Map(outputs.map(({ rel }) => [rel, existsSync(resolve(ROOT, rel)) ? readFileSync(resolve(ROOT, rel)) : null]));
  const published = [];
  try {
    for (const { rel, content } of outputs) {
      atomicWrite(resolve(ROOT, rel), content);
      published.push(rel);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const rel of published.reverse()) {
      try {
        const previous = backups.get(rel);
        if (previous === null || previous === undefined) rmSync(resolve(ROOT, rel), { force: true });
        else atomicWrite(resolve(ROOT, rel), previous);
      } catch (rollbackError) {
        rollbackErrors.push(`${rel}: ${rollbackError?.message ?? rollbackError}`);
      }
    }
    if (rollbackErrors.length) throw new Error(`сбой публикации и отката: ${rollbackErrors.join("; ")}`, { cause: error });
    throw error;
  }
}

async function main() {
  const url = process.env.FEED_URL;
  if (!url) fail("не задан FEED_URL (секрет репозитория)");

  const before = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const after = normalizeFeed(await downloadFeed(url), before);

  /**
   * Резкое сокращение каталога почти всегда означает сбой выгрузки, а не то,
   * что поставщик распродал половину ассортимента. Перезаписать снапшот в
   * таком случае — значит потерять рабочие данные.
   */
  const beforeCount = (before.products ?? []).length;
  if (after.products.length < beforeCount * 0.5) {
    fail(
      `в новом фиде ${after.products.length} товаров против ${beforeCount} — похоже на сбой выгрузки`
    );
  }

  const report = formatReport(diffPrices(before, after));
  console.log(`\n${report}\n`);

  if (DRY_RUN) {
    console.log("[refresh-feed] dry-run: снапшот не тронут");
    return;
  }

  const stage = prepareStage(after);
  try {
    // При провале любого этапа в /tmp рабочий snapshot/индекс/картинки не тронуты.
    runStaged(stage, "validate-catalog.mjs");
    runStaged(stage, "build-catalog-index.mjs");
    runStaged(stage, "build-catalog-images.mjs");
    if (CHECK_ONLY) {
      console.log("[refresh-feed] check-only: staging прошёл, рабочие файлы не менялись");
      return;
    }
    publishStage(stage, report);
    console.log("[refresh-feed] готово к PR и ручному ревью, не опубликовано в production");
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

main().catch((error) => fail(error?.message ?? String(error)));
