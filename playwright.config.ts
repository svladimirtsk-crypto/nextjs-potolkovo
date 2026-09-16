import { defineConfig, devices } from "@playwright/test";

/**
 * T-090 · Конфигурация e2e.
 *
 * Два проекта, потому что критичные сценарии ведут себя по-разному на ширинах:
 * бар корзины на странице света существует только в мобильной раскладке, а
 * hero главной на десктопе показывает другой набор CTA.
 *
 * Гоняем по production-сборке (`npm run build && npm run start`), а не по dev:
 * dev-режим отличается гидрацией и таймингами, и в CI это даёт флаки.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,

  // В CI запрещаем `test.only` и даём одну повторную попытку на сетевые флаки.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  timeout: 45_000,
  expect: { timeout: 10_000 },

  /**
   * PT-019 (A-12, T-325): в CI кроме человекочитаемых отчётов пишем JSON —
   * его читает гейт `scripts/check-e2e-flaky.mjs`. Повторная попытка
   * (`retries: 1`) маскирует «плавающий» тест: job зеленеет, а флак остаётся.
   * Без отчёта узнать об этом нельзя.
   */
  reporter: process.env.CI
    ? [["github"], ["list"], ["json", { outputFile: "test-results/results.json" }]]
    : [["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
