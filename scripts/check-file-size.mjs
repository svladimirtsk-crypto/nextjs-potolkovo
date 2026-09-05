#!/usr/bin/env node
/**
 * N-051 · Страж размера клиентских файлов.
 *
 * Правило ТЗ v2: новые файлы в `components/` и `app/` не длиннее 600 строк.
 * Разрастание до 2 000+ строк — то, из-за чего логика каталога разъехалась
 * двумя копиями и её стало невозможно тестировать.
 *
 * Существующие нарушения зафиксированы в LEGACY_BUDGET: их нельзя увеличивать
 * (иначе сборка падает), а по мере распила пороги опускаются. Так страж
 * работает сразу, не требуя переписать всё разом.
 */

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const LIMIT = 600;
const ROOTS = ["components", "app"];

/**
 * Файлы, которые уже длиннее лимита на момент ввода правила.
 * Значение — текущее число строк. Правки допустимы только в сторону
 * уменьшения; при росте страж падает.
 */
const LEGACY_BUDGET = {
  "components/calculator-modal/wizard-step1-lighting.tsx": 1685,
  "app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx": 1324,
  "components/home/action-form.tsx": 658,
  "components/calculator-modal/wizard-step2-summary.tsx": 609,
};

async function collect(dir, acc = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      await collect(full, acc);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      acc.push(full);
    }
  }
  return acc;
}

const files = (await Promise.all(ROOTS.map((root) => collect(root)))).flat();

const violations = [];
const shrunk = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n").length;
  const key = file.split(path.sep).join("/");
  const budget = LEGACY_BUDGET[key];

  if (budget === undefined) {
    if (lines > LIMIT) {
      violations.push(`${key}: ${lines} строк > ${LIMIT} (новый файл сверх лимита)`);
    }
    continue;
  }

  if (lines > budget) {
    violations.push(`${key}: ${lines} строк > зафиксированных ${budget} — файл вырос`);
  } else if (lines < budget) {
    shrunk.push(`${key}: ${lines} (бюджет ${budget}) — можно опустить порог`);
  }
}

if (shrunk.length > 0) {
  console.log("[file-size] файлы сократились:");
  for (const line of shrunk) console.log(`  ${line}`);
}

if (violations.length > 0) {
  console.error("[file-size] нарушения:");
  for (const line of violations) console.error(`  ${line}`);
  console.error(`\nЛимит ${LIMIT} строк. Вынесите часть кода в отдельный модуль.`);
  process.exit(1);
}

console.log(
  `[file-size] ok — проверено ${files.length} файлов, лимит ${LIMIT} строк, ` +
    `${Object.keys(LEGACY_BUDGET).length} legacy-исключения`
);
