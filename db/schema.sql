-- T-027 · Приложение Б. Схема хранения заявок.
-- Применять вручную (`psql -f db/schema.sql`) или через drizzle-kit push,
-- когда в проект добавят ORM. Пока приложение работает через lib/lead/store.ts:
-- при заданном DATABASE_URL пишет сюда, иначе — в память процесса.

create table if not exists leads (
  id            bigserial primary key,
  public_code   text not null unique,              -- короткий код для Telegram-ссылок, напр. "K7F3Q"
  created_at    timestamptz not null default now(),
  status        text not null default 'new',       -- new | draft | rescue | contacted | closed
  lead_kind     text not null,                     -- direct | calculator | lighting-only | rescue
  order_intent  text not null,                     -- ceiling_only | lighting_with_ceiling | lighting_only | advanced
  name          text,
  phone         text not null,
  address       text,
  preferred_time text,
  source        text not null,
  placement     text not null,
  page_path     text,
  service_slug  text,
  attribution   jsonb not null default '{}',       -- utm_*, yclid, gclid, first_landing, first_referrer
  snapshot      jsonb,                             -- LeadSnapshotV2
  totals        jsonb,                             -- Totals
  grand_total   integer,
  ip_hash       text,
  user_agent    text
);

create index if not exists leads_created_at_idx on leads (created_at desc);
create index if not exists leads_phone_created_idx on leads (phone, created_at desc);

create table if not exists lead_deliveries (
  id          bigserial primary key,
  lead_id     bigint not null references leads(id) on delete cascade,
  channel     text not null,                       -- telegram | web3forms
  status      text not null,                       -- pending | sent | failed
  attempts    int not null default 0,
  last_error  text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists lead_deliveries_retry_idx
  on lead_deliveries (status, created_at)
  where status = 'failed';
