import type { Config } from "drizzle-kit";

/**
 * N-001 · Конфиг drizzle-kit. Применение схемы: `npx drizzle-kit push`.
 * `DATABASE_URL` берётся из окружения (см. .env.example).
 */
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
