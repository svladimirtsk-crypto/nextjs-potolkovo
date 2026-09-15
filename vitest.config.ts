import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * PT-015 · Файлы, которым нужна настоящая БД.
 *
 * Все они работают с ОДНИМИ таблицами (`leads`, `lead_deliveries`,
 * `delivery_alerts`) и в `beforeEach` делают `DELETE` по всей таблице. Пока
 * таких файла было два, гонка почти не проявлялась; третий файл
 * (`tests/delivery-alert-db.test.ts`) сделал её воспроизводимой: в CI
 * параллельный работник удалял строки посреди чужого теста, и падали
 * `tests/lead-route-db.test.ts` (404 вместо 200, `undefined` вместо версии
 * политики) и `recordDelivery` (`row is undefined` — строка исчезла между
 * `SELECT` и `UPDATE`).
 *
 * Поэтому БД-файлы вынесены в отдельный проект с `fileParallelism: false`: они
 * идут строго по очереди, а остальные 70+ файлов по-прежнему параллельны.
 * Разделить их по разным схемам/базам нельзя — CI поднимает один
 * `postgres:17-alpine` с единственной базой `potolkovo_test`.
 */
const DB_TESTS = [
  "tests/lead-store-pg.test.ts",
  "tests/lead-route-db.test.ts",
  "tests/delivery-alert-db.test.ts",
];

export default defineConfig({
  test: {
    environment: "node",
    // `include` намеренно НЕ задан на корне: с определённым `projects` корневой
    // проект тоже собирал тесты, и каждый файл выполнялся дважды.
    projects: [
      {
        extends: true,
        test: {
          name: "db",
          include: DB_TESTS,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: [...DB_TESTS, "**/node_modules/**", "**/dist/**"],
        },
      },
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
