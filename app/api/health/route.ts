/**
 * PT-001 · Health/readiness эндпоинт.
 *
 * Раньше отличить «приложение не поднялось» от «приложение работает, но
 * заявки падают в память» можно было только по косвенным признакам: главная
 * отдаёт 200 — и всё. Причина недоступности 09–10.09 оказалась бытовой
 * (не оплачен хостинг), но она же показала, что диагностического следа нет
 * вовсе: ни внешний монитор, ни владелец не увидели бы разницы между
 * «сервис остановлен» и «сервис работает без базы».
 *
 * Эндпоинт отвечает на два разных вопроса:
 *   `ok`    — процесс жив и способен обслуживать запросы;
 *   `ready` — заявки действительно будут сохранены (есть БД).
 *
 * Разделение намеренное. Сайт с недоступной базой обязан оставаться в сети:
 * каталог, цены и страницы услуг работают, а форма честно откажет (PT-002).
 * Поэтому `ok: true, ready: false` — валидное состояние, при котором монитор
 * должен разбудить владельца, но не перезапускать контейнер.
 */
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Момент старта процесса — по нему видно, был ли рестарт между проверками. */
const STARTED_AT = Date.now();

export async function GET() {
  const env = getEnv();

  const storage: "db" | "memory" = env.DATABASE_URL ? "db" : "memory";

  /**
   * Только факт наличия конфигурации, никаких значений: эндпоинт публичный,
   * и по нему не должно быть видно ни токена, ни строки подключения.
   */
  const deliveryChannels = {
    telegram: Boolean(
      env.TELEGRAM_LEADS_ENABLED && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
    ),
    web3forms: Boolean(env.WEB3FORMS_ACCESS_KEY),
  };

  const ready = storage === "db";

  return NextResponse.json(
    {
      ok: true,
      ready,
      storage,
      deliveryChannels,
      // Короткий SHA сборки, если платформа его прокинула: по нему видно,
      // какая версия реально крутится, без доступа к панели хостинга.
      buildSha: (process.env.BUILD_SHA ?? process.env.GIT_SHA ?? "unknown").slice(0, 12),
      uptimeSec: Math.round((Date.now() - STARTED_AT) / 1000),
    },
    {
      status: 200,
      // Ответ обязан быть моментальным снимком, а не кэшем с прошлого деплоя.
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
