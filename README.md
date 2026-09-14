This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Секреты

- `.env.local` удалён из индекса git (`git rm --cached`), `.gitignore` содержит `.env*` и `!.env.example`.
- **TODO (владелец):** `AMVERA_API_KEY` считать скомпрометированным — ротировать в кабинете провайдера.
- Перед коммитом желательно прогонять `gitleaks detect` (добавляется в CI в рамках T-090).

## Проверки

```bash
npm run lint            # 0 errors
npx tsc --noEmit        # 0 errors
npm run test            # vitest
npm run validate:catalog
npm run build           # 18 статических страниц
```

## Цели Яндекс.Метрики (T-025)

Счётчик `107200362`. Все события отправляются только через обёртки в `lib/analytics.ts`
(`ymReachGoal` / `ymVisitParams`) — вызывать `window.ym` напрямую из компонентов нельзя.
В кабинете Метрики нужно завести цели типа «JavaScript-событие» со следующими идентификаторами:

| Цель | Параметры | Где вызывается |
|---|---|---|
| `calculator_open` | `source`, `entry_mode`, `has_draft` | `calculator-modal-context.tsx` |
| `quiz_screen_view` | `screen`, `param`, `index`, `total`, `scenario` | `PriceCalculatorQuizV2.tsx` |
| `quiz_param_confirm` | `param`, `value`, `room_index` | `PriceCalculatorQuizV2.tsx` |
| `quiz_back` | `from` | `PriceCalculatorQuizV2.tsx` |
| `quiz_summary` | `total`, `rooms`, `scenario`, `minimum_applied` | `PriceCalculatorQuizV2.tsx` |
| `lighting_step_view` | `wstep`, `required_track_m`, `required_points` | `wizard-step1-lighting.tsx` |
| `lighting_system_selected` | `system` | `wizard-step1-lighting.tsx` |
| `lighting_skip` | `from` | `wizard-step1-lighting.tsx` |
| `lighting_kit_complete` | `items`, `total`, `auto_items`, `system` | `wizard-step1-lighting.tsx` |
| `lighting_conflict` | `from`, `to`, `removed_total`, `confirmed` | `wizard-step1-lighting.tsx` |
| `lighting_search` | `q`, `section`, `results` (дебаунс 800 мс) | `wizard-step1-lighting.tsx` |
| `lighting_cart_changed` | `action`, `sku`, `kind`, `qty` (дебаунс) | каталог освещения |
| `wizard_step_view` | `step`, `source` | `calculator-modal-context.tsx` |
| `calculator_close` | `step`, `screen`, `has_data`, `lead_sent` | `calculator-modal.tsx` |
| `lead_rescue_shown` / `lead_rescue_accepted` | `total` | rescue-диалог (T-026, PT-004) |
| `form_opened` | `form`, `source` | `action-form.tsx` |
| `lead_submit` | `placement`, `lead_kind`, `order_intent`, `grand_total`, `rooms`, `lighting_items`, `source`, `page_path`, `lead_id` | `action-form.tsx`, `lib/lead/rescue-lead.ts` |
| `lead_error` | `kind` (validation/network/server/ratelimit), `placement` | `action-form.tsx`, `lib/lead/rescue-lead.ts` |
| `messenger_click` | `messenger`, `placement`, `with_context` | Шаг 2, страницы услуг |

Параметры визита (`ym(id, "params", …)`): `calc_total` и `calc_scenario` — при каждой сводке
Шага 0; `lead_total` — при успешной отправке заявки.

## Мониторинг и что делать, если сайт не отвечает (PT-001)

### `/api/health`

```bash
curl -s https://potolkovo-msk.ru/api/health | jq
```

```json
{
  "ok": true,
  "ready": true,
  "storage": "db",
  "deliveryChannels": { "telegram": true, "web3forms": false },
  "buildSha": "abc123def456",
  "uptimeSec": 4218
}
```

Два поля отвечают на **разные** вопросы, и путать их нельзя:

| Поле | Что означает | Что делать при `false` |
|---|---|---|
| `ok` | процесс жив и отвечает | если ответа нет вовсе — сервис лежит, см. чек-лист ниже |
| `ready` | заявки реально сохранятся (есть БД) | сайт работает, но форма откажет — проверить `DATABASE_URL` |

`ok: true, ready: false` — валидное состояние: каталог, цены и страницы услуг
работают, а форма честно отказывает вместо тихой потери заявки. Монитор должен
разбудить владельца, но **не** перезапускать контейнер.

`uptimeSec` растёт между проверками. Если он сбросился — был рестарт, и все
заявки из режима `storage: "memory"` потеряны.

### Внешний мониторинг

Настраивается снаружи, доступ к панели Amvera не нужен. Подойдёт любой
синтетический монитор (UptimeRobot, healthchecks.io):

| URL | Ожидание | Интервал |
|---|---|---|
| `https://potolkovo-msk.ru/` | 200 | 5 мин |
| `https://potolkovo-msk.ru/uslugi` | 200 | 5 мин |
| `https://potolkovo-msk.ru/api/health` | 200 + тело содержит `"ready":true` | 5 мин |

Третья проверка — ключевая: первые две останутся зелёными, даже когда заявки
уже теряются.

### Чек-лист «сайт не отвечает»

1. **Оплата хостинга.** Проверить в первую очередь: недоступность 09–10.09.2026
   была вызвана именно этим, а не кодом.
2. `curl -I https://potolkovo-msk.ru/` — есть ли ответ вообще.
3. `curl -s .../api/health` — если `ok: true`, приложение живо, проблема в
   домене/прокси; если ответа нет — не поднялся контейнер.
4. Логи последнего деплоя в Amvera: чаще всего падает `prebuild`
   (`validate-catalog`, `check-file-size`, `check-effect-setstate`,
   `check-availability`) — он намеренно блокирует выкладку сломанного состояния.
5. Переменные окружения: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_CHAT_ID`. Проверять по `/api/health`, а не по памяти.
6. `containerPort` в `amvera.yaml` совпадает с портом, который слушает
   `next start`.

### Что эндпоинт намеренно не делает

Не ходит в БД с запросом. Проверка готовности — по факту наличия
конфигурации: health, который ждёт ответа базы, сам становится источником
таймаутов и начинает врать под нагрузкой.

## Приём заявок — `/api/lead` (T-027)

Все формы сайта отправляют JSON на `POST /api/lead`. Прямых обращений к Web3Forms
из браузера больше нет: клиентский ключ `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` удалён,
используется серверный `WEB3FORMS_ACCESS_KEY`.

Конвейер запроса: honeypot → готовность хранилища (PT-002) → rate-limit (5 запросов /
10 мин на IP) → zod-валидация (`lib/lead/schema.ts`) → **идемпотентность по `requestId`
(PT-009)** → дедуп по телефону **и отпечатку payload** за 10 минут → запись вместе с
заданиями доставки одной транзакцией (PT-003) → доставка в Telegram (основной канал)
и Web3Forms (дубль). Неуспешная доставка **не роняет** ответ: заявка уже сохранена, а
канал помечается `failed` и повторяется кроном.

Ответ: `{ ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" | "завтра с 9:00" }`.
Окно перезвона считается по времени сервера в зоне Europe/Moscow и рабочим часам 9:00–21:00.

| Переменная | Назначение |
|---|---|
| `LEAD_API_ENABLED` | `0` — вернуть 503 и не принимать заявки |
| `LEAD_IDEMPOTENCY_ENABLED` | `0` — аварийный откат PT-009: дедуп только по телефону, без проверки `requestId` |
| `LEAD_SERVER_RECALC_ENABLED` | `0` — аварийный откат PT-010: цена заявки берётся из запроса, без серверного пересчёта |
| `TELEGRAM_LEADS_ENABLED` | `0` — не отправлять в Telegram (Web3Forms продолжит работать) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | доставка в Telegram |
| `WEB3FORMS_ACCESS_KEY` | серверный ключ дубля на почту |
| `CRON_SECRET` | доступ к `POST /api/lead/retry` (заголовок `Authorization: Bearer …`) |
| `DATABASE_URL` | строка подключения к PostgreSQL; схема — `db/schema.ts` |

Повторная доставка: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/lead/retry`
— берёт до 20 упавших доставок, максимум 5 попыток на каждую.

## Отправка с клиента — один путь на все формы (PT-004)

Единственная клиентская функция отправки — `submitLead()` из `lib/lead/submit-lead.ts`.
Её используют и основная форма (`components/home/action-form.tsx`), и rescue-диалог
калькулятора (`components/calculator-modal/use-rescue-lead.ts`).

Контракт: функция **не бросает исключений**. Любой исход — значение
`LeadSubmitResult`, где успешная ветка существует только при `ok: true`:

```ts
const result = await submitLead(payload);
if (!result.ok) {
  // result.kind: "validation" | "ratelimit" | "unavailable" | "server" | "network" | "timeout"
  return;
}
// здесь result.leadId и result.callbackWindow доступны только после сужения типа
```

Так «забыть проверить ответ» становится технически невозможным. Именно эта
проверка отсутствовала в rescue-заявке: `fetch` не бросает исключение на HTTP
4xx/5xx, поэтому `markLeadSubmitted()` вызывался после `422/429/500`, модалка
закрывалась, а человек был уверен, что ему перезвонят.

Таймаут запроса — 15 с (`LEAD_SUBMIT_TIMEOUT_MS`). После PT-003 доставка в
Telegram/Web3Forms не входит в тело запроса, поэтому `/api/lead` отвечает быстро;
15 секунд — запас на холодный старт контейнера.

### Rescue-заявка

Показывается при закрытии калькулятора, если в нём есть расчёт и заявка ещё не
отправлена. Отличия от прежней версии:

- **Полный снапшот.** Уходит `LeadSnapshotV2` целиком — все комнаты с длинами
  профилей и количествами светильников плюс корзина света, а не одна сумма.
- **Явное согласие.** Чекбокс со ссылкой на `/privacy` из общего `content/legal.ts`;
  без отметки кнопка «Отправить» неактивна. `consent: true` больше не константа.
- **Честный статус.** Диалог ждёт ответа сервера: «Отправляю…», при отказе —
  причина и кнопка «Повторить». Escape и клик по подложке во время запроса
  игнорируются, иначе человек ушёл бы, не узнав исход.
- **Аналитика.** `lead_submit` считается только после `201` от сервера,
  `lead_error` — только после реального отказа.

`NEXT_PUBLIC_LEAD_RESCUE_ENABLED=0` отключает оффер целиком (пересборкой —
переменная публичная и подставляется на этапе build). Основная форма на Шаге 2
продолжает работать. Проверка ответа и согласие не флагуемые: их «выключенное»
состояние и есть тот дефект, который закрыт задачей.

## Идемпотентность вместо дедупа по телефону (PT-009)

До этой задачи «не плодить дубли» решалось поиском любой недавней заявки с тем же
номером: `findRecentByPhone(phone, 10 мин)` возвращал первую попавшуюся запись и
роут отдавал её код. Отсюда два дефекта.

1. **Потеря состава.** Человек закрывал калькулятор, оставлял короткий
   rescue-контакт, а через минуту отправлял полную заявку с расчётом. Сервер
   находил rescue-запись и отвечал её кодом: полная заявка не сохранялась нигде.
   Терялась ровно та информация, ради которой человек досчитывал комплектацию.
2. **Нет защиты от повтора как такового.** Дедуп держался на телефоне и окне в
   10 минут, а не на факте «это тот же самый запрос». Ответ на первую отправку
   мог не дойти (таймаут, обрыв), и клиент не имел способа спросить «а что с моим
   запросом?» — только отправить ещё раз.

### Как устроено теперь

Каждая попытка отправки несёт `requestId` — UUID, который `submitLead()`
подставляет сам (`lib/lead/request-id.ts`). Ключ живёт **до успеха** и меняется
вместе с содержимым:

| Ситуация | `requestId` | Результат |
|---|---|---|
| Двойной клик, повтор после таймаутa/`500`/обрыва | тот же | `200` + прежний код, `idempotentReplay: true` |
| Человек поправил имя, номер или состав заказа | новый | новая заявка |
| Успех, затем ещё одна отправка того же состава | новый | новая заявка |
| Тот же ключ при другом payload | — | `409 request_id_conflict` |

`409` при корректном клиенте недостижим — но если случится (баг, рассинхрон
вкладок), `submitLead()` сбрасывает ключ, чтобы следующая попытка ушла с новым.
Иначе форма встала бы намертво: повтор с тем же ключом давал бы тот же `409`.

Сервер хранит `request_id` и `payload_hash` (sha256 канонического payload,
`lib/lead/payload-hash.ts`). На `request_id` лежит unique-индекс, поэтому гонку
двух параллельных отправок ловит ограничение БД, а не проверка «существует ли
заявка»: проигравший запрос перечитывает запись по ключу и отдаёт прежний код
вместо `500`.

Дедуп по телефону **остался** как анти-спам эвристика, но больше не подменяет
идемпотентность: дублем считается совпадение и номера, и отпечатка payload
(`findRecentIdentical`). Тот же номер с другим составом — новая запись.

Идемпотентность проверяется **раньше** серверного rate-limit. Повтор — не новая
заявка: если он упрётся в лимит и получит `429`, клиент решит, что заявка не
прошла, хотя она уже записана и доставляется. Это хуже дубля: дубль видно в CRM,
а ложный отказ заставляет человека звонить и отправлять снова.

### Аварийный откат: `LEAD_IDEMPOTENCY_ENABLED`

Правило 8 раздела 2 ТЗ: новая логика приёма заявок включается отдельным флагом,
чтобы её можно было откатить без деплоя нового кода. `LEAD_IDEMPOTENCY_ENABLED=0`
возвращает поведение до PT-009:

- повтор `requestId` не проверяется, `409` не отдаётся;
- дублем снова считается **любая** недавняя заявка с тем же телефоном.

Дефолт `1`. Выключенный флаг — не нейтральное состояние, а воспроизведённый
дефект: полная заявка после rescue снова получит код короткой rescue-заявки, а её
состав не сохранится нигде. Это закреплено тестом
(`tests/lead-idempotency.test.ts` → «возвращается прежний дефект»), чтобы откат не
выглядел бесплатным для того, кто решит им воспользоваться.

Обработка гонки unique-индексом флагом **не** выключается: само ограничение
`leads_request_id_key` в БД остаётся, и без перехвата параллельная отправка дала бы
`500` вместо ответа. `requestId` и `payload_hash` продолжают записываться и при
выключенном флаге — повторное включение не теряет историю.

### Совместимость и миграция

`requestId` в схеме — необязательное поле. Раздел 3.8 требует совместимости API
на время миграции (`expand → migrate → switch → contract`), а собранный до
деплоя клиентский JS в браузере посетителя ещё какое-то время шлёт запросы без
него. Делать поле обязательным сразу — значит получить волну `422` от живых
людей на уже открытых страницах. Без `requestId` работает дедуп по телефону и
отпечатку.

Колонки `request_id` и `payload_hash` — nullable, существующие заявки не
переписываются. В PostgreSQL unique-индекс считает NULL-значения различными,
поэтому накопленные строки ограничению не мешают. Откат кода на предыдущую
версию безопасен: старые запросы эти колонки не читают и не пишут.

Обновление боевой БД — `db/init.sql`, блок «МИГРАЦИЯ PT-009» (скрипт идемпотентен):

```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS request_id   text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payload_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS leads_request_id_key ON leads (request_id);
CREATE INDEX IF NOT EXISTS leads_phone_hash_created_idx
  ON leads (phone, payload_hash, created_at DESC);
```

### Что осталось прежним

Ограничение частоты в памяти процесса (`checkRateLimit`, 5 запросов / 10 мин на
IP) считает и повторы: оно срабатывает до разбора тела, иначе флуд заставлял бы
сервер разбирать JSON и гонять zod на каждом запросе. Легитимный сценарий
«двойной клик + пара повторов после сбоя» в этот лимит укладывается с запасом, а
заявка при `429` уже сохранена — теряется только точность сообщения, не данные.

## База данных (N-001)

Заявки хранятся в PostgreSQL через Drizzle ORM. Схема — `db/schema.ts`
(таблицы `leads` и `lead_deliveries`, Приложение Б ТЗ).

**Подключение.** Подойдёт любой managed-провайдер: Neon (free-тариф достаточен),
Vercel Postgres или Amvera Postgres. Строку подключения положить в `DATABASE_URL`,
затем применить схему:

```bash
npx drizzle-kit push
```

**Что ломается без БД.** При пустом `DATABASE_URL` включается `InMemoryLeadStore`
(и пишет предупреждение в лог). Он годится для локальной разработки, но на
serverless теряет данные при каждом холодном старте, а вместе с ними:

- идемпотентность и дедуп (PT-009) — клиент, нажавший «отправить» дважды,
  создаст две заявки, если между нажатиями произойдёт холодный старт;
- серверный rate-limit — защита от спама обходится тривиально;
- очередь ретраев — упавшая доставка не будет повторена;
- поиск по коду заявки — клиент назовёт «К7F3Q», мастер не найдёт.

**Rate-limit** двухуровневый: сначала быстрая проверка в памяти процесса, затем
`count(*)` по БД за окно 10 минут (5 заявок на IP). Если БД недоступна, проверка
пропускается с записью в лог: потерять заявку хуже, чем пропустить лишний запрос.

**Поиск заявки.** `GET /api/lead/<код>` с заголовком `Authorization: Bearer $CRON_SECRET`
возвращает заявку по короткому коду.

**Cron повторной доставки.** На Vercel — `vercel.json`:

```json
{ "crons": [{ "path": "/api/lead/retry", "schedule": "*/15 * * * *" }] }
```

Вне Vercel — любой планировщик, дёргающий тот же URL с `CRON_SECRET`.

**Тесты.** Интеграционные тесты (`tests/lead-store-pg.test.ts`,
`tests/lead-route-db.test.ts`) запускаются только при заданном `TEST_DATABASE_URL`
и пропускаются без него. Локально поднять БД можно так:

```bash
initdb -D /tmp/pgdata -U postgres --auth=trust
postgres -D /tmp/pgdata -p 5433 &
createdb -h 127.0.0.1 -p 5433 -U postgres potolkovo_test
DATABASE_URL="postgres://postgres@127.0.0.1:5433/potolkovo_test" npx drizzle-kit push --force
TEST_DATABASE_URL="postgres://postgres@127.0.0.1:5433/potolkovo_test" npm run test
```

## Обновление каталога (N-041)

Фид поставщика **не обновляется сам** — это единственный источник цен на сайте,
и без регламента он тихо стареет.

```bash
FEED_URL="https://…" node scripts/refresh-feed.mjs --dry-run  # показать дельту цен
FEED_URL="https://…" node scripts/refresh-feed.mjs            # обновить снапшот
```

Скрипт скачивает фид, сверяет его с текущим снапшотом и пересобирает производные
файлы (`validate-catalog` → `build-catalog-index` → `build-catalog-images`).
Он **отказывается** перезаписывать данные, если фид пуст, сменил формат или
похудел больше чем вдвое: почти всегда это сбой выгрузки, а не распродажа.

Автоматически это делает `.github/workflows/refresh-catalog.yml` — по
понедельникам в 06:00 UTC и по кнопке (`workflow_dispatch`). Workflow не пишет в
`main`, а открывает PR с топ-20 изменений цены в теле. Нужен секрет `FEED_URL`.

Если прайс старше **45 дней** (`isStale`, `lib/lighting/catalog-index.ts`), на
странице света вместо даты показывается плашка «Цены могли измениться».

## Бюджет клиентского бандла (T-029)

Полный фид `data/eks-feed2-snapshot.json` (~940 КБ) — **серверный** ресурс. Клиентские
компоненты обязаны читать каталог через `useCatalogProducts()` / `getCatalogIndex()`.
Проверка: `grep -r eks-feed2-snapshot.json components/` должен давать 0 совпадений.

`prebuild` генерирует три файла из фида (`scripts/build-catalog-index.mjs`):

| Файл | Размер | Назначение |
|---|---|---|
| `data/catalog-index.json` | ~105 КБ (лимит 120) | каталог для клиента: кортежи + словари enum'ов |
| `data/catalog-prefill.json` | ~14 КБ (лимит 20) | артикул → вид, система, длина в мм |
| `data/proof-pricing-inputs.json` | ~12 КБ | цены и трековые профили для витрин главной |

Индекс закодирован колоночно: товар — кортеж, а `system/kind/unit/socket` вынесены
в словари, у картинок отрезан общий префикс. Прямой JSON тех же полей весил бы 184 КБ.
Расшифровка — в `lib/lighting/catalog-index.ts`, потребители получают привычный
`FeedCatalogProduct[]`.

Бюджет First Load JS: **главная ≤ 300 КБ (gzip)**, проверяется `npm run check:bundle`
после `next build`. Текущее значение — 212.7 КБ (было 269 КБ до выноса фида).
Калькулятор монтируется лениво (`calculator-modal-gate.tsx`): его чанк грузится
только после первого `openCalculator()`, а падение перехватывает ErrorBoundary
с текстом «Не получилось загрузить калькулятор — напишите в Telegram».

## Стор калькулятора (T-030)

Состояние Шага 0 живёт в чистом редьюсере `lib/calculator/reducer.ts`; движок
`use-ceiling-calculator-engine.ts` стал тонким хуком над `useReducer` и сохранил
прежний публичный API, поэтому экраны квиза не переписывались.

Производные величины — **только селекторы**, не поля состояния:

| Селектор | Кто читает |
|---|---|
| `selectTotals` | PriceStrip, сводка Шага 0, Шаг 2, стики-бар, письмо лида |
| `selectRequirements` / `selectRequirementsFromBreakdown` | мастер Шага 1, футерный прогресс, Шаг 2 |
| `selectExtraInstall` | досчёт монтажа за позиции сверх заложенных в потолке |
| `selectFooterAction` / `selectBackVisible` | футер модалки |
| `calcProgress` / `paramPosition` | полоска «Шаг N из M» |

Инвариант: `grand = ceilingApplied + extraInstallRub + lightingEffective`.
Досчёт монтажа считается только вверх: если корпусов в корзине меньше, чем
заложено в потолке, ничего не вычитается — монтаж уже оплачен в потолке.

Знаменатель прогресса фиксирован для сценария (`maxParamsForScenario`), поэтому
полоска не прыгает, когда выбор теневого профиля добавляет вопрос в середине
опроса. Индикатор один: макро-шаги в шапке (`nav` + `aria-current`) и тонкая
полоска внутри Шага 0; дублирующие точки на мобильном удалены.

Правило на будущее: `useEffect` не используется для синхронизации состояний.
Проверка — `useEffect` с `set[A-Z]` внутри в `components/calculator-modal/**`
допустим только для навигации, фокуса и загрузки данных.

## E2E в CI: сборка передаётся тарболом, а не каталогом

Job `build` собирает приложение один раз, job `e2e` переиспользует сборку.
Передача идёт через артефакт `next-build`.

**Каталоги в `path:` у `actions/upload-artifact@v4` передавать нельзя.**
Долгое время шаг выглядел так:

```yaml
path: |
  .next
  public/optimized
  data
```

v4 молча пропускает каталог, начинающийся с точки, поэтому `.next` в артефакт
не попадал. Артефакт выходил 3 295 442 байта вместо 8 628 462 — ровно столько
дают одни `public/optimized` (3,4 МБ) и `data` (1,4 МБ), которые к тому же
закоммичены и есть в чекауте сами по себе.

Job `e2e` распаковывал артефакт, не находил production-сборки, и `next start`
завершался с кодом 1:

```
Error: Could not find a production build in the '.next' directory.
```

Playwright при этом печатает только

```
Error: Process from config.webServer was not able to start. Exit code: 1
```

— без причины. Тесты не запускались вовсе, `playwright-report` не создавался,
и шаг «Отчёт при падении» рапортовал «No files were found». Со стороны это
неделями выглядело как «в CI падают e2e», хотя набор был зелёный.

### Как устроено теперь

```yaml
# build
- run: tar -czf next-build.tar.gz .next public/optimized data
- uses: actions/upload-artifact@v4
  with:
    path: next-build.tar.gz
    if-no-files-found: error

# e2e
- uses: actions/download-artifact@v4
  with:
    name: next-build
- run: |
    tar -xzf next-build.tar.gz
    rm -f next-build.tar.gz
    test -f .next/BUILD_ID
```

Три свойства, ради которых это сделано:

1. **Один обычный файл вместо точечных каталогов** — поведение glob в
   upload-artifact больше не влияет на результат.
2. **`if-no-files-found: error`** — пустой артефакт валит job `build` сразу,
   а не проявляется непрозрачным падением в `e2e`.
3. **`test -f .next/BUILD_ID`** отдельным шагом — если сборка снова не доедет,
   причина будет видна в шаге с внятным именем, а не в логе Playwright.

Побочно `tar` сохраняет симлинки и права доступа, чего v4 не делает. В `.next`
есть симлинк `.next/node_modules/pg-<hash> -> ../../node_modules/pg`, на него
ссылаются серверные чанки API-роутов. На старте `next start` он не нужен
(проверено), но при обращении к `/api/lead` и `/api/health` — нужен.

### Правило на будущее

Если e2e в CI падают с `Process from config.webServer was not able to start`,
сначала проверяют не тесты, а то, доехала ли сборка: размер артефакта виден в
`GET /repos/<owner>/<repo>/actions/runs/<run_id>/artifacts` без авторизации.

## Подписи кнопок Шага 0 — один источник

Единственный источник подписей кнопки подтверждения на Шаге 0 —
`getParamConfirmLabel` в `lib/step0-fsm.ts`. Её читает
`lib/calculator/selectors.ts` при сборке действия футера.

Дубль `STEP0_CONFIRM_LABELS` в `lib/calculator-flow.ts` удалён: он был мёртвым
кодом (его не импортировал никто, включая собственный алиас типа
`Step0ConfirmStepId`) и успел разойтись с живым значением для `lights`. Третье
значение жило в `scripts/test-calculator-flow.mjs` — блок «Step 0 confirm labels
are stable» звал функцию `resolveStep0ConfirmLabel`, которой в
`calculator-flow.ts` не было никогда, и падал с `TypeError`.

Итог: на один текст кнопки было три источника, и все три разные.

### `lights` — «Подтвердить светильники →»

Было «Подтвердить свет →». Слово «свет» не встречалось на этом экране больше
нигде, зато «светильники» — четырежды: заголовок «Монтаж: точечные светильники»,
опции «Без светильников» и «Добавить светильники», поле «Количество
светильников» (`components/calculator-modal/step0/quiz-v2/screens/ParamScreen.tsx`).
На Шаге 1 тот же концепт уже назывался «Подтвердить светильники →»
(`lib/lighting/step1-footer-action.ts`).

Это соответствует действующему правилу копирайта, закреплённому тестом
`e2e/points-screen.spec.ts` → «копирайт: «светильники» вместо «точек»»
(`expect(body).not.toMatch(/\bточк/i)`). Вариант «Подтвердить точки →», который
ожидал сломанный харнесс, этому правилу противоречил.

Инвариант `e2e/step0-footer-sync.spec.ts` сохранён: экран «Монтаж: точечные
светильники» требует в подписи `/свет/i` — «светильники» подходит.

### Почему подписи не проверяются в `scripts/test-calculator-flow.mjs`

Харнесс транспилирует `lib/calculator-flow.ts` в изолированный модуль через
`node:vm` и **не разрешает импорты**, поэтому проверить там можно только то, что
определено в самом этом файле. Подписи живут в другом модуле — их проверяет
`tests/step0-fsm.test.ts` (блок «Подписи кнопок Шага 0») в vitest, где импорты
работают штатно. Покрытие: точные значения всех девяти параметров, отсутствие
пропусков относительно `ALL_PARAMS` и единая форма «Подтвердить <что> →».

Правило на будущее: новый текст в калькуляторе добавляется в один источник, и
рядом с ним — ассерт. Копия текста в соседнем модуле расходится молча.

## Восстановление черновика — только с согласия пользователя (PT-007)

Раздел 3.2 ТЗ: сохранённый расчёт не применяется и не перезаписывается сам —
сначала явный выбор человека. До этой задачи черновик не восстанавливался
вообще, а экран «Продолжить прошлый расчёт?» был мёртвым кодом.

### Что было сломано

1. **Черновик не читался никогда.** Эффект чтения начинался с `if (preset)
   return; // пресет страницы важнее черновика`. Но обёртка Шага 0
   (`wizard-step0-calculator.tsx`) всегда передаёт `preset={resolvedPreset}`, а
   контекст модалки подставляет заглушку `{ ceilingType: "standard",
   areaDefault }`, даже когда страница ничего не передала. То есть `preset` был
   истиной на любом входе, включая обычный вход с главной.
2. **Происхождение пресета определялось наличием объекта.** Различить «заглушка
   контекста» и «данные со страницы» по самому объекту нельзя — нужен
   типизированный признак источника.
3. **Корзина света терялась.** `engine.restoreFromDraft` возвращает комнаты;
   освещение живёт в контексте модалки, и его при восстановлении никто не
   трогал.
4. **Чужая запись перезаписывалась молча.** `readCalcDraft` возвращал `null` и
   когда черновика нет, и когда он не читается (чужая версия, битый JSON).
   Вызывающий не мог отличить одно от другого и затирал запись новым расчётом.

### Как устроено теперь

- `presetOrigin: "default" | "page" | "explicit"` (`lib/calculator-modal-types.ts`)
  — раздел 3.1 ТЗ. `"default"` — заглушка контекста (обычный вход с
  главной/хедера), `"page"` — частичные данные страницы услуги, `"explicit"` —
  полный пресет конкретного кейса («Спальня 12 м²», карточка работы). Значение
  задают вызывающие стороны: `components/home/home-price-examples.tsx`
  (`"explicit"`) и `components/home/home-proof.tsx` (`"explicit"`, если у кейса
  есть `actionPreset`, иначе `"page"`).
- `inspectCalcDraft()` (`lib/calculator/draft.ts`) возвращает
  `CalcDraftRead = { status: "empty" } | { status: "ok"; draft } |
  { status: "unreadable"; reason: "unknown-version" | "corrupt" }`. Просроченный
  черновик (старше `CALC_DRAFT_TTL_MS` = 12 ч) намеренно считается `empty`:
  предлагать его нельзя, значит и показывать отказ незачем. `readCalcDraft`
  оставлен обёрткой — прежние вызовы не меняются.
- Состояние `draftSettled` в квизе гейтит три эффекта: применение пресета
  страницы, сохранение нового черновика и сам переход к расчёту. Пока решения
  нет, не происходит ни того, ни другого — иначе пресет успевал создать комнату,
  и первый же пересчёт затирал сохранённые данные.
- Экран выбора вынесен в
  `components/calculator-modal/step0/quiz-v2/DraftRestoreChoice.tsx`
  (`data-draft-choice="offer" | "unreadable"`, `data-draft-origin`,
  `data-draft-action="continue" | "start-new"`). Отдельный файл — из-за лимита
  стража `check-file-size.mjs`: квиз и так занимает 529 строк из 600.
- «Продолжить расчёт»: комнаты — через `engine.restoreFromDraft`, корзина света
  — через `setLightingDraft(draft.cart)`, плюс `setHasInteracted(true)` при
  наличии позиций (N-050: без этого флага форма не прикладывает снапшот к
  заявке), история — на экран «Проверка», `presetAppliedRef.current = true`
  (пресет страницы уже применять нельзя).
- «Начать новый расчёт»: `clearCalcDraft()` — запись снимается только явным
  выбором, включая нечитаемую.
- Подписи различаются по источнику: при `default` — «Начать новый расчёт», при
  `page`/`explicit` — «Начать расчёт по этому кейсу» плюс пояснение, что
  параметры примера применены не будут.

### Что намеренно не сделано (граница с PT-008)

**Режим скидки на первом экране после восстановления.** Флаг
`lightingDiscountEligible` ставится только в `goToStep(0→1)` и в черновике не
хранится (`draftFromCart` в `lib/lighting/use-lighting-cart.ts` не пишет
`discountMode`). Поэтому сразу после «Продолжить» на экране «Проверка» свет в
сводке показан без скидки — ровно как в новой сессии на том же экране, — а −25 %
возвращается при первом же переходе на Шаг 1 или к итогу. Данные при этом не
теряются: позиции, количества и `withCeilingDiscountedTotalRub` лежат в
черновике и сверяются тестом.

Правка затрагивала бы отображение цен и поля скидки в снапшоте заявки
(`lightingDiscountApplied`), поэтому в рамках PT-007 не выполнялась — системно
вопрос решается в **PT-008** вместе с `EntryContext`, где точка входа и
производные от неё режимы описываются целиком. Полный `EntryContext` — тоже
PT-008, не эта задача.

> **Уточнение по итогам PT-008.** `EntryContext` реализован (см. раздел ниже),
> но режим скидки после восстановления черновика в него не вошёл: флаг
> `lightingDiscountEligible` ставится в `goToStep(0→1)`, а не в точке входа, то
> есть к контексту входа отношения не имеет. Правка остаётся отдельной задачей —
> см. «Что намеренно не сделано» в разделе PT-008.

### Тесты

- `tests/draft.test.ts` — 15 тестов: `inspectCalcDraft` (пусто / успешное чтение
  / чужая версия / битый JSON / просрочка / отсутствие `rooms`), обратная
  совместимость `readCalcDraft`, раундтрип корзины света через черновик.
- `e2e/draft-restore.spec.ts` — 5 сценариев × 2 проекта (1 пропуск на мобильном:
  карточки каталога существуют только в desktop-раскладке):
  обычный вход показывает выбор и не применяет черновик; «Начать новый» отменяет
  прежний; явный пресет кейса не подменяет черновик автоматически; пресет
  применяется после «Начать расчёт по этому кейсу» (плашка F-10); нечитаемая
  запись — явный отказ без молчаливой перезаписи; «Продолжить» возвращает
  комнату, сумму потолка, состав корзины (7 поз.) и суммы со скидкой −25 %.
- `e2e/area-screen.spec.ts` — тест F-10 открывает калькулятор дважды в одной
  вкладке и теперь очищает черновик между открытиями: иначе второе открытие
  попадает на экран выбора, и плашка предзаполнения за ним не видна.
- `e2e/helpers.ts` — общие `CALC_DRAFT_KEY` и `clearCalcDraftStorage(page)`.
- `scripts/check-effect-setstate.mjs` — `setPendingDraft`/`setDraftSettled`
  внесены в `ALLOWED_SETTERS` (чтение `sessionStorage` — внешний источник,
  недоступный при рендере); прежние `setDraft`/`setDraftDecided` удалены вместе
  с состоянием.

### Откат

Изменения локальны: `git revert` коммита возвращает прежнее поведение (черновик
не читается, пресет применяется сразу). Формат записи в `sessionStorage` не
менялся — ключ `potolkovo:calc-draft:v2` и схема те же, поэтому черновики,
сохранённые новой версией, читаются и старой.

## Контекст входа в квиз: пресет доезжает целиком (PT-008)

Раздел 3.1 ТЗ (стр. 75) и задача PT‑008 (стр. 150): точка входа в калькулятор
описывается типизированным `EntryContext`, пресет страницы или кейса
переносится целиком, а услуги, по которым типовой расчёт нечестен, не открывают
калькулятор вовсе.

### Что было сломано

1. **Пресет терял 11 полей из 19.** `wizard-step0-calculator.tsx` собирал
   `resolvedPreset` руками и копировал восемь полей: `ceilingType`,
   `areaDefault`, `corniceType`, `trackType`, `lightsEnabled`, `lightsCount`,
   `introNote`, `lightingDefault`. Не доезжали `shadowLengthDefault`,
   `floatingLengthDefault`, `trackLengthDefault`, `lightLinesEnabled`,
   `lightLinesLengthDefault`, `corniceLengthDefault`,
   `corniceLightingEnabled`, `corniceLightingLengthDefault`,
   `corniceLightingPowerSuppliesDefault`, `roomLabelDefault` и
   `calculationScopeDefault`. Приёмочный кейс главной
   `shadow-track-apartment` (18 м² / 19 м теневого профиля / 10 м трека /
   «Кухня-гостиная») открывался с 17 м профиля (`round(4·√18)`), 4 м трека
   (периметр/4) и помещением «Помещение» — то есть ровно те цифры, которые
   кейс обещает в карточке, человек в калькуляторе не видел.
2. **Площадь страницы подменялась на 18 м².** `areaDefault` брался из пресета
   только при `forcePreset`, а его ставили лишь карточки примеров. Hero,
   mid-CTA, стики и тизер страницы «Теневой профиль» открывали 18 м² вместо
   своих 22 м², «Световые линии» — 18 вместо 24.
3. **Хедер не читал контекст страницы.** Общий хедер сайта на любой странице
   услуги отправлял `source: "home:header"` и типовой пресет: в заявке было
   невидно, с какой услуги пришёл человек (T-021).
4. **Источник распознавался подстрокой.** `src.includes("tenevoy-profil")`,
   `startsWith("track-sale")`, `endsWith(":proof")` — раздел 3.1 прямо требует
   типизированный union вместо разбора произвольной строки.
5. **Список отключённых услуг был неполным, а точки входа его игнорировали.**
   В `DISABLED_PRESET_SLUGS` были только светопрозрачные потолки;
   `individualnye-proekty` отсутствовали. Hero, хедер и стики не смотрели на
   `presetDisabled` вообще: на странице светопрозрачных потолков общий хедер
   открывал типовой калькулятор и показывал сумму, которая для такой услуги
   ничего не значит (висит с T-021).
6. **Экраны профиля не включались при входе с пресетом** (найдено при
   написании E2E). `presetRoomId` в `PriceCalculatorQuizV2.tsx` читался из
   состояния движка в том же тике, что и диспатч пресета
   (`engine.activeRoomId ?? engine.rooms[0]?.id ?? "object"`), а
   `createInitialState` даёт `rooms: []`, `activeRoomId: null` — поэтому id
   всегда получался `"object"`, тогда как `initFromPreset` создаёт комнату
   `"room-1"`. `enabledParams` ищет комнату по `screen.roomId`, не находил её и
   считал `shadowEnabled`/`floatingEnabled` ложными: экраны «Длина теневого
   профиля» и «Длина парящего профиля» не попадали в последовательность ни на
   странице «Теневой профиль», ни в кейсе с 19 м. Метры при этом участвовали в
   сумме (57 450 ₽ в кейсе) и в тексте Telegram-ссылки — человек не мог их ни
   увидеть, ни поправить.
7. **Копирайт «Калькулятор ниже…»** на страницах, где калькулятора нет:
   `price.sectionIntro` и `calculatorPreset.introNote` у светопрозрачных
   потолков и у индивидуальных проектов обещают расчёт, которого на странице
   больше не будет.

### Как устроено теперь

- **`lib/entry-context.ts`** (новый): `EntryContext = { pagePath, serviceSlug,
  placement, entryMode, intent, presetOrigin, preset }` — состав из раздела 3.1
  ТЗ; `EntryPlacement` — union из 10 точек входа (`header`, `hero`, `mid`,
  `sticky`, `teaser`, `price`, `proof`, `action`, `example`, `catalog`);
  `PresetOrigin = "default" | "page" | "explicit"`. Чистые функции:
  `resolveEntryPreset()`, `buildEntrySource()`, `entryToCalculatorOptions()`,
  `projectEntryCtaLabel()`.
- **Правило площади** (`resolveEntryPreset`): пресета нет → заглушка
  `{ ceilingType: "standard", areaDefault: DEFAULT_CALCULATOR_AREA }`;
  `presetOrigin !== "default"` или `forcePreset` → пресет целиком, без правок;
  обычный вход (`"default"`) → пресет целиком, но площадь — дефолт прайса.
  Решение владельца: площадь пресета страницы побеждает при `page`/`explicit`,
  18 м² остаются только для входа без пресета.
- **Провайдер и фолбэк** (`components/calculator-modal/page-context.tsx`):
  страницы услуг отдают `preset` и `sourceSlug` в
  `CalculatorPageContextProvider`, всё остальное (главная, каталог, приватность)
  получает те же значения через фолбэк `useCalculatorPageContext()`. `pagePath`
  берётся из `usePathname()`, а не передаётся руками. Наружу —
  `entry`, `preset`, `presetDisabled`, `entryFor()`, `optionsFor()`,
  `sourceFor()`, `projectCtaLabel`. Поле `scenario` из старого контекста
  удалено: его никто не читал, сценарий определяет Шаг 0.
- **Формат источника сохранён** — `"<slug>:<placement>"` (`home:header`,
  `tenevoy-profil:hero`, `shadow-track-apartment:proof`, …): его читают
  сохранённые заявки, аналитика и отчёты. Собирать его вручную компоненты
  больше не могут — только через `optionsFor(placement)`.
- **Сценарий Шага 0** определяется по `serviceSlug` из контекста
  (`resolveInitialSolutionScenario`), а не по подстроке источника; строковый
  разбор оставлен запасным путём для входов вне контекста (каталог света).
  `serviceSlug` и `pagePath` проброшены в `openCalculator`
  (`lib/calculator-modal-types.ts`) и в `trackCalculatorOpen` — событие
  `calculator_open` получило поле `page_path` (`lib/analytics.ts`).
- **Услуги без честного расчёта.** `DISABLED_PRESET_SLUGS` =
  `svetoprozrachnye-potolki` + `individualnye-proekty`. Контекст не отдаёт
  пресет такой страницы и ставит `intent: "advanced"`, а **все** точки входа —
  хедер, hero, mid-CTA, мобильный стики, «Хочу так же» на карточке примера и
  блок цены — становятся якорями на `#action` с подписью «Обсудить проект»
  (решение владельца). Текст берётся из `resolveStep2Copy("advanced").submitLabel`,
  то есть совпадает с кнопкой отправки формы и не может с ней разойтись; в
  хедере на мобильном — «Обсудить» (там же, где и прежде «Рассчитать»).
- **Копирайт секции «Цена»** подменяется на уровне компонента
  (`ServicePriceSection.tsx`): вместо `price.sectionIntro` показывается
  `price.note` этой же услуги, `calculatorPreset.introNote` не выводится, а
  тизер калькулятора заменяется блоком «по проекту»
  (`data-testid="project-entry-block"`, кнопка `project-entry-cta`). Заголовок
  блока свой для каждого слага, цена в нём — из `servicePriceAnchor()`
  (`content/pricing.ts`), не литералом. Файлы `content/*.ts` не правились
  (правило 0.4 ТЗ v2).
- **`initFromPreset` возвращает id созданной комнаты**
  (`lib/calculator/use-calculator-engine.ts`), и история экранов начинается с
  настоящей комнаты — экраны профилей включаются, длины из пресета видны и
  редактируемы.

### Приёмка

- Матрица «9 услуг × точки входа» — `e2e/entry-context.spec.ts`: хедер, hero,
  mid-CTA и мобильный стики на всех семи услугах с честным расчётом открывают
  квиз с площадью пресета страницы; на двух отключённых — якоря на форму,
  модалки нет в DOM.
- Кейс `shadow-track-apartment` с главной: 18 м², «Кухня-гостиная», 19 м
  теневого профиля, 10 м трека — одинаково в интерфейсе и в перехваченной
  заявке (`snapshot.rooms[0]`).

### Тесты

- `tests/entry-context.test.ts` — 19 тестов: все 19 полей пресета доходят до
  результата; пресеты всех 9 услуг переносятся без потерь; правило площади по
  `presetOrigin`/`forcePreset`; приёмочный кейс (18/19/10 + метка помещения) и
  регрессия прежнего поведения (17 м профиля, 4 м трека); `buildEntrySource`;
  `entryToCalculatorOptions` (source, `serviceSlug`, `pagePath`, `forcePreset`,
  `entryMode`, приоритет overrides); `DISABLED_PRESET_SLUGS` и
  `projectEntryCtaLabel`.
- `tests/presets.test.ts` — пресеты обеих отключённых услуг помечены
  `disabled`.
- `e2e/entry-context.spec.ts` — 11 сценариев × 2 проекта (2 пропуска: стики
  существует только в мобильной раскладке, `lg:hidden`).
- `e2e/service-preset.spec.ts` — включён `test.fixme` «сценарий 3 (полный)»:
  CTA услуги теперь действительно подставляет 22 м² и выбранный «Теневой
  потолок» (проверяется `aria-pressed` на следующем экране).

### Что намеренно не сделано

- **Режим скидки после восстановления черновика** (`lightingDiscountEligible`,
  `discountMode`) — остаток из PT-007. Флаг ставится в `goToStep(0→1)`, а не в
  точке входа, поэтому к `EntryContext` отношения не имеет; правка затрагивает
  схему черновика, показ цен на «Проверке» и поле `lightingDiscountApplied` в
  снапшоте заявки. Вынесено в отдельную задачу, в этом коммите не выполнялось.
- **Каталог света и поток продажи треков** мигрированы не полностью.
  `ServiceHeroLightingCta` переведён на контекст (получает `pagePath` и
  `serviceSlug`), но источник остаётся `track-sale:hero` — его читают
  интро-баннер потока и отчёты по заявкам, а пресет страницы к этому входу
  намеренно не подмешивается (вход открывается сразу на Шаге 1, метры трека
  считаются из подобранных позиций). `CatalogSectionClient` и
  `LightKitCtaButton` работают со своими источниками `track-sale:*` и
  контекстом не пользуются.
- **`proofContext`/`isTrackSaleFlow` в обёртке Шага 0** по-прежнему разбирают
  строку `source` (`endsWith(":proof")`, `startsWith("track-sale")`): от них
  зависят только тексты интро-баннера и подпись кейса, а не параметры расчёта.
  Перевод на `EntryContext` — отдельная правка, чтобы не смешивать её с
  переносом пресета.
- Feature-флага нет (решение владельца) — откат только через `git revert`.

### Откат

`git revert <этот коммит>` возвращает прежнее поведение: ручную сборку пресета
в обёртке Шага 0, 18 м² на всех входах, `home:header` в качестве источника на
страницах услуг и калькулятор на страницах светопрозрачных потолков и
индивидуальных проектов. Формат источника, схема черновика
(`potolkovo:calc-draft:v2`) и поля заявки не менялись — старые записи и заявки
читаются как прежде. `data/page-dates.json` в коммит не включён: файл
генерируется `scripts/build-page-dates.mjs` по истории git и обновится сам на
следующей сборке после мержа.

## Сервер не доверяет цене от клиента (PT-010)

ТЗ v5, стр. 161; источники A-08 (MD, F-10), A-10, T-311.

### Что было сломано

`app/api/lead/route.ts` брал сумму заявки прямо из тела запроса:

```ts
const grandTotal = payload.snapshot?.totals.grand ?? payload.totals?.grand ?? payload.grandTotal ?? 0;
```

Это число становилось авторитетным: писалось в `leads.grand_total` и уходило в
тему письма мастеру. Рядом лежали `snapshot.lighting.items[].priceRub` и
`discountPercentApplied` — тоже из запроса, тоже без проверки. Открыть DevTools,
поправить `grand` на `1` и отправить форму мог любой: заявка на 1 ₽ приезжала в
БД и в Telegram как настоящая.

Пересчитать честно сервер и не мог. `LeadRoomSnapshotSchema` несла только
лейблы («Теневой», «Встроенный трек») и метраж, а лейбл — не тариф: ставка
зависит от `ceilingType`/`corniceType`/`trackType` и от флагов, которых в
снапшоте не было вовсе (`corniceLightingEnabled`, число блоков питания
подсветки, `chandeliersEnabled`). Числа в схеме были ограничены только знаком,
поэтому `area: 1e9` и `qty: 2.5` у штучного товара проходили валидацию.

### Как устроено теперь

Сервер извлекает из снапшота **параметры** и считает сумму теми же чистыми
модулями, которыми считает клиент.

1. **Снапшот комнаты расширен нормализованными параметрами** —
   `buildRoomBreakdown` (`lib/calculator/room-snapshot.ts`) кладёт в
   `roomBreakdown`, а `LeadRoomSnapshotSchema` принимает: `ceilingType`,
   `shadowEnabled`, `floatingEnabled`, `lightLinesEnabled`, `corniceType`,
   `corniceLightingEnabled`, `corniceLightingPowerSupplies`, `trackType`,
   `chandeliersEnabled`, `lightsEnabled`. Поля необязательные: снапшоты,
   собранный старым клиентом (страница, открытая до деплоя, черновик
   `potolkovo:calc-draft:v2` в localStorage), читаются как прежде.
2. **Обратное преобразование** — `roomConfigFromBreakdown`: снапшот комнаты →
   `V2RoomConfig`. Основной путь — нормализованные поля, запасной —
   восстановление по лейблам. Каждое допущение запасного пути попадает в
   `priceCheck.issues`, поэтому приближённый пересчёт виден в логе.
3. **Пересчёт** — `lib/lead/server-recalc.ts`: комнаты через
   `calcRoomSnapshotV2` и `selectTotals`, свет — по каталожным ценам и
   `lib/lighting-formulas` (проценты из `content/pricing.ts`), досчёт монтажа —
   через `selectExtraInstall` внутри `selectTotals`. Режим «только свет»
   повторяет семантику `calcLeadCeilingTotal` (N-050): потолок и минимальный
   заказ в сумму не входят.
4. **Каталог один на клиента и сервер** — `lib/lighting/catalog-products.ts`.
   Преобразование индекса (`data/catalog-index.json` → `FeedCatalogProduct[]` c
   `applyVendorOverrides` и без снятых с продажи COLIBRI) жило внутри
   `"use client"`-хука, то есть серверу было недоступно. Теперь оно в модуле без
   директивы: хук и пересчёт вызывают одну функцию и не могут разойтись. Для
   резолва артикула используется полный список, поэтому товар, снятый с продажи
   уже после сборки корзины, опознаётся и принимается с пометкой, а не
   отклоняется как неизвестный.
5. **Порядок в роуте**: honeypot → хранилище → rate-limit → zod →
   идемпотентность → дедуп → **пересчёт** → запись → доставка. Пересчёт стоит
   после идемпотентности намеренно: `payloadHash` обязан считаться от
   клиентского payload, иначе обновление прайса между двумя одинаковыми
   отправками превратило бы повтор в «новую» заявку. В БД и в `deliverAll`
   уходит `storedPayload` с серверными числами.
6. **Письмо** (`lib/lead/format-lead.ts`) собирается из сохранённого снапшота,
   поэтому и в теме, и в блоке «ИТОГО» — серверная сумма. При расхождении
   добавляется служебная строка «Сумма пересчитана сервером: клиент видел ~X ₽
   (расхождение Y %)», а в лог уходит `console.warn`.

`priceCheck` (`status`, `clientGrand`, `serverGrand`, `deltaPct`, `issues`)
сохраняется внутри `snapshot` (jsonb) — миграция БД не понадобилась. Прислать
его из браузера нельзя: в схеме payload такого поля нет, а zod отбрасывает
неизвестные ключи, и сервер всегда кладёт своё значение.

### Что отклоняется, а что принимается с пометкой

| Случай | Поведение |
|---|---|
| SKU не резолвится ни по `sku`, ни по `vendorCode` | `422`, `code: "unknown_sku"` |
| Дробное количество штучного товара (`unit !== "m"`) | `422`, `code: "fractional_qty"` (то же правило в zod-схеме) |
| Дробный метраж (`unit === "m"`) | принимается: 2,5 м профиля — нормальная позиция |
| Товар `available: false` или снят с продажи | принимается по каталожной цене + `unavailable-product` |
| Расхождение суммы больше 1 % | принимается, `status: "mismatch"`, в БД серверная сумма, `console.warn` |
| Заявка без снапшота (rescue, прямая) | принимается, `status: "unverified"`, сумма клиента |
| Комната без нормализованных полей | принимается, пересчёт по лейблам + `legacy-room-snapshot` |
| Скидка «с потолком» при отсутствии потолка | даунгрейд до «только свет» + `discount-mode-downgraded` |
| Сбой самого пересчёта (не читается каталог) | заявка принимается с суммой клиента + `console.error` |

Граница простая: отклоняется только то, что **нельзя пересчитать честно**.
Расхождение сумм отказом не считается — прайс мог обновиться, пока человек
досчитывал комплектацию, и терять из-за арифметики контакт нельзя. Внутренняя
ошибка пересчёта тоже не роняет заявку: человек свой заказ сделал.

### Приёмка

- Заниженный `grandTotal` не проходит как авторитетное значение: в БД лежит
  пересчитанное сервером число (`tests/lead-route-recalc.test.ts`,
  `tests/lead-route-db.test.ts`).
- Заниженная `priceRub` позиции заменяется каталожной, накрученный
  `discountPercentApplied` — процентом из `content/pricing.ts`
  (`tests/lead-server-recalc.test.ts`).
- Неизвестный SKU и дробное количество штучного товара отклоняются `422`,
  заявка при этом не создаётся.

### Тесты

- `tests/lead-server-recalc.test.ts` (20) — ядро: паритет с клиентом (заявка
  собирается теми же функциями, что и в браузере: `calcRoomsTotal` →
  `buildLeadSnapshotV2` → `calcLeadCeilingTotal`), подделанные `grand`/`priceRub`/
  `discountPercentApplied`, неизвестный SKU, резолв по артикулу, дробные штуки и
  дробный метраж, недоступный товар, режим «только свет», минимальный заказ,
  снапшоты старого клиента.
- `tests/fixtures/lead-payload-browser-case.json` — заявка, перехваченная
  Playwright'ом в production-сборке (кейс 18 м² / 19 м теневого / 10 м трека).
  Тест прогоняет её через схему и пересчёт: `verified`, 57 450 ₽, ноль
  допущений. Это проверка того, что живой клиент и сервер не расходятся.
- `tests/lead-route-recalc.test.ts` (7) — роут: серверная сумма в хранилище,
  письмо с пометкой, `422` на неизвестный SKU и дробные штуки, честная заявка
  без пометок, rescue, аварийный откат флагом.
- `tests/lead-route-db.test.ts` — в PostgreSQL пишется 30 000 ₽ вместо 62 000 ₽
  из payload, расширенный снапшот помещается в jsonb.
- `e2e/entry-context.spec.ts` — живой payload проходит новую схему и несёт
  нормализованные параметры комнаты.

Прогоны на момент задачи: `vitest` — 704 passed (64 файла, включая 32 теста с
PostgreSQL); `playwright` — 146 passed, 12 skipped; `next build` — успешно;
`lint` — 0 errors, 19 warnings (все предсуществующие); стражи
`check-file-size` и `check-effect-setstate` — зелёные.

### Что намеренно не сделано

- **Режим скидки не перевыбирается сервером.** `discountMode` — выбор человека
  («Только оборудование −10 %» против «Потолок + свет −25 %»), а не арифметика.
  Проверяется только согласованность: скидка «с потолком» без потолка
  даунгрейдится. Перевыбор режима сервером молча менял бы цену там, где клиент
  её показал.
- **Число блоков питания подсветки по лейблам не восстанавливается** — в старом
  снапшоте его нет. Принимается 1 (дефолт прайса) и помечается в
  `priceCheck.issues`: занижение на 1 500 ₽ видно в логе, а не потеряно.
- **Живой фид поставщика в лид-пайплайне не используется.** Только статичный
  `data/catalog-index.json`: заявка не должна ждать ответа чужого сайта и
  зависеть от его доступности.
- **Тексты `content/*.ts` не менялись** (правило 0.4 ТЗ v2): задача про деньги,
  а не про копирайт.

### Аварийный откат: `LEAD_SERVER_RECALC_ENABLED`

Правило 8 раздела 2 ТЗ: изменение денежного пути идёт под флагом.
`LEAD_SERVER_RECALC_ENABLED=0` возвращает поведение до задачи — в БД и в письмо
мастеру уходит сумма из запроса, неизвестные SKU и дробные количества
принимаются. Дефолт `1`: выключенный флаг означает «сервер снова доверяет цене
из запроса», то есть сознательно оставленную дыру в деньгах. Что откат
возвращает именно дефект, закреплено тестом
(`tests/lead-route-recalc.test.ts` → «флаг аварийного отката»).

Полный откат — `git revert <этот коммит>`. Нормализованные поля снапшота
необязательные, поэтому заявки, сохранённые с ними, читаются и прежним кодом;
колонки БД не менялись. `data/page-dates.json` в коммит не включён: файл
генерируется `scripts/build-page-dates.mjs` по истории git.

## Безопасность зависимостей: Next.js 16.1.6 → 16.3.5 (PT-005)

ТЗ v5, раздел 4 (Фаза 3); источники `A-04`, `T-304`.

### Что было

Проект был зафиксирован на `next@16.1.6` / `react@19.2.3` / `react-dom@19.2.3`.
`npm audit --omit=dev` показывал **4 уязвимости (1 moderate, 2 high, 1
critical)** в production-графе: сам `next` (диапазон `9.3.4-canary.0 - 16.3.2`,
30 advisory) и две его транзитивные зависимости — `postcss@8.4.31` и
`sharp@0.34.5`, обе в `node_modules/next/node_modules/`.

### Что обновлено

| Пакет | Было | Стало | Почему |
|---|---|---|---|
| `next` | 16.1.6 | **16.3.5** | единственный способ закрыть advisory самого next; `16.3.5` — `dist-tags.latest`, не мажор |
| `eslint-config-next` | 16.1.6 | **16.3.5** | держим в одной версии с `next`, иначе правила линта отстают от рантайма |
| `postcss` (транзитивно от next) | 8.4.31 | 8.5.23 | next@16.3.5 зависит от `postcss@8.5.23` — закрывает 4 high advisory |
| `sharp` (optional-транзитивно от next) | 0.34.5 | 0.35.4 | next@16.3.5 зависит от `sharp@^0.35.4` — закрывает libvips/libheif CVE |
| `baseline-browser-mapping` | 2.9.18 | 2.11.23 | next@16.3.5 зависит от `^2.9.19` → npm ставит 2.11.x, закрывает moderate DoS |
| 30 пакетов dev-графа (+1 добавлен) | — | — | `npm audit fix` **без** `--force`: babel, browserslist/caniuse-lite, minimatch, brace-expansion, js-yaml, flatted, ajv, @humanfs. Все в пределах своих semver-диапазонов, 0 удалённых пакетов |

`react` и `react-dom` **не обновлялись** (19.2.3): advisories по ним нет, а
`next@16.3.5` допускает `^19.0.0` в peerDependencies. Решение владельца — не
вносить в security-PR минорный апгрейд рантайма, который ничего не закрывает.

`package-lock.json` при этом стал короче на ~720 строк — это не потеря
платформенных бинарников, а дедупликация: next@16.1.6 тянул собственную вложенную
копию `sharp@0.34.5` вместе с 26 пакетами `node_modules/next/node_modules/@img/*`,
а next@16.3.5 зависит от `sharp@^0.35.4`, то есть от той же версии, что уже стоит
в devDependencies проекта, — npm слил их в одну. Проверено по итоговому lock:
все 8 `@next/swc-*` (включая `linux-x64-gnu@16.3.5`) и все платформенные
`@img/sharp-*` / `@img/sharp-libvips-*` (включая `linux-x64` и `linuxmusl-x64`,
нужные Amvera) на месте, 264 optional-записи сохранены.

Исходники менять не пришлось: `@next/codemod upgrade` не потребовался (ни одного
deprecation-предупреждения в логе сборки, линт и типы зелёные). В коммите только
`package.json`, `package-lock.json` и этот раздел README.

### Какие advisory применимы к конфигурации проекта

Проверено по фактическому конфигу, а не «на глаз»: `next.config.ts` содержит
только `images: { unoptimized: true }` (нет `rewrites`, `redirects`,
`cacheComponents`, `headers()`/CSP, i18n); `middleware.ts`/`proxy.ts` в репо
нет; каталога `pages/` нет (только App Router); директив `"use server"` нет
(Server Actions не используются); `next/script` с `beforeInteractive` не
используется; `amvera.yaml` → `run.command: npm run start` = `next start`,
то есть self-hosted Node-процесс в Linux-контейнере.

**Критичные**

| Advisory | CVSS | Исправлено в | Суть | Применимость к конфигурации |
|---|---|---|---|---|
| `GHSA-p293-qw3h-jr36` | 9.0 | 16.3.3 | RCE на серверах под Windows | **Не применим**: Amvera — Linux-контейнер. Закрыт апгрейдом |
| `GHSA-2xp9-vwfh-vxw4` | не опубликован | 16.3.3 | RCE в Image Optimization API через AVIF | **Риск снижен**: `images.unoptimized: true`, оптимизатор не вызывается. Закрыт апгрейдом — флаг может измениться |

**Высокие**

| Advisory | CVSS | Исправлено в | Суть | Применимость к конфигурации |
|---|---|---|---|---|
| `GHSA-c4j6-fc7j-m34r` | 8.6 | 16.2.5 | SSRF через WebSocket upgrade | **Применим**: self-hosted `next start`. Закрыт апгрейдом |
| `GHSA-q4gf-8mx6-v5v3` | 7.5 | 16.2.3 | DoS через Server Components | **Применим**: весь сайт на App Router/RSC. Закрыт |
| `GHSA-8h8q-6873-q5fj` | 7.5 | 16.2.5 | DoS через Server Components | **Применим**: то же. Закрыт |
| `GHSA-492v-c6pp-mqqv` | 8.1 | 16.2.5 | Обход middleware/proxy через инъекцию параметров динамического маршрута | **Не применим**: `middleware.ts`/`proxy.ts` в репо нет. Закрыт |
| `GHSA-267c-6grr-h53f` | 7.5 | 16.2.5 | Обход middleware/proxy через segment-prefetch routes | **Не применим**: middleware/proxy нет. Закрыт |
| `GHSA-26hh-7cqf-hhc6` | 7.5 | 16.2.6 | То же, incomplete-fix follow-up | **Не применим**: middleware/proxy нет. Закрыт |
| `GHSA-36qx-fr4f-26g5` | 7.5 | 16.2.5 | Обход middleware/proxy в Pages Router с i18n | **Не применим**: `pages/` и i18n нет. Закрыт |
| `GHSA-6gpp-xcg3-4w24` | не опубликован | 16.2.11 | Обход middleware/proxy при Turbopack и одной локали | **Не применим**: middleware нет, прод-сборка без Turbopack. Закрыт |
| `GHSA-3g8h-86w9-wvmq` | 3.7 | 16.2.5 | Отравление кэша редиректов middleware/proxy | **Не применим**: middleware нет. Закрыт |
| `GHSA-mg66-mrh9-m8jx` | 7.5 | 16.2.5 | DoS через исчерпание соединений в Cache Components | **Не применим**: `cacheComponents` не включён. Закрыт |
| `GHSA-m99w-x7hq-7vfj` | не опубликован | 16.2.11 | DoS в App Router через Server Actions | **Частично**: App Router есть, Server Actions (`"use server"`) — нет. Закрыт |
| `GHSA-89xv-2m56-2m9x` | не опубликован | 16.2.11 | SSRF в Server Actions на custom servers | **Не применим**: ни Server Actions, ни custom server (стандартный `next start`). Закрыт |
| `GHSA-p9j2-gv94-2wf4` | не опубликован | 16.2.11 | SSRF в `rewrites` через подконтрольный hostname | **Не применим**: `rewrites` в конфиге нет. Закрыт |
| `postcss` ≤8.5.22 — 4 advisory: `GHSA-qx2v-qp2m-jg93`, `GHSA-6g55-p6wh-862q`, `GHSA-r28c-9q8g-f849`, `GHSA-fxqj-rqcc-2cmp` | до 7.5 | 8.5.10–8.5.23 | XSS в CSS stringify, чтение произвольных `.map` через `sourceMappingURL` | **Частично**: PostCSS работает на сборке над CSS самого проекта, а не над пользовательским вводом; в рантайме не вызывается. Закрыт (установлен 8.5.23) |
| `sharp` ≤0.35.4-rc.0 — 2 advisory: `GHSA-f88m-g3jw-g9cj`, `GHSA-rgj7-g3m4-5g8c` | не опубликован | 0.35.0 / 0.35.4 | CVE libvips/libheif, включая `GHSA-g89c-p67h-r497` | **Риск снижен**: при `unoptimized: true` sharp для оптимизации не вызывается. Закрыт (установлен 0.35.4) |
| `baseline-browser-mapping` <2.11.0 — `GHSA-w5vr-8v7q-w6rv` | medium | 2.11.0 | Завершение процесса на некорректном входе → DoS | **Частично**: пакет резолвится в production-графе через next, но читает только справочник браузеров. Закрыт (установлен 2.11.23) |

**Умеренные и низкие** (закрыты апгрейдом; применимость та же): cache
poisoning/confusion RSC-ответов и ответов с телом (`GHSA-vfv6-92ff-j949`,
`GHSA-wfc6-r584-vfw7`, `GHSA-3g8h-86w9-wvmq`, `GHSA-68g3-v927-f742`,
`GHSA-4633-3j49-mh5q`), XSS при CSP nonces (`GHSA-ffhc-5mcf-pf4q` — CSP не
настроен) и в `beforeInteractive` (`GHSA-gx5p-jg67-6x7h` — не используется),
DoS и бесконтрольный рост кэша Image Optimization API
(`GHSA-h64f-5h5j-jqjh`, `GHSA-q8wf-6r8g-63ch`, `GHSA-3x4c-7xq6-9pq8` — снижено
`unoptimized`), unbounded postponed resume buffering (`GHSA-h27x-g6w4-24gq`),
request smuggling в `rewrites` (`GHSA-ggv3-7p47-pfv8` — `rewrites` нет),
`Origin: null` против CSRF Server Actions (`GHSA-mq59-m269-xvcx` — Server
Actions нет) и dev-HMR websocket (`GHSA-jcc7-9wpm-mj36` — только dev),
раскрытие внутренних Server Function endpoint'ов (`GHSA-955p-x3mx-jcvp`),
unbounded Server Action payload в Edge runtime (`GHSA-4c39-4ccg-62r3` — Edge
runtime не используется).

### Что осталось и почему

`npm audit --omit=dev` → **0 vulnerabilities**: в production-графе открытых
advisory нет, приёмка ТЗ выполнена.

Полный `npm audit` (вместе с dev-зависимостями) — **4 moderate**, все в одной
цепочке `drizzle-kit → @esbuild-kit/esm-loader → @esbuild-kit/core-utils →
esbuild`:

- в прод-сборку не попадают (это инструмент миграций, `npm run build` его не
  использует, в `next start` его нет);
- единственное «исправление», которое предлагает npm, — мажорный **даунгрейд**
  `drizzle-kit` до 0.18.1 (`isSemVerMajor: true`), то есть откат инструмента
  миграций на год назад. Это хуже, чем умеренная advisory в dev-инструменте;
- `npm audit fix --force` не применялся — он запрещён правилом ТЗ вслепую, а
  здесь он сделал бы ровно этот даунгрейд.

Владелец исключения — владелец репо; срок — обновление `drizzle-kit`, при
котором он сам перейдёт на неподверженный `esbuild`. До тех пор отклонение
сознательное и задокументированное.

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm ci                       → added 436 packages, audited 437 packages; 4 moderate (только dev-граф)
$ npm run lint                 → ✖ 19 problems (0 errors, 19 warnings)   ← все 19 предсуществующие
$ npx tsc --noEmit             → 0 ошибок
$ npm run validate:catalog     → validate-catalog: ok (48 SKU, 7 профилей)
$ npx drizzle-kit push --force → [✓] Changes applied / [i] No changes detected
$ TEST_DATABASE_URL=… CRON_SECRET=… npm run test
                               → Test Files 65 passed (65); Tests 704 passed (704)
$ npm run test:flow            → # pass 5 / # fail 0
$ npm run build                → exit 0, ✓ Compiled successfully
$ npm run check:bundle         → [bundle] ok — / 222.4 КБ ≤ 300 КБ
$ npm run test:e2e             → 146 passed, 12 skipped (0 unexpected failures)
$ npm audit --omit=dev         → found 0 vulnerabilities
```

Последние два пункта gate (`curl -I https://<прод>/` и `/api/health`) **не
выполнялись** по решению владельца: прод собирается из `main` (`d8a6faf`), где
этого апгрейда нет, поэтому проверка показала бы состояние старой сборки.

Бандл главной страницы: **216.4 КБ → 222.4 КБ** gzip First Load JS (+6.0 КБ,
+2.8 %). Замерено честным сравнением: сборка на `16.1.6` и на `16.3.5` одним и
тем же `npm run check:bundle`. Запас до бюджета 300 КБ — 77.6 КБ.

### Откат

`git revert <этот коммит>` возвращает `next@16.1.6`, `eslint-config-next@16.1.6`
и прежний lock с уязвимыми `postcss`/`sharp`/`baseline-browser-mapping` в
production-графе — то есть откат сознательно возвращает 4 advisory (1 из них
critical). После реверта нужен `npm ci` и повторный gate. Изменений в исходниках
и в схеме БД нет, поэтому откат не затрагивает ни заявки, ни данные.

## Закрытие диалога выбора — это не выбор (PT-011)

ТЗ v5, раздел 4 (Фаза 4, P1); источники `A-09`, `T-313`; сценарий `S08`.

### Проблема

Экран интента в каталоге света («Как оформляем комплект?») спрашивал режим
скидки через общий `showConfirmDialog`, а тот возвращал `boolean`. Одно значение
`false` означало сразу два разных факта: «человек нажал кнопку *Только
оборудование −10 %*» и «человек закрыл диалог» (Escape, клик по подложке).
Второй случай код не различал и уходил в `openLightingOrder()` — то есть закрытие
вопроса открывало форму заявки с режимом скидки, который пользователь не выбирал.

Проверено на сборке до правки (не по описанию, а замером): после Escape на
странице `/uslugi/prodazha-trekovogo-osveshcheniya` калькулятор открывается
(`modal count: 1`), а фокус оказывается на `BODY` — одинаково на 1280×900 и на
390×844.

### Решение

1. **`showChoiceDialog<TChoice>()`** в `components/ui/confirm-dialog.tsx` —
   диалог выбора с тремя исходами: `primary.id`, `secondary.id` и `"dismissed"`.
   Тип результата `TChoice | "dismissed"`, поэтому ветку закрытия нельзя
   «забыть» — её требует компилятор. Обычный `showConfirmDialog` не изменён:
   дефолтные исходы те же (`true`/`false`), закрытие по-прежнему равно «нет».
2. **Видимый крестик** (`data-testid="confirm-dialog-close"`, `aria-label="Закрыть"`)
   появляется только у диалога выбора: на мобильном Escape нет, и без явного
   элемента закрытие существует лишь как клик по подложке. В DOM крестик стоит
   последним, чтобы первый фокус при открытии доставался кнопке действия.
3. **Возврат фокуса** элементу, открывшему диалог (`activeOpener` в контроллере).
   Работает для всех диалогов, включая rescue-заявку: раньше после закрытия
   фокус падал на `body`, и клавиатурный пользователь терял место на странице.
   Если элемента уже нет в DOM — фокус не трогаем.
4. **Чистая таблица «исход → действие»** — `resolveCheckoutIntentAction()` в
   `lib/lighting/catalog-checkout.ts`: `with-ceiling → open-ceiling-flow`,
   `lighting-only → open-lighting-order`, `dismissed → stay-in-catalog`.
   `switch` без `default`: четвёртое значение в union станет ошибкой типов, а не
   молчаливым провалом в оформление.
5. **Сам вопрос вынесен** из `CatalogSectionClient.tsx` в
   `_components/ask-checkout-intent.ts` — компонент и так был на грани лимита,
   а логика пути самостоятельна (см. PT-018).
6. **Контроллер диалога** (модульное состояние, резолверы, сопоставление исходов,
   фокус) вынесен в `components/ui/confirm-dialog-store.ts`: UI-файл упал с 601
   строки до 384, семантику результата теперь можно читать отдельно от вёрстки.
   Публичный API реэкспортируется из `confirm-dialog.tsx`, существующие импорты
   (`use-rescue-lead`, `calculator-modal`, каталог) не менялись.

Порог legacy-бюджета для `CatalogSectionClient.tsx` понижен со 773 до 757 строк
(страж `scripts/check-file-size.mjs` сам предлагает это при сокращении) —
обратный рост файла теперь падает на сборке.

### Тесты

**Unit** — `tests/checkout-intent.test.ts` (5 тестов): все три исхода различимы,
`dismissed` не равен `lighting-only` (это и есть регресс), ни один исход не
остаётся без действия.

**E2E** — `e2e/track-sale.spec.ts`, блок «Экран интента каталога: закрытие ≠
выбор» (4 теста × 2 проекта = 8): Escape, клик по подложке и крестик закрывают
диалог, калькулятор не открывается, корзина остаётся `1 поз.`, фокус возвращается
на кнопку «Оформить»; явная кнопка «С потолком −25 %» ведёт в Шаг 0.

**Проверка, что тесты ловят баг:** на коде до правки все три теста закрытия
падают на обоих проектах — `expect(locator).toHaveCount(expected) failed` для
Escape и клика по подложке (модалка открыта) и таймаут для крестика (элемента
нет). Первый вариант теста при этом ложно зеленел на мобильном: мгновенный
`toHaveCount(0)` успевал пройти до асинхронного открытия модалки, поэтому в
проверку добавлена пауза 500 мс — она зафиксирована комментарием.

Соседние диалоги не сломаны: `e2e/rescue-and-draft.spec.ts` (rescue с полем
телефона, отправкой и повтором после ошибки) и `e2e/track-sale-offers.spec.ts`
проходят без изменений.

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run lint                 → ✖ 19 problems (0 errors, 19 warnings)   ← все предсуществующие
$ npx tsc --noEmit             → 0 ошибок
$ node scripts/check-file-size.mjs
                               → [file-size] ok — проверено 120 файлов, лимит 600 строк, 4 legacy-исключения
$ npm run validate:catalog     → validate-catalog: ok (48 SKU, 7 профилей)
$ npx drizzle-kit push --force → [i] No changes detected   (схема БД не менялась)
$ TEST_DATABASE_URL=… CRON_SECRET=… npx vitest run
                               → Test Files 66 passed (66); Tests 709 passed (709)
$ npm run test:flow            → # pass 5 / # fail 0
$ npm run build                → exit 0, ✓ Compiled successfully
$ npm run check:bundle         → [bundle] ok — / 222.9 КБ ≤ 300 КБ
$ npx playwright test          → 154 passed, 12 skipped (0 unexpected failures)
$ npm audit --omit=dev         → found 0 vulnerabilities   (зависимости не менялись)
```

Было до задачи: 65 файлов / 704 теста, E2E 146 passed. Стало: 66 / 709 и
154 passed — добавились только новые проверки.

Бандл главной: 222.4 → **222.9 КБ** gzip First Load JS (+0.5 КБ — контроллер
диалога и таблица исходов). Запас до бюджета 300 КБ — 77.1 КБ.

### Ограничения

- Крестик добавлен только диалогу выбора. Остальным диалогам он не нужен: у
  rescue-заявки есть явная кнопка «Просто закрыть», у подтверждения смены
  системы трека — «Оставить как есть».
- Атрибуция аналитики закрытия не добавлена: события «человек передумал на
  экране интента» в реестре Метрики (Приложение C) нет, а придумывать новое
  событие в рамках этой задачи нельзя.
- 19 варнингов линта предсуществующие.
- Пункт gate с `curl` прода не выполнялся: прод собирается из `main`, где нет ни
  этой задачи, ни трёх предыдущих.

### Откат

`git revert` этого коммита возвращает `boolean`-результат диалога, убирает
крестик и возврат фокуса, а экран интента снова переезжает в
`CatalogSectionClient.tsx`. Данные, схема БД, цены и публичные URL не
затрагиваются: правка чисто клиентская. После реверта нужен `npm ci` не
требуется — достаточно пересобрать (`npm run build`).

## Заблокированное хранилище и длинная атрибуция не валят заявку (PT-012)

ТЗ v5, раздел 4 (Фаза 4, P1); источники `A-10`(MD, `F-09`), `T-310`; сценарий `S10`.

### Проблема 1 · хранилище

`app/providers.tsx` и `components/calculator-modal/calculator-modal-context.tsx`
обращались к `sessionStorage` **напрямую** и делали это внутри `useEffect`.
Заблокированное хранилище (приватный режим Safari — `QuotaExceededError` при
нулевой квоте; запрещённые сторонние cookie, iframe, корпоративная политика —
`SecurityError` при самом обращении) давало исключение из эффекта, то есть
падение React-дерева, а не «атрибуция не сохранилась».

Замерено на сборке до правки, страница `/uslugi/skrytye-karnizy#action` с
запрещённым доступом к хранилищу:

```
PAGE_ERRORS: 1
  - SecurityError: The operation is insecure.
FORM_VISIBLE: 0        ← поля формы заявки в DOM нет
BODY_LEN: 66813        ← серверный HTML при этом отдаётся
```

То есть человек с заблокированным хранилищем видел страницу без формы заявки и
без работающего калькулятора. `lib/calculator/draft.ts` и
`collectLeadAttribution` уже были обёрнуты в `try/catch` — но каждый своим
способом, а два оставшихся места не были обёрнуты вовсе.

### Проблема 2 · атрибуция

Схема требовала `attribution: z.record(z.string(), z.string().max(200))`. В
`first_landing`/`first_referrer` лежит URL, и рекламная ссылка первого визита
легко превышает 200 символов. Замер до правки на реальном URL из Директа
(666 символов):

```
success: false
issues: [{"code":"too_big","maximum":200,"path":["attribution","first_landing"],
          "message":"Too big: expected string to have <=200 characters"}]
```

`422` на весь запрос: заявка терялась из-за непринципиального поля, и терялась
именно у тех, кто пришёл из рекламы. Отдельно — в URL первого визита попадают не
только UTM: партнёрские ссылки дописывают `email`, `phone`, `order_id`, токены,
и всё это уезжало в БД и в текст Telegram-уведомления.

### Проблема 3 · две копии захвата

Список ключей жил в трёх местах (`providers.tsx`, `calculator-modal-context.tsx`,
`submit-lead.ts`), а копии уже разошлись: провайдер писал в `first_landing` путь
с query, модалка — полный `window.location.href`.

### Решение

1. **`lib/safe-storage.ts`** — единая обёртка: `getWebStorage`, `readWebStorage`,
   `writeWebStorage`, `writeWebStorageIfAbsent`, `removeWebStorage`. Ловит оба
   сценария отказа (исключение при обращении и при записи) и SSR. `false` из
   записи — честный сигнал «не записалось», а не исключение наружу.
2. **`lib/attribution.ts`** — чистый изоморфный модуль: allowlist ключей
   (9 рекламных параметров + `first_landing`/`first_referrer`), лимит 200 на
   обычное значение и **2048 на URL целиком**, снятие фрагмента, выбрасывание
   параметров вне allowlist, нормализация словаря из `unknown`. Один список на
   клиент и сервер.
3. **`lib/attribution-capture.ts`** — один захват first-click вместо двух копий.
   Вызова осталось два (провайдер на загрузке страницы и модалка как
   подстраховка), функция идемпотентна через `writeWebStorageIfAbsent`.
4. **`lib/lead/schema.ts`** — `attribution: z.unknown().default({}).transform(normalizeAttribution)`.
   Битый клиент (строка или массив вместо объекта) даёт пустой словарь, а не
   `422`.
5. **`lib/calculator/draft.ts`** и `collectLeadAttribution` переведены на обёртку
   и на общий allowlist; поведение прежнее (черновик и атрибуция не критичны),
   но способ отказа теперь один на проект.

Обязательные поля не послаблены: телефон по-прежнему нормализуется и
проверяется строго, отдельный тест подтверждает, что `422` за невалидный номер
остаётся даже при корректной атрибуции.

Побочный эффект для идемпотентности (PT-009): `payloadHash` считается от
zod-разобранного payload, поэтому нормализация делает хеш устойчивее — две
отправки, отличающиеся только фрагментом или персональным параметром ссылки,
теперь дают один отпечаток.

### Тесты

**Unit** — `tests/attribution-normalize.test.ts` (17 тестов: allowlist, чистка
URL, лимиты, битый вход, интеграция со схемой) и `tests/safe-storage.test.ts`
(9 тестов: SSR, `SecurityError` при обращении, `QuotaExceededError` при записи,
first-click, захват атрибуции при заблокированном хранилище).

**Интеграция с БД** — новый тест в `tests/lead-route-db.test.ts`: ссылка на
3000+ символов с `email` и фрагментом → `201`, в `payload.attribution` лежит
значение ≤2048 без `email` и `#`, ключ вне allowlist не сохранён.

**E2E** — новый `e2e/blocked-storage.spec.ts` (3 теста × 2 проекта): запрещённый
доступ к хранилищу (форма отправляет заявку без атрибуции, калькулятор
открывается и реагирует на выбор) и приватный режим с запрещённой записью.
Отдельно проверяется, что `pageerror` не возникает вовсе.

**Проверка, что тесты ловят баг:** на файлах до правки все 6 E2E-тестов падают
(таймауты — форма и калькулятор не появляются), а probe-тест схемы показывал
`too_big` для длинной ссылки.

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run lint                  → ✖ 19 problems (0 errors, 19 warnings)   ← все предсуществующие
$ npx tsc --noEmit              → 0 ошибок
$ node scripts/check-file-size.mjs
                                → [file-size] ok — проверено 120 файлов, лимит 600 строк, 4 legacy-исключения
$ npm run validate:catalog      → validate-catalog: ok (48 SKU, 7 профилей)
$ DATABASE_URL=… npx drizzle-kit push --force
                                → [i] No changes detected   (схема БД не менялась)
$ TEST_DATABASE_URL=… CRON_SECRET=… npx vitest run
                                → Test Files 68 passed (68); Tests 736 passed (736)
$ npm run test:flow             → # pass 5 / # fail 0
$ npm run build                 → exit 0, ✓ Compiled successfully
$ npm run check:bundle          → [bundle] ok — / 223.2 КБ ≤ 300 КБ
$ npx playwright test           → 160 passed, 12 skipped (5.5m), 0 unexpected failures
$ npm audit --omit=dev          → found 0 vulnerabilities
```

Было: 66 файлов / 709 тестов, E2E 154 passed, бандл 222.9 КБ. Стало: 68 / 736,
E2E **160 passed**, бандл **223.2 КБ** (+0.3 КБ — три новых модуля). Существующие
тесты не менялись и не удалялись, `skip` не добавлялся.

### Ограничения

- Реальные браузеры не проверялись: Safari в приватном режиме и Firefox с ETP
  воспроизведены имитацией (`addInitScript` / `vi.stubGlobal`), а не на
  устройстве. **Проверка на настоящем iOS Safari не выполнена — доступа к
  устройству нет.** Инструкция владельцу: открыть сайт в приватном окне Safari
  на iPhone, дойти до формы на `/uslugi/skrytye-karnizy#action` и отправить
  заявку — форма должна работать, а в лиде будет пустая атрибуция.
- `collectLeadAttribution(extra)` сохранён ради совместимости с PT-004, но
  сервер принимает только ключи из allowlist: новое поле атрибуции нужно
  добавлять в `ATTRIBUTION_PARAM_KEYS` (`lib/attribution.ts`). Продакшен-код
  `extra` сейчас не использует.
- `first_landing` теперь всегда путь с query и без origin — в модалке раньше
  писался полный `href`. Для своих страниц origin информации не добавляет.
- Параметры вне allowlist выбрасываются из URL целиком, включая потенциально
  полезные (`promo`, `ref`). Это осознанная цена чистки персональных параметров;
  расширять список нужно в одном месте.
- События Метрики не менялись; `curl` прода не выполнялся (прод собирается из
  `main`, где нет ни этой задачи, ни предыдущих).

### Откат

`git revert` этого коммита возвращает прямой доступ к `sessionStorage` и
`max(200)` на каждое значение атрибуции, то есть возвращает оба бага: падение
страницы при заблокированном хранилище и `422` на длинной рекламной ссылке.
Миграций БД нет, схема не менялась; уже сохранённые лиды не затрагиваются —
нормализация применяется только в момент приёма заявки.
