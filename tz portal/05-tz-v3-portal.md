# ТЗ v3 · ПОТОЛКОВО → потолочный портал с админкой, статьями и продажами

**Версия:** 3.0 · **База:** ветка `quizv2ver1` после закрытия ТЗ v2 фазы A (минимум N‑001, N‑003) · **Основание:** аудит №3 (`04-audit-koda-portal.md`), аудиты №1–2, ТЗ v2.
**Стек:** Next.js 16 (App Router) · React 19 · Tailwind 4 · TypeScript · **PostgreSQL + Drizzle ORM** · vitest · Playwright · S3‑совместимое хранилище файлов.
**Отношение к v2:** документ **не отменяет** ТЗ v2. Задачи фазы B/C v2 (N‑010…N‑063) выполняются параллельно или сливаются с P‑04x (дизайн) — см. § 9.

---

## 0. Правила для исполнителя (ИИ‑агента или команды)

0.1. **Ветка** `portal-v3`. Один коммит = одна задача `P‑xxx`; сообщение `P-012: короткое описание`.
0.2. **Порядок этапов:** E0 (пререквизиты) → E1 (фундамент) → E2 (контент в БД) → E3 (админка) → E4 (статьи) → E5 (дизайн‑система и IA портала) → E6 (SEO/perf) → E7 (коммерция). Этап не начинается, пока предыдущий не зелёный. Внутри этапа задачи независимы, если не указано `⟵ зависит от`.
0.3. **Разрешённые зависимости (сверх v2):** `drizzle-orm`, `pg`, `drizzle-kit`, `zod` (уже есть), `marked` или `react-markdown` + `rehype-sanitize` (рендер статей), `@aws-sdk/client-s3` (медиа), `sharp` (уже есть), `bcryptjs` (пароли), `iron-session` **или** собственная HMAC‑cookie (одно из двух). Любая другая зависимость — отдельным обоснованием в PR.
0.4. **Фиче‑флаг `CONTENT_SOURCE=static|db`** (env, по умолчанию `static` до конца E2). Витрина обязана работать в обоих режимах, пока флаг существует. Флаг удаляется задачей P‑019.
0.5. **Инварианты, которые нельзя нарушить ни в одной задаче:**
   - `grand = ceilingApplied + extraInstallRub + lightingEffective` (v1/T‑030).
   - Один источник цен. После P‑011 — таблица `price_items`; `content/pricing.ts` остаётся **только** как типы и дефолтный сид.
   - `/api/lead` не меняет контракт (`{ ok, leadId, callbackWindow }`).
   - Бюджет First Load JS главной ≤ 300 КБ; админка — отдельный route‑group, её бандл в бюджет не входит.
   - Никакого `setState` в `useEffect` для синхронизации; файлы ≤ 600 строк.
0.6. **Зелёное состояние этапа:**
```
npm run lint && npx tsc --noEmit
npm run test                 # vitest, включая tests/db/* (пропуск без TEST_DATABASE_URL)
npm run test:e2e             # 16 сценариев v2 + сценарии P‑xxx
npm run build && npm run check:bundle
npx drizzle-kit check        # схема соответствует миграциям
npm run check:content-parity # E2: сид === content/*.ts (до удаления модулей)
```
0.7. **Отчёт по этапу** — `PHASE-E{n}-REPORT.md`: что сделано, что не сделано, скриншоты админки (📸) и витрины до/после.
0.8. **Безопасность:** секреты только в env; пароли — bcrypt (cost 12); cookie сессии `HttpOnly; Secure; SameSite=Lax`; CSRF — через Server Actions (origin‑check Next) + для REST‑маршрутов `/api/admin/*` — заголовок `X‑Requested‑With` и проверка сессии; загрузка файлов — только image/*, ≤ 10 МБ, пересжатие `sharp` на сервере (снимает EXIF и полиглоты).

---

## 1. Концепция портала и целевые метрики

### 1.1. Что такое «портал» в рамках этого ТЗ

Один домен `potolkovo-msk.ru`, пять контуров:

| Контур | Что это | Монетизация | Этап |
|---|---|---|---|
| **Услуги** (есть) | 9 страниц + калькулятор + заявка | заявка → монтаж | E2 (переезд в БД) |
| **Работы** (есть частично) | каталог объектов: фото, параметры, «хочу так же» → калькулятор с пресетом | доверие → заявка | E2, E5 |
| **Освещение** (есть частично) | каталог товаров из фида, комплекты‑офферы, корзина | заявка на комплект → E7 оплата | E2, E7 |
| **Статьи** (нет) | база знаний: «как выбрать», «сколько стоит», «ошибки», сравнение систем; каждая статья ведёт на услугу/комплект/калькулятор | SEO‑трафик → калькулятор | E4 |
| **Админка** (нет) | владелец редактирует всё выше без разработчика | сокращение time‑to‑change с «дни» до «минуты» | E1, E3 |

### 1.2. Целевые метрики v3

| Метрика | Сейчас | Цель | Как измеряем |
|---|---|---|---|
| Время изменения цены до появления на сайте | 1 деплой (≈ 15–40 мин + разработчик) | ≤ 60 с, без разработчика | ручной прогон: правка в админке → страница услуги/калькулятор |
| Источников правды по ценам | 3 | 1 (`price_items`) | grep литералов вне `price_items`/сида → 0 |
| Сущностей, редактируемых владельцем | 0 | 8 (цены, услуги, комплекты, работы, статьи, отзывы, настройки, доступность) | чек‑лист E3 |
| Заявки, сохранённые в БД | 0 % | 100 % | N‑001 + `admin/leads` |
| Статей опубликовано за 3 месяца после E4 | 0 | ≥ 12, каждая с CTA на калькулятор | `articles.status = published` |
| Органический трафик на статьи | 0 | ≥ 30 % визитов через 6 мес. | Метрика, сегмент `page_path ^= /stati` |
| Доля визитов с открытием калькулятора | цель v1 — 25 % | ≥ 25 % (не ухудшить) | `calculator_open / visits` |
| Lighthouse mobile (главная, услуга, статья) | — | Perf ≥ 85, A11y ≥ 95, SEO 100 | CI (lighthouse‑ci, 1 раз в неделю) |
| First Load JS главной | 212 КБ | ≤ 300 КБ (не растёт из‑за портала) | `check:bundle` |

---

## 2. Архитектура целевого состояния

### 2.1. Слои

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Витрина (app/(site)/**)   ISR/SSR, читает ТОЛЬКО lib/content/* репозитории  │
│  Админка (app/admin/**)    SSR + Server Actions, роли owner/editor           │
│  API      (app/api/**)     /api/lead, /api/pricing, /api/catalog, /api/cron │
├──────────────────────────────────────────────────────────────────────────────┤
│  Домен (lib/**)  calculator (редьюсер/селекторы) · lighting (kit-rules)     │
│                  lead (store, deliver) · content/* (репозитории + кэш)       │
│                  media (upload, resize) · auth (session, rbac) · audit      │
├──────────────────────────────────────────────────────────────────────────────┤
│  Данные   PostgreSQL (Drizzle, 14 таблиц)  ·  S3 (медиа)  ·  фид EKS (cron) │
└──────────────────────────────────────────────────────────────────────────────┘
```

Правила слоёв:
- Витрина и админка **не импортируют `@/db` напрямую** — только через `lib/content/<entity>.ts` (репозиторий). Репозиторий отвечает за кэш (`unstable_cache` + `revalidateTag('<entity>')`) и за fallback на статический сид при `CONTENT_SOURCE=static`.
- Калькулятор получает прайс через `getPricing()` (асинхронно на сервере → пробрасывается в клиентский стор одним объектом `Pricing`). Внутри клиента прайс — **данные**, не импорт модуля.
- Админка пишет в БД через Server Actions в `app/admin/_actions/<entity>.ts`; каждый action: `requireRole('editor')` → `zod.parse` → транзакция → `audit_log` → `revalidateTag`.

### 2.2. Рендеринг

| Тип страницы | Стратегия | Инвалидация |
|---|---|---|
| Главная, хаб услуг, услуга, комплект, работа, статья, рубрика | **ISR** (`revalidate = 3600`) + `revalidateTag` из админки (мгновенно) | tag = имя сущности (`services`, `pricing`, `articles`…) |
| Каталог товаров, поиск | SSR с кэшем на 15 мин (`unstable_cache`) | cron импорта фида → `revalidateTag('products')` |
| Админка | `dynamic = 'force-dynamic'`, `noindex`, `robots: disallow /admin` | — |
| `/api/pricing`, `/api/catalog` | `Cache-Control: s-maxage=300, stale-while-revalidate` | tag |
| sitemap, robots, RSS статей | динамика из БД, кэш 1 час | — |

### 2.3. Схема БД (Drizzle, `db/schema.ts`)

Идентификаторы: `bigserial` для внутренних, `slug text unique` для публичных. Везде `created_at/updated_at timestamptz`, `status text` из enum‑набора (`draft | published | archived`), где применимо — `sort int`.

| Таблица | Ключевые поля | Назначение |
|---|---|---|
| `settings` | `key pk`, `value jsonb`, `updated_at` | контакты, реквизиты, часы работы, availability, флаги, тексты футера/шапки |
| `price_items` | `key unique` (`ceiling.standard`, `track.builtInPerM`…), `group`, `label`, `unit` (`м²|м.п.|шт.|%|₽`), `value numeric(12,2)`, `note`, `sort`, `is_active` | **единственный** прайс; ключи = пути в `Pricing` |
| `price_history` | `price_item_id fk`, `old_value`, `new_value`, `changed_by`, `reason`, `changed_at` | история цен (для «было → стало» и отката) |
| `services` | `slug unique`, `title`, `h1`, `subtitle`, `badge`, `excerpt`, `body_md`, `cover_media_id`, `price_anchor_key fk→price_items.key`, `price_note`, `calculator_preset jsonb`, `faq jsonb`, `benefits jsonb`, `use_cases jsonb`, `seo jsonb`, `show_in_header`, `priority`, `status`, `sort`, `updated_at` | 9 услуг + новые |
| `service_relations` | `service_id`, `related_service_id`, `reason` | кросс‑селл с аргументом (F‑37) |
| `works` | `slug`, `title`, `description_md`, `owner_comment`, `room_type`, `area_sqm`, `perimeter_m`, `ceiling_type`, `service_id fk`, `price_rub`, `duration_days`, `district`, `calculator_preset jsonb`, `lighting_items jsonb`, `status`, `published_at` | портфолио «Реальные примеры» |
| `work_media` | `work_id`, `media_id`, `kind` (`before|after|process|cover`), `caption`, `sort` | галереи работ |
| `lighting_kits` | `slug`, `title`, `subtitle`, `description_md`, `owner_comment`, `room_type`, `system` (`COLIBRI_220|CLARUS_48|TRACK_220`), `cover_media_id`, `price_override_rub`, `badge`, `status`, `sort` | комплекты‑офферы (F‑41) |
| `lighting_kit_items` | `kit_id`, `vendor_code`, `name_snapshot`, `qty`, `price_snapshot_rub`, `kind`, `is_optional`, `sort` | состав; цена пересчитывается из `products` при рендере, snapshot — на случай пропажи артикула |
| `products` | `vendor_code unique`, `offer_id`, `name`, `category_path`, `system`, `kind`, `unit`, `length_m`, `price_rub`, `available`, `images jsonb`, `params jsonb`, `key_attributes jsonb`, `is_hidden`, `manual_overrides jsonb`, `imported_at` | каталог из фида EKS; заменяет `data/eks-feed2-snapshot.json` в рантайме |
| `product_imports` | `started_at`, `finished_at`, `source_url`, `total`, `added`, `updated`, `deactivated`, `errors jsonb` | журнал импорта фида |
| `articles` | `slug`, `title`, `excerpt`, `body_md`, `cover_media_id`, `category_id fk`, `tags text[]`, `author_name`, `reading_minutes`, `seo jsonb`, `related jsonb` (`{services:[], kits:[], works:[]}`), `status`, `published_at` | статьи |
| `article_categories` | `slug`, `title`, `description`, `sort` | рубрики («Цены», «Как выбрать», «Освещение», «Ошибки») |
| `reviews` | `source` (`avito|site`), `author`, `rating`, `text`, `service_id`, `date`, `is_published`, `sort` | отзывы |
| `media` | `url`, `storage_key`, `alt`, `width`, `height`, `bytes`, `mime`, `variants jsonb` (`{avif480, webp960…}`), `uploaded_by`, `created_at` | все изображения |
| `users` | `email unique`, `password_hash`, `name`, `role` (`owner|editor|viewer`), `is_active`, `last_login_at` | сотрудники |
| `sessions` | `id (token hash) pk`, `user_id`, `expires_at`, `ip_hash`, `ua` | серверные сессии (отзыв доступа) |
| `audit_log` | `actor_id`, `entity`, `entity_id`, `action`, `diff jsonb`, `created_at` | кто что менял |
| `leads`, `lead_deliveries` | по Приложению Б v1 (N‑001) + `assigned_to`, `notes`, `status_changed_at` | заявки + мини‑CRM |
| E7: `carts`, `orders`, `order_items`, `payments`, `shipments` | см. § 8 | коммерция |

Индексы: `*_slug_idx`, `*_status_published_idx (status, published_at desc)`, `products_system_kind_idx`, `products_name_trgm_idx` (pg_trgm, поиск), `leads_created_at_idx`, `audit_log_entity_idx`.

### 2.4. Auth и роли

- Вход по email + пароль, bcrypt; сессия — случайный токен 32 байта, в БД хранится `sha256(token)`, cookie `pk_session`, TTL 14 дней, продление при активности.
- Роли: `owner` (всё + пользователи + настройки + удаление), `editor` (контент, цены, комплекты, статьи, работы; без пользователей/реквизитов), `viewer` (только чтение + заявки).
- `requireRole(role)` — единственная точка проверки; `app/admin/(protected)/layout.tsx` редиректит на `/admin/login`.
- Rate‑limit логина 5/15 мин на IP + email; после 10 неудач — блок на час. События логина — в `audit_log`.
- Первого `owner` создаёт скрипт `npm run admin:create-owner` (интерактивно) либо env `ADMIN_BOOTSTRAP_EMAIL/PASSWORD` при первом старте (после создания — предупреждение в логах «удалите env»).

---

## Э0 · Пререквизиты (из ТЗ v2, без них не начинать)

| Задача | Из v2 | Почему блокирует |
|---|---|---|
| N‑001 БД лидов через Drizzle | v2 A | даёт `db/`, `drizzle.config.ts`, первую миграцию, тесты с `TEST_DATABASE_URL` |
| N‑003 полный e2e‑набор | v2 A | страховка воронки при переезде контента |
| N‑002 ценовые якоря из `pricing.ts` | v2 A | иначе в БД переедут противоречивые цены |
| N‑020 локальные фото каталога | v2 A | становится частью импорта фида (P‑014) |
| Владелец: реквизиты, `DATABASE_URL`, S3‑бакет (или Amvera Object Storage), домен для медиа | — | без реквизитов E7 невозможен |

---

## Э1 · Фундамент (P‑001…P‑005)

### P‑001 · Схема БД и миграции
**Файлы:** `db/schema.ts` (все таблицы § 2.3 кроме E7), `db/relations.ts`, `drizzle.config.ts`, `db/migrations/*`, `db/seed/*.ts`, `package.json` (`db:generate`, `db:migrate`, `db:seed`, `db:studio`).
**Сделать:**
1. Описать таблицы; enum’ы — как `text` + zod‑валидация в домене (проще эволюционировать).
2. `db/seed/`: `pricing.ts` (из `content/pricing.ts` — ключи = пути объекта, напр. `ceiling.shadowProfilePerM`), `services.ts` (9 услуг из `content/services.ts`), `kits.ts` (3 комплекта из `LightKitShowcase.tsx`), `works.ts` (из `home-assets.ts` + `homepage.ts → proofCases` + `services.ts → proof.items`), `reviews.ts`, `settings.ts` (контакты, availability, legal). Сид идемпотентен (`on conflict (slug/key) do update` только если `updated_by = 'seed'`).
3. `scripts/check-content-parity.mjs`: сравнивает сид с исходными модулями (пока те существуют) — падает при расхождении.
**Приёмка:** `drizzle-kit generate` даёт одну миграцию `0001_portal_foundation`; `npm run db:seed` на пустой БД → 9 услуг, 3 комплекта, ≥ 6 работ, ≥ 40 позиций прайса; повторный сид — 0 изменений; `tests/db/seed.test.ts`.

### P‑002 · Auth, роли, аудит
**Файлы:** `lib/auth/{password,session,rbac}.ts`, `lib/audit.ts`, `app/admin/login/page.tsx`, `app/admin/login/actions.ts`, `app/admin/(protected)/layout.tsx`, `app/admin/logout/route.ts`, `scripts/create-owner.mjs`, `proxy.ts` (Next 16: `robots`‑заголовок `X-Robots-Tag: noindex` на `/admin`).
**Сделать:** по § 2.4. `withAudit(entity, id, action, fn)` — обёртка для server actions, пишет diff (`jsondiffpatch`‑стиль вручную: только изменённые ключи, значения обрезаны до 500 симв.).
**Приёмка:** vitest: хеш/проверка пароля, TTL сессии, rbac‑матрица (3 роли × 8 сущностей); e2e `admin-auth.spec.ts`: неверный пароль ×5 → 429; вход → `/admin`; logout → cookie удалена; прямой `GET /admin/prices` без cookie → 302 `/admin/login?next=…`.

### P‑003 · Медиа: загрузка, варианты, хранилище
**Файлы:** `lib/media/{storage,process,upload-action}.ts`, `app/admin/_components/media-picker.tsx`, `next.config.ts` (`images.remotePatterns` для домена медиа), `components/ui/picture.tsx` (принимает `Media` вместо `src`).
**Сделать:**
1. `MediaStorage` интерфейс (`put/delete/publicUrl`) с двумя реализациями: `S3Storage` (`@aws-sdk/client-s3`, любой S3‑совместимый: Amvera/Yandex Object Storage/Selectel) и `LocalStorage` (`public/uploads`, только dev).
2. При загрузке: валидация mime/размера → `sharp` → варианты `480/960/1440` в `avif+webp` + оригинал `jpeg q85` ≤ 2560 px → запись в `media` с `variants`. Alt обязателен (форма не даёт сохранить без alt).
3. `MediaPicker`: библиотека (сетка, поиск по alt, фильтр «не используется»), drag‑n‑drop загрузка, выбор одного/нескольких, редактирование alt.
4. Миграция существующих `public/*.jpeg` + `public/optimized/*` → `media` скриптом `scripts/import-public-media.mjs` (без повторного ресайза, если варианты есть).
**Приёмка:** загрузка 5 МБ JPEG → 7 файлов в хранилище, запись в `media` с `width/height`; попытка загрузить `.svg`/`.html` → 415; `<Picture media={…}>` рендерит `<picture>` с `srcset` avif/webp; e2e скрин админки 📸.

### P‑004 · Планировщик и служебные маршруты
**Файлы:** `app/api/cron/{lead-retry,import-feed,check-availability}/route.ts`, `lib/cron/guard.ts`, `README.md` (раздел «Cron»), `amvera.yaml` (или отдельный cron‑проект Amvera / GitHub Actions `schedule` с `curl` + `CRON_SECRET`).
**Сделать:** единый guard `Authorization: Bearer CRON_SECRET`; каждый маршрут пишет запись в `settings.cron_last_run.<name>`; дашборд админки показывает «последний запуск / статус». Расписание: `lead-retry */15`, `import-feed` ежедневно 05:00 МСК, `check-availability` ежедневно 08:00 (уведомление в Telegram владельцу, если `validUntil < now+7d`).
**Приёмка:** vitest guard; ручной `curl`; дашборд показывает время.

### P‑005 · Репозитории контента и фиче‑флаг `CONTENT_SOURCE`
**Файлы:** `lib/content/{pricing,services,kits,works,articles,reviews,settings,products}.ts`, `lib/content/cache.ts`, `lib/env.ts`.
**Сделать:** для каждой сущности — `getAll(filter)`, `getBySlug(slug)`, `getPublished*`; внутри: `unstable_cache(fn, [key], { tags: [entity] })`; при `CONTENT_SOURCE=static` — возвращают данные сида (без БД). Типы — **общие** для статики и БД (`ServiceDTO`, `KitDTO`…), маппинг из строк Drizzle в DTO — в репозитории.
**Приёмка:** `tests/content/*.test.ts`: для каждой сущности `static` и `db` режимы возвращают структурно одинаковые DTO на сиде (`toEqual`).

---

## Э2 · Контент в БД (P‑010…P‑019) — strangler по сущностям

### P‑010 · Прайс: `getPricing()` из `price_items`, калькулятор на данных
**Файлы:** `lib/content/pricing.ts`, `content/pricing.ts` (оставить `Pricing` тип, `defaultPricing`, хелперы), `lib/calculator/selectors.ts` (все селекторы принимают `pricing: Pricing` первым аргументом), `lib/calculator/reducer.ts` (в state `pricing`), `components/calculator-modal/calculator-modal-gate.tsx` (получает `pricing` пропсом из серверного компонента), `app/api/pricing/route.ts`, `lib/home-proof-pricing.ts`.
**Сделать:**
1. `price_items → Pricing`: `buildPricingFromItems(rows)` собирает вложенный объект по ключам с точкой; отсутствующий ключ → значение из `defaultPricing` + `console.warn`.
2. Все 17 потребителей `pricing` переводятся на `getPricing()` (серверные) или на `pricing` из стора (клиентские). Импорт константы `pricing` из `content/pricing.ts` **запрещается** eslint‑правилом `no-restricted-imports` (кроме сида и тестов).
3. `/api/pricing` — публичный JSON текущего прайса + `updatedAt` (для внешних интеграций и отладки).
**Приёмка:** `tests/pricing-from-items.test.ts`; e2e сц. 1 и 2 зелёные в режиме `db`; ручной прогон: поменять `ceiling.standard` в БД → `revalidateTag('pricing')` → hero услуги и сумма калькулятора изменились без деплоя.

### P‑011 · Удалить дубли цен
**Файлы:** `content/homepage.ts` (удалить `price.calculator` — рейты), `lib/home-proof-pricing.ts` (берёт из `getPricing()`), `data/eks-feed2-snapshot.json` (поле `discountPercentForCeilingOrder` игнорируется, скидка — из прайса), `content/eksmarket-assortment.ts` (**удалить файл** после проверки, что импортов нет).
**Приёмка:** grep `ratePerMeter|baseRatePerSqm|discountPercentForCeilingOrder` вне сида → 0; `tests/pricing.test.ts` расширен на витрины главной.

### P‑012 · Услуги: `app/uslugi/[slug]`, контент из БД, пресеты из `calculator_preset`
**Файлы:** `app/(site)/uslugi/[slug]/page.tsx` (+`generateStaticParams`, `generateMetadata`, `revalidate = 3600`), удалить 9 папок `app/uslugi/<slug>/`, `content/services.ts` → `db/seed/services.ts` (без импорта `next/navigation`), `lib/content/services.ts`, `lib/calculator/presets.ts` (вход — `ServiceCalculatorPreset` из DTO), `app/sitemap.ts`, `lib/seo-schema.ts`.
**Сделать:** шаблон страницы услуги = существующий `ServicePageLayoutV2` с секциями, читающими DTO; порядок/видимость секций — поле `services.sections jsonb` (массив `{id, enabled, sort}`), редактируется в админке; страница света (`prodazha-trekovogo-osveshcheniya`) — отдельный шаблон `template = 'lighting-sale'` (поле `services.template`).
**Приёмка:** `next build` — 9 страниц по `generateStaticParams`; e2e сц. 3 и 13 зелёные; `tests/services-parity.test.ts` — DTO из БД `toEqual` данным сида; создание услуги в админке → `/uslugi/<new-slug>` отдаёт 200 после `revalidateTag`.

### P‑013 · Комплекты света из БД
**Файлы:** `lib/content/kits.ts`, `lib/lighting/kit-pricing.ts` (`priceKit(kit, products)` → `{lightingOnlyRub, withCeilingRub, missing[]}`), `LightKitShowcase.tsx` (рендер DTO), `app/(site)/komplekty/page.tsx`, `app/(site)/komplekty/[slug]/page.tsx`, `db/seed/kits.ts`.
**Сделать:** состав комплекта — строки `lighting_kit_items`; цена считается из актуальных `products` (fallback `price_snapshot_rub`); если артикул недоступен — комплект **не исчезает**, а показывает плашку «состав уточняется» и уходит в `status = needs_review` + уведомление владельцу (дашборд). Страница комплекта: фото сцены, одна цена + зачёркнутая, «что получите» (3 буллета), состав раскрывается, CTA «Добавить в расчёт» (существующий `LightKitCtaButton`), «Заказать только оборудование».
**Приёмка:** vitest `priceKit` (полный/с пропавшим артикулом); e2e: комплект со страницы → Шаг 2 «Только оборудование» → `/api/lead` содержит `lighting.items[].vendorCode` из состава; удаление артикула в тесте → плашка и `needs_review`.

### P‑014 · Импорт фида EKS в `products` + локальные фото
**Файлы:** `lib/catalog/import-feed.ts`, `app/api/cron/import-feed/route.ts`, `scripts/import-feed.mjs` (ручной запуск), `lib/eks-feed2-catalog.ts` (нормализация остаётся, источник — `products`), `scripts/build-catalog-index.mjs` (читает из БД, пишет `catalog-index.json` **в `.next/cache` или отдаёт через `/api/catalog?format=index`** — снапшот из git удаляется), N‑020 (фото) переезжает в импорт: скачивание превью в медиа‑хранилище.
**Сделать:** идемпотентный upsert по `vendor_code`; товары, пропавшие из фида → `available = false` (не удаляются: на них ссылаются комплекты и лиды); `manual_overrides` (название, скрытие, ручное фото, `kind/system`) — переживают импорт; журнал в `product_imports`; при изменении цены > 20 % — пометка `price_alert` для владельца.
**Приёмка:** `tests/catalog/import-feed.test.ts` на фикстуре фида (добавление/обновление/деактивация/override); e2e сц. 14 (фото) зелёный; дата актуальности на витрине — из `product_imports.finished_at` (F‑44).

### P‑015 · Работы (портфолио) из БД
**Файлы:** `lib/content/works.ts`, `app/(site)/raboty/page.tsx` (фильтры: тип потолка, комната, площадь, услуга), `app/(site)/raboty/[slug]/page.tsx`, `components/home/home-proof.tsx` (читает DTO), `db/seed/works.ts`, `lib/home-proof-pricing.ts` (ориентир округляется до 1 000 ₽ — F‑25).
**Сделать:** карточка работы = галерея (`work_media`), параметры (площадь, тип, срок, район), «ориентир ≈ N ₽» (из `calculator_preset` + `lighting_items` через селекторы, округление), комментарий владельца («что было сложного»), CTA «Хочу так же» → `openCalculator({preset})`, связанная услуга и комплект. `works.calculator_preset` валидируется той же zod‑схемой, что `services.calculator_preset`.
**Приёмка:** e2e: «Хочу так же» открывает калькулятор с предзаполненной площадью; `Product`/`ImageObject` JSON‑LD; 📸.

### P‑016 · Отзывы и настройки из БД
**Файлы:** `lib/content/{reviews,settings}.ts`, `components/home/avito-reviews-section.tsx`, `content/{contacts,availability,legal}.ts` → `db/seed/settings.ts`, футер/шапка/формы читают `getSettings()`.
**Сделать:** `settings` — типизированный ключ‑значение с zod‑схемой на каждый ключ (`contacts`, `legal`, `availability`, `header`, `footer`, `flags`); `check:legal` проверяет БД, а не файл.
**Приёмка:** отзыв с `service_id` показывается на странице услуги первым (F‑46); смена `availability` в админке → hero через ≤ 60 с.

### P‑017 · Черновики и предпросмотр
**Файлы:** `app/(site)/**` (поддержка `?preview=<token>`), `lib/preview.ts` (Next Draft Mode), `app/api/preview/route.ts`.
**Сделать:** редактор в админке → «Предпросмотр» → открывает витрину с `draftMode()` и читает `status in (draft, published)`; ссылка предпросмотра одноразовая (токен 1 час).
**Приёмка:** e2e: черновик услуги невидим без токена (404), виден с токеном; после публикации — виден всем.

### P‑018 · `/api/lead` → мини‑CRM
**Файлы:** `lib/lead/store.ts` (`PgLeadStore` из N‑001 + `list/filter/updateStatus/addNote`), `app/admin/(protected)/leads/**`.
**Сделать:** список с фильтрами (статус, источник, период, сумма), карточка заявки (snapshot читаемо: комнаты, свет с артикулами, итог), смена статуса `new → contacted → measured → contracted → done | lost` с причиной, заметки, повторная доставка в Telegram кнопкой, экспорт CSV.
**Приёмка:** e2e: отправка лида с витрины → появляется в `/admin/leads` за ≤ 5 с; смена статуса пишет `audit_log`.

### P‑019 · Удалить `CONTENT_SOURCE=static` и статические модули
**Сделать:** после 2 недель на `db` в проде без инцидентов — удалить флаг, `content/*.ts` (кроме типов), `check-content-parity`. Обновить README.
**Приёмка:** grep `CONTENT_SOURCE` → 0; `content/` содержит только `types.ts` и сиды перенесены в `db/seed`.

---

## Э3 · Админка (P‑020…P‑027)

### Общие требования к админке
- Route‑group `app/admin/(protected)/**`, свой `layout` (сайдбар: Дашборд · Заявки · Цены · Услуги · Комплекты · Работы · Статьи · Отзывы · Медиа · Настройки · Пользователи · Журнал), `noindex`, без Метрики.
- **Server Components + Server Actions**, без отдельного SPA‑фреймворка. Формы — прогрессивные (работают без JS), `useActionState` для ошибок, `useOptimistic` для инлайн‑правок.
- Каждая форма: zod‑схема (общая с сидом), ошибки у полей, «Сохранить» / «Сохранить и опубликовать» / «Предпросмотр», плашка «Изменено N мин назад пользователем X».
- Markdown‑поля: textarea с панелью (жирный, заголовок, список, ссылка, вставка медиа) + живой предпросмотр справа (≥ 1024 px) / табом (мобайл). Рендер — `marked` + `sanitize` (allow‑list тегов).
- Списки: поиск, фильтр по статусу, сортировка, пагинация 50, массовые действия (опубликовать/архивировать).
- Мобильная админка — рабочая на 390 px (владелец правит цены с телефона).
- Все action’ы идемпотентны и пишут `audit_log`.

### P‑020 · Каркас админки и дашборд
Дашборд: заявки за 7/30 дней (кол‑во, сумма ориентиров, конверсия по источникам), последние 10 заявок, «требуют внимания» (комплекты `needs_review`, `price_alert` товары, `availability` истекает, неудачные доставки, cron не запускался > 24 ч), быстрые действия («изменить цену», «новая статья»).
**Приёмка:** 📸 desktop/mobile; e2e `admin-dashboard.spec.ts`.

### P‑021 · Цены (инлайн‑таблица с историей)
Таблица `price_items` по группам (Потолок · Профили · Карнизы · Свет · Монтаж · Скидки · Минимум · Дефолты), инлайн‑правка значения (Enter — сохранить, Esc — отмена), обязательное поле «причина» при изменении > 10 %, история справа (последние 20 изменений, откат одной кнопкой), кнопка «Как это повлияет» — пересчёт 3 эталонных сцен (спальня 12 м² простой, кухня‑гостиная 24 м² теневой + трек, объект 60 м² парящий) до/после.
**Приёмка:** vitest на пересчёт сцен; e2e: правка → откат → значение восстановлено, 2 записи в `price_history`.

### P‑022 · Услуги
Список; редактор с вкладками: Основное (slug, title, H1, подзаголовок, бейдж, excerpt, обложка), Цена (якорь = select из `price_items` + примечание; предпросмотр строки «от 950 ₽ / м.п.»), Калькулятор (форма `calculator_preset` с валидацией; кнопка «Открыть калькулятор с этим пресетом»), Контент (about/useCases/benefits — markdown + списки), FAQ (сортируемый список), Секции (порядок/видимость), Связи (смежные услуги с причиной), SEO (title/description/OG, счётчик длины, предпросмотр сниппета), История.
**Приёмка:** создать услугу «Матовые потолки» → опубликовать → страница 200, в хабе, в sitemap, в шапке (если `show_in_header`).

### P‑023 · Комплекты освещения
Редактор: основное + обложка/галерея + описание (markdown) + **комментарий владельца** (публичный блок «Почему я собираю так») + состав: поиск товара по названию/артикулу (из `products`, с фото и ценой), qty, «необязательная позиция», авто‑подсказки из `kit-rules.ts` («не хватает блока питания на 60 Вт», «для 3 м профиля нужно 2 соединителя») с кнопкой «добавить». Справа — живая калькуляция: сумма, −10 %, −25 %, экономия. Дублировать комплект.
**Приёмка:** e2e: собрать комплект из 5 позиций → опубликовать → страница `/komplekty/<slug>` и карточка на странице света показывают ту же сумму, что в админке.

### P‑024 · Работы
Редактор: основное, параметры (комната, площадь, периметр, тип потолка, срок, район), галерея с типами кадров (до/после/процесс) и подписями, пресет калькулятора (как у услуги) + список светильников (поиск по `products`), **комментарий владельца** (markdown), связанная услуга/комплект, статус, дата. Автоориентир цены показывается в редакторе.
**Приёмка:** e2e: работа с 3 фото опубликована → в `/raboty`, на главной (если `featured`), «Хочу так же» открывает калькулятор.

### P‑025 · Статьи (см. Э4)
### P‑026 · Отзывы, Медиа, Настройки, Пользователи, Журнал
Отзывы: CRUD + привязка к услуге + импорт из Avito вручную (вставка текста). Медиа: библиотека (P‑003), «где используется». Настройки: формы по ключам (`contacts`, `legal` с валидацией ИНН/ОГРНИП по контрольным суммам, `availability` с датой‑пикером и предупреждением «истекает», `header/footer` меню, `flags`). Пользователи (owner): приглашение по email‑ссылке, роль, деактивация. Журнал: фильтр по сущности/пользователю/дате, diff.
**Приёмка:** rbac e2e: `editor` не видит «Пользователи» и `legal`; `viewer` — только чтение.

### P‑027 · Уведомления владельцу
Telegram‑бот (уже есть для лидов): события `needs_review`, `price_alert`, `availability_expiring`, `import_failed`, `delivery_failed`. Настройка «какие события слать» — в `settings.notifications`.
**Приёмка:** vitest на форматирование; ручной прогон.

---

## Э4 · Статьи (P‑030…P‑034)

### P‑030 · Модель, рубрики, редактор
**Файлы:** `app/admin/(protected)/articles/**`, `lib/content/articles.ts`, `lib/markdown/{render,sanitize,toc}.ts`.
**Сделать:** редактор (P‑025) с полями § 2.3; авто‑`reading_minutes`; оглавление из `##`; вставка **виджетов** в markdown короткими кодами: `{{calculator source="article:<slug>"}}` (кнопка калькулятора), `{{service slug="tenevoy-profil"}}` (карточка услуги), `{{kit slug="kuhnya-colibri"}}`, `{{price key="ceiling.standard"}}` (живая цена — статьи «сколько стоит» никогда не устаревают), `{{work slug="…"}}`, `{{faq}}`. Виджеты рендерятся серверными компонентами.
**Приёмка:** vitest рендера виджетов и sanitize (XSS‑фикстуры → вырезано); 📸 редактора.

### P‑031 · Витрина статей
**Файлы:** `app/(site)/stati/page.tsx` (лента + рубрики + поиск по заголовку), `app/(site)/stati/[category]/page.tsx`, `app/(site)/stati/[category]/[slug]/page.tsx`, `components/articles/*` (карточка, шапка статьи, TOC липкий, блок автора «Владимир, мастер», «Читать далее», CTA «Посчитать за 2 минуты» после 2‑го экрана и в конце), RSS `/stati/rss.xml`.
**Сделать:** шаблон статьи по дизайн‑системе v2 (P‑041); мобильный липкий CTA калькулятора появляется после 40 % прокрутки; события `article_view`, `article_cta_click`, `article_scroll_50/90`.
**Приёмка:** Lighthouse SEO 100, A11y ≥ 95 на статье; `Article` + `BreadcrumbList` JSON‑LD; e2e: `{{calculator}}` открывает калькулятор с `source = article:<slug>`.

### P‑032 · Контент‑план стартовый (12 статей) — задача владельца + редактора
Темы под интенты калькулятора: «Сколько стоит натяжной потолок в 2026: честный расчёт», «Теневой профиль или плинтус», «Парящий потолок: за что платите 2 500 ₽/м.п.», «COLIBRI vs CLARUS vs ART», «Сколько светильников нужно на комнату», «Ошибки при заказе трекового света», «Скрытый карниз: 3 способа и цены», «Световые линии: где уместны», «Минимальный заказ 18 000 ₽ — что входит», «Как проходит замер», «Фиксация сметы: как это работает», «Потолок в кухне‑гостиной 24 м²: разбор объекта». Каждая — с виджетом цены и калькулятором.
**Приёмка:** 12 статей `published`, у каждой ≥ 1 виджет, обложка, рубрика, связанная услуга.

### P‑033 · Перелинковка
Автоблоки: на странице услуги — «Статьи по теме» (по `related.services`), на статье — услуги/комплекты/работы из `related`, на работе — статьи с тем же `ceiling_type`. Лимит 3–4, без дублей.
**Приёмка:** vitest на выборку; отсутствие «висячих» статей (без входящих ссылок) — отчёт в дашборде.

### P‑034 · Поиск по порталу
`/poisk?q=` — услуги, статьи, работы, товары (pg_trgm + `to_tsvector('russian')`), подсветка, событие `site_search`. В шапке — поле поиска (desktop) / иконка (mobile).
**Приёмка:** «теневой» → услуга первой, статьи следом; ≤ 300 мс на 10 000 товаров (индекс).

---

## Э5 · Дизайн‑система v2 и информационная архитектура портала (P‑040…P‑044)

Ответ на вопрос «нужен ли редизайн»: **нет полному, да — системному расширению.** Визуальный язык (Inter, slate‑палитра, тёмные акцентные секции, крупные радиусы) сохраняется.

### P‑040 · Токены и примитивы (сливается с N‑063 v2)
- **Один primary**: `--color-primary: #0f172a` (slate‑900) для действий с деньгами/CTA; синий `#2563eb` → `--color-link` только для ссылок и выбранного состояния. Исключений нет.
- Радиусы: `--radius-card 1.25rem`, `--radius-control 0.875rem`, `--radius-pill 9999px`. Кнопки: `sm 40 / md 44 / lg 52`.
- Типографика: шкала `text-xs 12 / sm 14 / base 16 / lg 18 / xl 20 / 2xl 24 / 3xl 30 / 4xl 36 / 5xl 48`, заголовки `tracking-tight`, подписи минимум `text-slate-600`, 12 px минимум.
- Компоненты: `Button`, `IconButton`, `Badge`, `Card`, `Price` (единый формат «от 950 ₽ / м.п.», округление ориентиров), `Tabs`, `Accordion`, `Dialog/Sheet`, `Toast`, `Breadcrumbs`, `Pagination`, `EmptyState`, `Skeleton`, `Field/Input/Select/Textarea/Checkbox`, `MediaPicture`.
- `tests/design-tokens.test.ts`: запрет `bg-blue-600`, `rounded-xl` в кнопках, `text-slate-400` на тексте < 14 px.
**Приёмка:** axe 0 контрастных нарушений на 6 типах страниц; Storybook не требуется — страница `/admin/ui-kit` (только для роли owner) с живыми примерами.

### P‑041 · Шаблоны страниц (8)
1. Главная портала: hero с продуктом (фото объекта + мини‑портрет, N‑030), полоса «Услуги», «Ценовые примеры» (N‑031, из работ), «Комплекты света», «Работы», «Статьи», «Отзывы», форма. Секции включаются/выключаются в `settings.home`.
2. Хаб услуг. 3. Услуга (существующий V2 + CTA в середине, N‑032). 4. Каталог работ + карточка работы. 5. Каталог комплектов + карточка комплекта. 6. Каталог товаров + карточка товара (E7 — карточка сначала как «спросить наличие»). 7. Лента статей + статья. 8. Служебные: поиск, 404, privacy, оферта.
Каждый шаблон — макет в Figma‑подобной спецификации в `docs/design/<template>.md` (сетка, отступы, порядок блоков, mobile/desktop), затем реализация.
**Приёмка:** 📸 8 шаблонов × 2 брейкпоинта в `PHASE-E5-REPORT.md`.

### P‑042 · Навигация портала
Шапка: логотип · Услуги (мега‑меню: 9 услуг с ценой «от», 2 колонки) · Работы · Освещение (Комплекты / Каталог / Как выбрать систему) · Статьи · телефон · «Рассчитать» (primary). Mobile: нижняя панель «Рассчитать / Позвонить / Telegram» (существующая `mobile-sticky-cta`) + бургер с аккордеонами. Хлебные крошки на всех внутренних. Футер: 4 колонки (Услуги, Освещение, Статьи по рубрикам, Контакты + реквизиты), «Обновлено: <дата прайса>».
Меню — из `settings.header/footer`, редактируется в админке.
**Приёмка:** e2e клавиатурная навигация меню; `SiteNavigationElement` JSON‑LD.

### P‑043 · Калькулятор — визуальная интеграция (сливается с N‑010…N‑013 v2)
Раскладка модалки 2 колонки на desktop, бюджет высоты mobile, один индикатор, PriceStrip после первого ответа, язык клиента. Плюс: точка входа «Рассчитать» доступна из статьи/работы/комплекта с корректным `source`.
**Приёмка:** по N‑010…N‑013; сц. 11, 12 e2e.

### P‑044 · Копирайт и тон (сливается с N‑060)
Словарь запрещённых слов (узел, точки, закладные, БП, «под ключ», «мы» для бренда одного мастера) → `tests/copy-lint.test.ts` проверяет и БД‑контент через админку (предупреждение в редакторе, не блокировка).

---

## Э6 · SEO и производительность портала (P‑050…P‑053)

### P‑050 · Динамические sitemap/robots/OG
`sitemap.ts` из БД (услуги, работы, комплекты, статьи, рубрики; `lastModified = updated_at`), индекс sitemap при > 1 000 URL (товары отдельно), `robots` закрывает `/admin`, `/api`, `/poisk`. OG‑изображение статьи/работы — генерируется `ImageResponse` (`app/(site)/og/[type]/[slug]/route.tsx`) с заголовком и ценой.
### P‑051 · Регион как данные
`settings.region` (`Москва и МО`) подставляется в `title/description`, H1 — без региона (N‑002). Заготовка под поддомены/подпапки регионов (не реализуется, но не блокируется схемой: `services.region_overrides jsonb`).
### P‑052 · Структурированные данные
`Service` + `Offer` (цена из прайса), `Product` (комплект, товар), `Article`, `BreadcrumbList`, `FAQPage`, `LocalBusiness` (из `settings.contacts/legal`), `Review/AggregateRating` (из `reviews`). Валидатор — `tests/seo-schema.test.ts` (структура) + ручная проверка Rich Results.
### P‑053 · Производительность
ISR везде, где возможно; `unstable_cache` с тегами; `next/image` с loader медиа‑домена; бюджет: главная ≤ 300 КБ, статья ≤ 180 КБ, каталог ≤ 350 КБ; `check:bundle` расширить на эти три страницы; Lighthouse CI еженедельно.

---

## Э7 · Коммерция (P‑060…P‑066) — после заполнения реквизитов и оферты

### Принцип
Продажа освещения — **гибрид**: онлайн‑оплата для «только оборудование» (комплект/товары), а «с потолком» остаётся заявкой (сумма фиксируется после замера). Никаких складских остатков: наличие — из фида + подтверждение менеджером в течение рабочего дня.

### P‑060 · Корзина в БД
`carts` (anonymous by cookie / user), `cart_items` (vendor_code, qty, price_snapshot); замена `use-lighting-cart.ts` localStorage на серверную корзину с оптимистичным UI; merge при логине; событие `add_to_cart` (Метрика e‑commerce `dataLayer`).
### P‑061 · Оформление заказа
`/zakaz`: контакт, способ получения (самовывоз / доставка курьером по Москве / ТК), комментарий; создаёт `orders` + `order_items`, номер `PK‑2026‑000123`, письмо/Telegram. Статусы: `new → confirmed → paid → assembling → shipped → done | cancelled`.
### P‑062 · Оплата
ЮKassa (или CloudPayments) — виджет/редирект, webhook `/api/payments/yookassa` с проверкой подписи, идемпотентность по `payment_id`, чеки 54‑ФЗ через кассу провайдера. Тесты на webhook (повтор, подмена суммы).
### P‑063 · Доставка
Тарифы в `settings.shipping` (зоны МКАД/до 30 км/ТК); расчёт в корзине; интеграция с ТК — вне объёма (ручная).
### P‑064 · Личный кабинет клиента (минимум)
Вход по коду из Telegram/SMS (без пароля), список заказов и заявок, статусы, повтор заказа. Опционально по решению владельца.
### P‑065 · Юридика
Оферта, политика, возврат — страницы из `settings.legal_pages` (markdown), чекбоксы согласия в чекауте, реквизиты в футере/чеке. Блокировка чекаута при `legal` не заполнено.
### P‑066 · Админка заказов
Список/карточка/статусы/возвраты, печать сборочного листа, экспорт для бухгалтерии.

---

## 8. Схема данных E7 (кратко)

| Таблица | Поля |
|---|---|
| `customers` | `phone unique`, `name`, `email`, `telegram_id`, `created_at` |
| `carts` | `token`, `customer_id`, `status`, `updated_at` |
| `cart_items` | `cart_id`, `vendor_code`, `qty`, `price_snapshot_rub`, `kit_slug` |
| `orders` | `number unique`, `customer_id`, `status`, `intent` (`lighting_only|with_ceiling`), `subtotal`, `discount_pct`, `shipping_rub`, `total`, `contact jsonb`, `shipping jsonb`, `lead_id` |
| `order_items` | `order_id`, `vendor_code`, `name`, `qty`, `price_rub` |
| `payments` | `order_id`, `provider`, `provider_id unique`, `status`, `amount`, `payload jsonb` |
| `shipments` | `order_id`, `method`, `status`, `tracking`, `cost` |

---

## 9. Связь с ТЗ v2

| v2 | Судьба в v3 |
|---|---|
| N‑001, N‑002, N‑003, N‑020 | **обязательные пререквизиты** (Э0) |
| N‑010, N‑011, N‑012, N‑013 | входят в P‑043 |
| N‑021, N‑040, N‑041 | N‑021 — как есть; N‑040 реализуется через P‑013 (комплекты из БД); N‑041 → P‑014 |
| N‑030, N‑031, N‑032 | входят в P‑041 (шаблоны главной и услуги) |
| N‑050, N‑051 | выполняются **до** P‑010 (иначе перевод калькулятора на данные затронет 3 стора) |
| N‑060 | P‑044 |
| N‑061 | P‑016 (availability в БД) + P‑027 |
| N‑062, N‑063 | P‑050, P‑040 |

---

## 10. Риски и как они закрыты

| Риск | Митигирование |
|---|---|
| Переезд контента ломает воронку | фиче‑флаг `CONTENT_SOURCE`, parity‑тесты, полный e2e‑набор из N‑003 в CI на каждом PR |
| Цена в БД ≠ цена в калькуляторе клиента | прайс передаётся в клиент одним объектом с `version`; лид содержит `pricingVersion`; при расхождении > 0 сервер пересчитывает и предупреждает |
| Владелец случайно ломает пресет/комплект | zod‑валидация форм, «Как это повлияет», история/откат, черновики, `needs_review` |
| Утечка доступа в админку | сессии в БД с отзывом, rate‑limit, 2FA через Telegram‑код (P‑002 опция), аудит |
| Рост бандла | админка в отдельной route‑group; витрина — ISR; бюджет в CI на 3 страницах |
| Фид поставщика меняет формат/пропадает | импорт в транзакции, при ошибке — старые данные остаются, уведомление; `manual_overrides` |
| Amvera: один контейнер, нет cron | внешний планировщик (GitHub Actions schedule / Amvera cron) с `CRON_SECRET`; все cron‑маршруты идемпотентны |

---

## 11. Definition of Done ТЗ v3 (без E7)

- Все `P‑001…P‑053` закрыты, 6 отчётов `PHASE-E*-REPORT.md` с 📸.
- Владелец **сам** за один сеанс: изменил цену → создал комплект → загрузил 3 фото работы → опубликовал статью с виджетом цены → увидел всё на сайте без деплоя; изменил статус заявки.
- `content/*.ts` (кроме типов) удалены; `CONTENT_SOURCE` удалён; `data/eks-feed2-snapshot.json` удалён из git.
- CI зелёный: lint, tsc, vitest (включая `tests/db/*` на сервисной БД), e2e (v2 16 + v3 ≥ 12 сценариев), build, bundle на 3 страницах, drizzle‑kit check, gitleaks.
- Lighthouse mobile: главная/услуга/статья — Perf ≥ 85, A11y ≥ 95, SEO 100.
- 12 статей опубликовано; sitemap содержит услуги, работы, комплекты, статьи.

---

## Приложение А · Контракт `GET /api/pricing`

```json
{
  "version": "2026-05-01T10:12:00Z",
  "items": { "ceiling.standard": 1000, "ceiling.shadowProfilePerM": 950, "lightingDiscount.withCeilingPct": 25, "...": 0 },
  "pricing": { "ceiling": { "standard": 1000, "...": 0 }, "minimumOrderRub": 18000 }
}
```

## Приложение Б · Матрица ролей

| Сущность | owner | editor | viewer |
|---|---|---|---|
| Цены | CRUD + откат | CRUD (причина обязательна) | R |
| Услуги / Комплекты / Работы / Статьи / Отзывы / Медиа | CRUD + удаление | CRU + архив | R |
| Заявки | все + экспорт | статус, заметки | R |
| Настройки `contacts/availability/header/footer` | CRUD | RU | R |
| Настройки `legal`, Пользователи, Журнал | CRUD | — | — |

## Приложение В · Новые события аналитики

`article_view {slug, category}`, `article_cta_click {slug, placement}`, `article_scroll {slug, pct}`, `work_view {slug}`, `work_want_same {slug}`, `kit_view {slug}`, `kit_add_to_calc {slug, items, total}`, `product_view {vendorCode}`, `site_search {q, results}`, `add_to_cart / remove_from_cart / begin_checkout / purchase` (e‑commerce, E7).

## Приложение Г · Референсная реализация в этом репозитории

В `src/` собран рабочий каркас Э1–Э4 в упрощённом виде (без S3 и ролей — один владелец по паролю): схема Drizzle (`src/db/schema.ts`), идемпотентный сид из данных исходного проекта, репозитории `src/lib/content/*`, админка `/admin` (цены с историей, услуги, комплекты с составом, работы, статьи, заявки, настройки), публичные витрины из БД, `GET /api/pricing`, `POST /api/lead` с `PgLeadStore`, страница `/docs` с этим ТЗ. Он предназначен как образец архитектуры и стартовая точка для переноса в основной репозиторий, а не как замена существующего калькулятора.
