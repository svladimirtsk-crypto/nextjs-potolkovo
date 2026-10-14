#!/usr/bin/env node
/**
 * N-062 · Реальные даты правки страниц для sitemap (F-30).
 *
 * `lastModified` для главной и статических страниц брался как `new Date()` —
 * то есть дата сборки. Поисковик видит, что страница «изменилась» при каждом
 * деплое, и перестаёт доверять этому полю: если всё меняется всегда, значит
 * не меняется ничего.
 *
 * Скрипт берёт дату последнего коммита, который реально затронул файлы
 * страницы, и складывает в `data/page-dates.json`.
 *
 * Если git недоступен (сборка из архива, shallow clone без истории) — файл
 * не переписывается, а sitemap падает обратно на дату сборки. Это хуже, но
 * лучше, чем уронить сборку из-за метаданных.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "data/page-dates.json");

/**
 * Страница → файлы, правка которых означает изменение страницы.
 * Контент важнее разметки, поэтому в списке и то, и другое.
 */
const PAGES = {
  "/": ["app/page.tsx", "components/home", "content/homepage.ts"],
  "/uslugi": ["app/uslugi/page.tsx", "content/services.ts"],
  "/privacy": ["app/privacy"],
};

function lastCommitDate(paths) {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cI", "--", ...paths],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();

    return out || null;
  } catch {
    return null;
  }
}

const dates = {};
let resolved = 0;

for (const [route, paths] of Object.entries(PAGES)) {
  const date = lastCommitDate(paths);
  if (date) {
    dates[route] = date;
    resolved += 1;
  }
}

if (resolved === 0) {
  console.warn("[page-dates] git недоступен — sitemap останется на дате сборки");
  process.exit(0);
}

writeFileSync(OUT, `${JSON.stringify(dates, null, 2)}\n`, "utf8");
console.log(`[page-dates] ok — ${resolved} страниц: ${Object.keys(dates).join(", ")}`);
