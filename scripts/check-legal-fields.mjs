/**
 * T-047 · CI-страховка: реквизиты продавца заполнены.
 *
 * В коде они лежат как `TODO_OWNER` — сайт с такой заглушкой можно
 * разрабатывать, но нельзя релизить. Скрипт падает, если заглушка дожила
 * до продакшен-сборки (RELEASE=1 или CI-релизный пайплайн).
 */
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../content/contacts.ts", import.meta.url), "utf8");
/**
 * PT-006: ОГРНИП не обязателен — владелец самозанятый, и такого номера у него
 * нет. Требовать его значило бы вынудить вписать выдуманный: гейт, который
 * нельзя пройти честно, обходят, а не соблюдают.
 */
const required = ["legalName", "inn"];

const missing = required.filter((field) => {
  const match = source.match(new RegExp(`${field}:\\s*"([^"]*)"`));
  const value = match?.[1]?.trim() ?? "";
  return value.length === 0 || value.startsWith("TODO_OWNER");
});

if (missing.length > 0) {
  const message = `Не заполнены реквизиты в content/contacts.ts: ${missing.join(", ")}`;
  if (process.env.RELEASE === "1") {
    console.error(`✖ ${message}`);
    process.exit(1);
  }
  console.warn(`⚠ ${message} (для релиза запустите с RELEASE=1)`);
} else {
  console.log("✓ Реквизиты заполнены");
}
