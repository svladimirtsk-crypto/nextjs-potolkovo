# ПОТОЛКОВО · эксплуатация, проверки и выпуск

Актуализировано 14.10.2026. Этот документ заменяет исторический журнал в корневом README, но не утверждает, что production уже принят. Критерии развития — [TECHNICAL-TZ-V8.md](TECHNICAL-TZ-V8.md).

## 1. Правило веток

Работать в `feat/company-rebrand-v7-preview`. Main автоматически запускает production. Не создавать PR в main, не мержить, не пушить напрямую в main и не делать force-push без отдельного явного согласования выпуска. Preview-push допустим в рамках согласованной работы, но его статус не заменяет CI/ручную приёмку.

Перед каждым push проверить branch, diff, целевой ref и отсутствие секретов. Перед выпуском заново проверить remote refs: значения в STATUS — исторический снимок, а не защита от чужого нового коммита.

## 2. Безопасный локальный preview

```bash
npm ci
NEXT_PUBLIC_PREVIEW_MODE=1 LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run build
LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npm run start -- --hostname 0.0.0.0 --port 3100
```

`NEXT_PUBLIC_PREVIEW_MODE=1` требуется **на build-time**, чтобы не отправлять боевые события Метрики. Серверные флаги задаются и на runtime. Не подставлять production-секреты и БД. `TELEGRAM_LEADS_ENABLED=0` само по себе не отключает Web3Forms: для безопасного preview отключён приём lead API целиком.

В ограниченной среде: `RAYON_NUM_THREADS=1 NODE_OPTIONS=--max-old-space-size=1024` перед build. Для задач, которым нужен работающий сервер, управлять процессом отдельно; не оставлять неучтённый сервер после проверки.

## 3. Автоматическая проверка

```bash
npm run lint
npx tsc --noEmit
npm run test
npm run test:flow
npm run validate:catalog
npm run build
npm run check:bundle
npx playwright install --with-deps chromium
LEAD_API_ENABLED=0 TELEGRAM_LEADS_ENABLED=0 CATALOG_LIVE_FEED2_ENABLED=0 npx playwright test --workers=2
RELEASE=1 npm run check:e2e-flaky
```

Сборка для E2E также должна использовать preview-флаг из раздела 2. Все тестовые lead POST перехватываются, не отправлять реальные заявки. `ci:all` существует, но для полного DB-gate нужна явная тестовая БД; одним отсутствием переменной нельзя получить фиктивный успех интеграции.

Для одноразовой локальной PostgreSQL 17:

```bash
# TEST_DATABASE_URL — только отдельная тестовая БД. Проверить имя/хост вручную.
DATABASE_URL="${TEST_DATABASE_URL:?set a disposable test database}" npx drizzle-kit push --force
TEST_DATABASE_URL="$TEST_DATABASE_URL" CRON_SECRET=ci-test-secret npm run test
```

`--force` допустим здесь для disposable test DB, не инструкция для production. В production сначала backup, проверка diff/дублей и согласованная миграция.

CI сейчас: `pull_request`, а также push в main/quizv2/quizv2ver1. На `feat/company-rebrand-v7-preview` обычный push не запускает этот workflow. Static → build/budget → E2E/flaky; secrets job отдельно. Build передаётся в E2E tar-архивом с `.next`, `public/optimized`, `data`; не заменять его загрузкой каталога, которая может пропустить скрытую `.next`.

Hooks — только часть проверки. Если gitleaks не установлен, hook сообщает skip: не называть это успешным secrets scan. Поддерживаемые версии Node/Next и применимые advisory — открытая T8-008, не автоматически решённая зелёным build.

## 4. Реестр пропусков

Владелец: `svladimirtsk-crypto`; исполнение — разработчик/QA.

Последний полный прогон: 0 unit skips при заданной PostgreSQL. Без БД четыре DB-файла используют `describe.skipIf(!TEST_DATABASE_URL)`: `lead-route-db` (15), `availability-db` (12), `delivery-alert-db` (9), `lead-delivery-integration-db` (19). В `lead-store-pg` дополнительные проверки регистрируются только при наличии DB URL. Отчёт всегда должен указывать фактические числа, а не прежние 53 skips из старого README.

12 E2E-skips зависят от раскладки:

| Файл / сценарий | Где пропуск | Число |
|---|---|---:|
| track-sale: мобильный бар и payload | desktop | 3 |
| funnel-modern: desktop-путь | mobile | 2 |
| lighting-first: desktop-путь | mobile | 1 |
| draft-restore: каталог desktop | mobile | 1 |
| entry-context: мобильный sticky | desktop | 2 |
| modal-layout: мобильные проверки | desktop | 2 |
| modal-layout: desktop-проверка | mobile | 1 |

Новый skip требует причины и владельца. `retries: 1` в CI не скрывает нестабильность: flaky gate должен блокировать её в release-проверке. Browser emulation не заменяет настоящий телефон.

## 5. Окружение и заявки

Источник истины по именам/defaults — `.env.example`, `lib/env.ts`, `scripts/check-env.mjs`. Не помещать секреты в README, коммиты, отчёты, URL remote или артефакты.

| Настройка | Роль / риск отключения |
|---|---|
| DATABASE_URL | PostgreSQL; `db/schema.ts`. In-memory не является устойчивым production-хранилищем |
| TEST_DATABASE_URL | Изолированная тестовая БД; тесты очищают таблицы |
| LEAD_API_ENABLED | 0 отключает приём, используется в preview |
| TELEGRAM_LEADS_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID | Серверная доставка Telegram |
| WEB3FORMS_ACCESS_KEY | Серверный резервный канал; не публичный клиентский ключ |
| CRON_SECRET | Авторизация retry и чтения лида по коду |
| LEAD_IDEMPOTENCY_ENABLED | Отключение возвращает более слабый legacy-дедуп |
| LEAD_OUTBOX_CLAIM_ENABLED | Отключение возвращает риск параллельной двойной доставки |
| LEAD_SERVER_RECALC_ENABLED | Отключение снова доверяет клиентским ценам; не штатное решение |
| LEAD_CONSENT_VERSION_REQUIRED | В строгом режиме stale/unknown consent отклоняется; согласовать политику |
| DELIVERY_ALERT_* | Алерт сбоев доставки; отдельный канал и согласованные пороги |
| AVAILABILITY_DB_ENABLED, AVAILABILITY_TOKEN | Календарь замеров и защищённая админка |
| CATALOG_LIVE_FEED2_ENABLED / STRICT | Управление live-feed; не подтверждение корректности каталога |
| NEXT_PUBLIC_PREVIEW_MODE | Build-time отключение боевой аналитики в preview |

Lead pipeline: проверка запроса/готовности → schema → idempotency/dedup → сохранение с outbox → доставка. HTTP-успех сохранения не означает доставку всех каналов. Retry использует lease/claim, batch size и max attempts из `app/api/lead/retry/route.ts`; текущие значения 20 и 5. Не удалять очередь или лиды при rollback.

`POST /api/lead/retry` с `Authorization: Bearer $CRON_SECRET` может отправлять реальные сообщения. Настройка реального cron — отдельная операция владельца. **Не считать Vercel GET-cron готовым для этого POST-only route:** в текущем дереве нет подтверждённой работающей production-конфигурации планировщика. Проверить метод/авторизацию/интервал/повтор после рестарта.

`GET /api/lead/<code>` защищён `CRON_SECRET`; не публиковать найденные клиентские данные. Договориться о retention и удалении по T8-006.

## 6. БД, календарь, каталог

Схема: `db/schema.ts`; миграции проверять до выпуска кода. Для outbox особенно важны `lease_until` и уникальность `(lead_id, channel)`. Не выполнять destructive SQL по старому отчёту; production-diff, backup и восстановление обязательны. Секретные подключения не печатать в лог.

Календарь: `/admin/availability`, пароль из `AVAILABILITY_TOKEN`. Проверить загрузку, добавить подтверждённые будущие окна, сохранить; пустой список означает «свободных окон нет», а не возврат к старому обещанию. API: `GET/PUT /api/admin/availability`. Конкретные даты в примере не копировать в production. Запасной файл устаревает и скрывает подпись; его срок не продлевать для зелёного теста. Флаг DB-off возвращает чтение файла, но не делает старые даты достоверными.

Каталог: `scripts/refresh-feed.mjs`, dry-run до любых изменений. `.github/workflows/refresh-catalog.yml` содержит weekly/manual запуск с FEED_URL и создаёт отдельный PR; это наличие механизма, не доказательство удачного импорта свежего XML. Не запускать его ради документационного изменения. T8-010/011/012 закрываются контрактами формата, единиц, atomic publish и реальной семантикой остатков, не только датой файла. Наличие на удалённом складе не превращать в «есть в Москве».

## 7. Наблюдаемость и диагностика

- `/api/health`: `ok`, `ready`, `storage`, признаки настроенных каналов, buildSha, uptime. Значения секретов не отдаёт; ответ no-store.
- `ready` оценивает конфигурацию/правило хранилища, **не выполняет реальный DB-запрос** и не доказывает успешную доставку.
- При инциденте: проверить актуальный деплой/SHA, оплату и состояние хостинга, HTTP/TLS/DNS, логи build/runtime, переменные, схему и очередь. Не менять DNS только из-за недоступности из одной среды.
- Мониторить публичные страницы и health; тест save→outbox→канал — только с разрешённым получателем/маркированными данными.
- Аналитика: имена событий/типы — `lib/analytics.ts`, точки входа — `lib/entry-context.ts`; не отправлять raw phone/name/адрес/текст поиска с ПДн. Бизнес-связь с продажей — T8-027; Webvisor — T8-035.

## 8. Допуск к production

- [ ] Владелец отдельно разрешил выпуск конкретного SHA и списка функций.
- [ ] Приняты дизайн, copy/claims, фото/права, юридическая сторона и согласие.
- [ ] В запускаемом сценарии нет открытых P0-R. Не готовый smart/sales-путь реально ограничен, а не только оговорён в тексте.
- [ ] Full QA с DB, строгий flaky gate и применимые secrets/security проверки; причины skips записаны.
- [ ] Ручные устройства/reader/zoom по B8-006; старые URL/якоря, draft и контекст лида сохранены.
- [ ] Проверены фактические production-ветка, SHA, домен/TLS, окружение и выключение preview-аналитики по назначению.
- [ ] Подтверждены схема/backup/restore, cron, outbox, алерты и ответственный на инцидент.
- [ ] Зафиксированы миграция и rollback без потери принятых заявок.
- [ ] После разрешённого merge подтверждён именно deployment целевого SHA и публичный результат; при необходимости разрешённый smoke-лид.

Откат — отдельный revert/предыдущая проверенная сборка, без переписывания истории и слепого удаления БД. Если full revert возвращает старый дефект теста или платформы, это явно отражается в STATUS, а не скрывается зелёным preview.

## Песочница с 2 ГБ RAM · UX-R1

Для проверочной сборки здесь использовать `RAYON_NUM_THREADS=1 NODE_OPTIONS=--max-old-space-size=640` и безопасные preview-флаги. Первая попытка с heap 1024 исчерпала память и была остановлена; не засчитывать её как успешную. Сборки запускать управляемым процессом, не одновременно с браузерной регрессией/БД; тайм-аут не означает остановку или успех. После освобождения памяти повтор с 640 выполнен успешно. Это настройка проверочной среды, не смена production runtime.
