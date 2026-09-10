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
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SNAPSHOT = resolve(ROOT, "data/eks-feed2-snapshot.json");

const DRY_RUN = process.argv.includes("--dry-run");
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
function normalizeFeed(raw) {
  const products = Array.isArray(raw?.products)
    ? raw.products
    : Array.isArray(raw?.offers)
      ? raw.offers
      : null;

  if (!products) fail("в ответе нет ни products, ни offers — формат фида изменился");
  if (products.length === 0) fail("фид пустой — не перезаписываю рабочий снапшот");

  return {
    updatedAt: text(raw.updatedAt || raw.date || new Date().toISOString()),
    source: text(raw.source || "eks-feed2"),
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
      name: text(product.name),
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

function run(script) {
  console.log(`[refresh-feed] ${script}`);
  execFileSync("node", [resolve(ROOT, "scripts", script)], { stdio: "inherit" });
}

async function main() {
  const url = process.env.FEED_URL;
  if (!url) fail("не задан FEED_URL (секрет репозитория)");

  const before = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
  const after = normalizeFeed(await downloadFeed(url));

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

  writeFileSync(SNAPSHOT, `${JSON.stringify(after, null, 2)}\n`, "utf8");

  // Порядок важен: валидация до сборки производных файлов.
  run("validate-catalog.mjs");
  run("build-catalog-index.mjs");
  run("build-catalog-images.mjs");

  // Тело PR читает workflow.
  writeFileSync(resolve(ROOT, "feed-diff.md"), `${report}\n`, "utf8");
  console.log("[refresh-feed] готово");
}

main().catch((error) => fail(error?.message ?? String(error)));
