#!/usr/bin/env node
/**
 * PT-019 (A-12, T-325) · гейт на «плавающие» E2E-тесты.
 *
 * В CI у Playwright включена одна повторная попытка (`retries: 1`) — она
 * спасает от сетевых флаков, но заодно прячет настоящие: тест упал, повторился,
 * прошёл, job зелёный. ТЗ требует обязательных гейтов «без плавающих
 * результатов», поэтому повторившийся тест считается здесь нарушением, а не
 * успехом.
 *
 * Читает JSON-отчёт Playwright (`test-results/results.json`, включён в
 * `playwright.config.ts` при `CI=1`) и печатает список тестов со статусом
 * `flaky`.
 *
 * Режимы (как у `check:env`, PT-006):
 *   RELEASE=1 — блокирующий: любой флак роняет job (main, quizv2ver1);
 *   иначе     — предупреждение: на фиче-ветке флак виден, но не мешает работе.
 *
 * Падения (`unexpected`) здесь не проверяются: их и так роняет сам Playwright.
 */
import { readFile } from "node:fs/promises";

const REPORT_PATH = process.env.E2E_REPORT ?? "test-results/results.json";
const strict = process.env.RELEASE === "1";

function walk(suites, path, acc) {
  for (const suite of suites ?? []) {
    const here = suite.title ? [...path, suite.title] : path;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === "flaky") {
          const attempts = (test.results ?? []).length;
          acc.push({ title: [...here, spec.title].join(" › "), attempts });
        }
      }
    }
    walk(suite.suites, here, acc);
  }
  return acc;
}

let raw;
try {
  raw = await readFile(REPORT_PATH, "utf8");
} catch (error) {
  const message = `[e2e-flaky] отчёт ${REPORT_PATH} не прочитан: ${error.code ?? error.message}`;
  if (strict) {
    // Без отчёта утверждать «флаков нет» нельзя — это и есть плавающий результат.
    console.error(message);
    console.error("[e2e-flaky] в блокирующем режиме отсутствие отчёта — падение.");
    process.exit(1);
  }
  console.warn(`${message} — пропускаю (не блокирующий режим).`);
  process.exit(0);
}

const report = JSON.parse(raw);
const stats = report.stats ?? {};
const flaky = walk(report.suites, [], []);

console.log(
  `[e2e-flaky] всего: ${stats.expected ?? 0} passed, ${stats.unexpected ?? 0} failed, ` +
    `${stats.flaky ?? 0} flaky, ${stats.skipped ?? 0} skipped`
);

if (flaky.length === 0) {
  console.log("[e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный");
  process.exit(0);
}

console.error(`[e2e-flaky] «плавающих» тестов: ${flaky.length}`);
for (const item of flaky) {
  console.error(`  - ${item.title} (попыток: ${item.attempts})`);
}

if (!strict) {
  console.warn(
    "[e2e-flaky] предупреждение: на фиче-ветке не блокирую. В main/quizv2ver1 (RELEASE=1) это падение."
  );
  process.exit(0);
}

console.error(
  "[e2e-flaky] ТЗ, строка 192: обязательные гейты без «плавающих» результатов. " +
    "Повторившийся тест надо либо починить, либо задокументировать причину и владельца " +
    "в реестре пропусков (README, «Реестр пропусков и повторов в тестах»)."
);
process.exit(1);
