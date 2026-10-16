import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Артефакты этапов, перенесённые в repo: скрипты снятия аудита (.cjs с
     * require), исходники бренда и выгрузки поставщика. Это сохранённые
     * доказательства и сырые данные, а не исходники приложения — правила
     * eslint-config-next к ним не применяются.
     */
    "docs/evidence/**",
  ]),
]);

export default eslintConfig;
