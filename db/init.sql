-- ============================================================
-- ПОТОЛКОВО · создание таблиц для заявок
--
-- Готовый SQL на случай, когда нет возможности запустить
-- `npx drizzle-kit push` (нет Node.js на машине владельца).
-- Полностью соответствует `db/schema.ts` — при изменении схемы
-- обновлять оба файла.
--
-- Как применить: открыть pgAdmin (кнопка «Деплой pgAdmin» в панели
-- Amvera), подключиться к базе, вставить этот текст в Query Tool
-- и нажать «Выполнить».
--
-- Скрипт безопасно запускать повторно: IF NOT EXISTS не даст
-- создать дубликаты и не тронет уже накопленные заявки.
-- ============================================================

-- Заявки с сайта.
CREATE TABLE IF NOT EXISTS leads (
  id             bigserial PRIMARY KEY,
  -- Короткий код для разговора по телефону, напр. "K7F3Q".
  public_code    text        NOT NULL UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  status         text        NOT NULL DEFAULT 'new',
  lead_kind      text        NOT NULL,
  order_intent   text        NOT NULL,
  name           text,
  phone          text        NOT NULL,
  address        text,
  preferred_time text,
  source         text        NOT NULL,
  placement      text        NOT NULL,
  page_path      text,
  service_slug   text,
  -- utm_*, yclid, gclid, first_landing, first_referrer
  attribution    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  -- Полный расчёт: комнаты, корзина света, суммы.
  snapshot       jsonb,
  totals         jsonb,
  grand_total    integer,
  ip_hash        text,
  user_agent     text,
  -- PT-009: ключ идемпотентности, один на попытку отправки.
  request_id     text,
  -- PT-009: sha256 канонического payload заявки.
  payload_hash   text
);

-- ============================================================
-- МИГРАЦИЯ PT-009 · идемпотентность вместо дедупа по телефону
--
-- Для базы, которая уже существует (создана предыдущей версией
-- скрипта): там `CREATE TABLE IF NOT EXISTS` выше не делает ничего,
-- и эти две колонки добавляются здесь. Для новой базы они уже есть
-- в CREATE TABLE, и `IF NOT EXISTS` просто ничего не сделает.
--
-- Блок ОБЯЗАН стоять до индексов ниже: индексы `leads_request_id_key`
-- и `leads_phone_hash_created_idx` строятся по этим колонкам, и на
-- существующей базе без него они упали бы с
-- `column "request_id" does not exist`.
--
-- Миграция расширяющая (раздел 3.8 ТЗ): колонки nullable и без
-- DEFAULT, поэтому PostgreSQL меняет только метаданные — существующие
-- строки не перезаписываются и таблица не блокируется на заметное
-- время. Откат кода на предыдущую версию безопасен: старые запросы
-- этих колонок не читают и не пишут.
-- ============================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS request_id   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payload_hash text;

-- Свежие заявки сверху — основной экран мастера.
CREATE INDEX IF NOT EXISTS leads_created_at_idx
  ON leads (created_at DESC);

-- Дедуп: не создавать вторую заявку, если человек нажал «отправить» дважды.
CREATE INDEX IF NOT EXISTS leads_phone_created_idx
  ON leads (phone, created_at DESC);

-- Серверный rate-limit: сколько заявок с одного IP за окно.
CREATE INDEX IF NOT EXISTS leads_ip_created_idx
  ON leads (ip_hash, created_at DESC);

-- PT-009: повтор того же request_id не создаёт вторую заявку даже при
-- одновременной вставке двумя запросами — гонку ловит ограничение.
-- В PostgreSQL NULL-значения в unique-индексе считаются различными, поэтому
-- уже накопленные заявки (request_id IS NULL) ограничению не мешают.
CREATE UNIQUE INDEX IF NOT EXISTS leads_request_id_key
  ON leads (request_id);

-- PT-009: дедуп ищет недавнюю заявку с тем же телефоном И тем же содержимым.
CREATE INDEX IF NOT EXISTS leads_phone_hash_created_idx
  ON leads (phone, payload_hash, created_at DESC);

-- Доставка заявки по каналам (Telegram, Web3Forms).
CREATE TABLE IF NOT EXISTS lead_deliveries (
  id         bigserial PRIMARY KEY,
  -- Удаление заявки уносит и записи о её доставке.
  lead_id    bigint      NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  channel    text        NOT NULL,
  status     text        NOT NULL,
  attempts   integer     NOT NULL DEFAULT 0,
  last_error text,
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Крон повторной доставки ищет по нему упавшие отправки.
CREATE INDEX IF NOT EXISTS lead_deliveries_status_idx
  ON lead_deliveries (status, created_at);
