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

Единый обязательный pipeline (PT-019, ТЗ строка 192) — одной командой:

```bash
npm run ci:all
```

Это буквально цепочка из ТЗ плюс гейт на «плавающие» E2E:

```bash
npm run lint            # eslint, 0 errors
npx tsc --noEmit        # 0 errors
npm run test            # vitest: 1054 passed / 53 skipped без БД, 1119 passed с TEST_DATABASE_URL
npm run test:flow       # харнесс контракта lib/calculator-flow.ts, 8 тестов
npm run validate:catalog
npm run build           # 19 маршрутов; тянет prebuild — все стражи
npm run check:bundle    # бюджет клиентского бандла (главная ≤ 300 КБ)
npm run test:e2e        # Playwright по production-сборке, 180 passed / 12 skipped
npm run check:e2e-flaky # «плавающие» E2E: RELEASE=1 — блокирующий, иначе предупреждение
```

`prebuild` (то есть `npm run build`) прогоняет стражи: `check-legal-fields`,
`validate-catalog`, `build-catalog-index`, `check-images`, `check-catalog-images`,
`check-file-size` (лимит 600 строк на файл), `check-effect-setstate` (никакого
`setState` в эффектах вне разрешённого списка), `check-availability`,
`build-og-image`, `build-page-dates`.

В CI (`.github/workflows/ci.yml`) те же гейты разложены по job: `static` (lint,
tsc, схема БД, unit, **test:flow**, окружение и реквизиты, каталог, календарь
замеров) → `build` (сборка + бюджет бандла, артефакт-тарбол) → `e2e`
(Playwright + **гейт на плавающие тесты**) → `secrets` (gitleaks).
Локально до пуша часть из них повторяет `lefthook` (pre-commit: gitleaks,
eslint, tsc; pre-push: unit + **test:flow**).

Пропуски и повторные попытки в тестах — не «молчаливое зелёное»: они перечислены
в разделе «Реестр пропусков и повторов в тестах (PT-019)» ниже, у каждого указаны
причина и владелец.

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
   (`validate-catalog`, `check-file-size`, `check-effect-setstate`) — он
   намеренно блокирует выкладку сломанного состояния. `check-availability`
   после PT-016 только предупреждает: основной календарь замеров теперь в БД,
   а файл — запасной источник.
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
| `LEAD_CONSENT_VERSION_REQUIRED` | `1` — отклонять `422` заявки, где версия политики не совпадает с текущей (по умолчанию `0`: расхождение только логируется) |
| `DELIVERY_ALERT_ENABLED` | `0` — выключить проверку сбоев доставки целиком (PT-015) |
| `DELIVERY_ALERT_THRESHOLD` | сколько неудачных попыток подряд считать сбоем (по умолчанию `4` = две заявки × два канала) |
| `DELIVERY_ALERT_WINDOW_MIN` | окно наблюдения в минутах (по умолчанию `30`) |
| `DELIVERY_ALERT_COOLDOWN_MIN` | охлаждение между алертами в минутах (по умолчанию `60`) |
| `DELIVERY_ALERT_LOOKBACK` | сколько последних попыток доставки читать из БД на одну проверку (по умолчанию `50`) |
| `DELIVERY_ALERT_WEBHOOK_URL` | HTTP-приёмник JSON для служебного алерта (Slack/Discord/ntfy/Apprise/своя ручка) |
| `DELIVERY_ALERT_TELEGRAM_BOT_TOKEN`, `DELIVERY_ALERT_TELEGRAM_CHAT_ID` | второй Telegram-бот или отдельный чат для алерта |
| `TELEGRAM_LEADS_ENABLED` | `0` — не отправлять в Telegram (Web3Forms продолжит работать) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | доставка в Telegram |
| `WEB3FORMS_ACCESS_KEY` | серверный ключ дубля на почту |
| `CRON_SECRET` | доступ к `POST /api/lead/retry` (заголовок `Authorization: Bearer …`) |
| `LEAD_OUTBOX_CLAIM_ENABLED` | `0` — аварийный откат PT-020: крон снова читает задания двумя `SELECT` без резервирования строк (возвращает риск дубля отправки) |
| `AVAILABILITY_TOKEN` | пароль `/admin/availability` и `GET\|PUT /api/admin/availability` (PT-016) |
| `AVAILABILITY_DB_ENABLED` | `0` — аварийный откат PT-016: календарь снова только из `content/availability.ts` |
| `DATABASE_URL` | строка подключения к PostgreSQL; схема — `db/schema.ts` |

Повторная доставка: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/lead/retry`

Ответ крона: `{ ok, retried, sent, failed, recovered, alert }`, где `alert` —
`{ fired: true, via }` или `{ fired: false, reason }` (PT-015, см. ниже).
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

## Состояния ошибки формы и честный статус сохранения (PT-013)

ТЗ v5, раздел 4 (Фаза 4, P1); задача `PT-013`.

### Проблема (замерено на сборке до правки)

Форма заявки на `/uslugi/skrytye-karnizy#action`, три принципиально разных
отказа — и один и тот же текст на все:

| Что ответил сервер | Что видел человек | Запросов ушло |
|---|---|---|
| `422 { issues: ["phone","name"] }` | «Не получилось отправить — позвоните +7 905 521 99 09 или напишите в Telegram.» | 1 |
| `429` + `Retry-After: 600` | тот же текст, «10 мин» в нём нет | 1 |
| обрыв связи | тот же текст, кнопки повтора нет | **1** |

Дополнительно: `aria-invalid` на полях не появлялся (`422_PHONE_ARIA_INVALID:
null`), список полевых ошибок был пуст (`422_FIELD_ERRORS: []`), а `issues` из
ответа сервера клиент не читал вовсе. Введённые данные при этом сохранялись —
это единственное, что уже работало.

Последствие: при `422` человек шёл звонить вместо того, чтобы исправить номер;
при `429` жал «Отправить» снова и снова, увеличивая срок блокировки; при обрыве
связи не знал, что заявка, возможно, уже сохранена (таймаут — единственный
отказ с неизвестным исходом).

Отдельно: серверный текст отказа (`422` серверного пересчёта PT-010 — «позиция
недоступна к заказу», `409` PT-009 — «заявка уже отправлена») выбрасывался, и
человек видел совет проверить номер телефона при неизвестном SKU.

### Про ссылки на источники в ТЗ

`PT-013` ссылается на `A-13`(MD, `F-21/22`) и `T-317`, `T-318`. В репозитории
`F-21` — ручной календарь дат замера, `F-22` — hero без потолка (оба в
`02-glubokiy-audit.md`), а записей `T-317`/`T-318` в `01-audit-sootvetstvie-tz.md`
нет. Содержание задачи взято из её формулировки в ТЗ и из фактического кода;
соответствие ссылкам проверить не удалось — расхождение в самой нумерации
документов-предшественников.

### Решение

1. **`lib/lead/failure-view.ts`** (новый, чистый) — разбор отказа: zod-путь →
   поле формы, текст на каждое поле, общий текст плашки, `canRetry`,
   `outcomeUnknown`, момент окончания ожидания из `Retry-After`. Пути вне формы
   (`snapshot.*`, `attribution.*`, `totals.*`) не превращаются в «подсветку»
   несуществующего поля. Серверный `message` показывается только там, где он
   написан для человека (`422` без полей формы, `409`).
2. **`lib/lead/submit-retry.ts`** (новый) — один автоматический повтор при
   `timeout`/`network`, **с тем же `requestId`**: если первая попытка всё-таки
   дошла, сервер отвечает кодом уже сохранённой заявки (`idempotentReplay`), а
   не создаёт дубль. `422`, `429`, `503` не повторяются автоматически.
3. **`components/home/lead-form-alert.tsx`** (новый) — плашка отказа: текст,
   список проблемных полей, живой обратный отсчёт `Retry-After`, кнопка
   «Повторить отправку» (только когда повтор имеет смысл) и честная подпись про
   неизвестный исход. Технические детали не показываются.
4. **`lib/lead/focus-lead-field.ts`** (новый) — фокус на первом проблемном поле
   (форма длинная, одной подсветки мало) и ARIA-атрибуты `aria-invalid` /
   `aria-describedby` для полей.
5. **`lib/lead/submit-lead.ts`** — в отказе появился `serverMessage` (строка
   сервера, обрезанная до 200 символов).
6. **`lib/lead/rescue-lead.ts`** — тот же автоповтор; текст отказа берёт
   серверное сообщение, когда оно про состав заявки, а не про номер.
7. **Честный статус сохранения** — «Заявка №K7F3Q **сохранена**» вместо
   «принята» в трёх местах (`lead-success-note.tsx`, `action-form.tsx`,
   `wizard-step2-summary.tsx`): доставка асинхронная (PT-003), на момент ответа
   заявка в базе, но мастер её ещё не видел. Rescue-путь уже говорил «сохранена»
   — формулировки сошлись.

Сервер не менялся вовсе: `422` с `issues` и `Retry-After` у `429`/`503` он
отдавал и раньше — клиент их выбрасывал.

`components/home/action-form.tsx` зафиксирован в LEGACY_BUDGET стража размера,
поэтому часть кода вынесена без изменения поведения: маска телефона — в
`lib/lead/phone-input.ts`, блок «Получение / Когда удобно» — в
`components/home/lead-fulfilment-fields.tsx`, плашка ошибки — в
`lead-form-alert.tsx`. Порог файла понижен с 602 до **561** строки.

Метрика не изменилась: `lead_error` и `form_submit_error` считаются один раз на
попытку человека, а не на каждый сетевой запрос (автоповтор внутри не добавляет
событий).

### Тесты

**Unit** — `tests/lead-failure-view.test.ts` (**19** тестов: zod-пути, порядок
полей как в форме, `422`/`429`/`503`/`409`/`network`/`timeout`, запрет на
раскрытие каналов доставки и технических деталей, формат отсчёта) и
`tests/lead-submit-retry.test.ts` (**13** тестов: повтор при обрыве и таймауте,
тот же `requestId` во всех попытках, одинаковое содержимое, ограничение числа
попыток, отказ от повтора при `422`/`429`/`503`/`409`). Плюс 2 теста в
`tests/lead-submit.test.ts` на `serverMessage`.

**E2E** — новый `e2e/lead-error-states.spec.ts` (**6 тестов × 2 проекта**):
подсветка поля и фокус на `422`, живой отсчёт на `429`, автоповтор с тем же
`requestId` до успеха, честный текст и кнопка повтора при двойном обрыве, ручной
повтор после `500`, формулировка «Заявка №… сохранена» без технических деталей.

**Обновлённые существующие тесты (не ослаблены):**
- 6 регулярок `/Заявка .* принята|Заявка отправлена/` → `/Заявка №\S+ сохранена|Заявка отправлена/`
  (`lead-forms`, `funnel-standard` ×2, `rescue-and-draft`, `service-preset`,
  `blocked-storage`). Новая регулярка строже: требует номер заявки.
- `tests/lead-submit.test.ts`: в `toEqual` полного shape отказа добавлено
  `serverMessage: null` — тип расширен.
- `e2e/rescue-and-draft.spec.ts`: «обрыв связи — отказ, а не молчаливый успех»
  теперь ждёт 2 запроса вместо 1 и проверяет, что `requestId` у них один;
  «PT-009: повтор после сбоя» — 3 запроса (2 на первый клик + ручной повтор) и
  один ключ на все три.

**Проверка, что тесты ловят баг:** на файлах до правки все 6 новых E2E-тестов
падают (плашки с `data-testid` нет, отсчёта нет, второго запроса нет, текст
«принята»).

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run lint                  → ✖ 19 problems (0 errors, 19 warnings)   ← все предсуществующие
$ npx tsc --noEmit              → 0 ошибок
$ node scripts/check-file-size.mjs
                                → [file-size] ok — проверено 122 файлов, лимит 600 строк, 4 legacy-исключения
$ node scripts/check-effect-setstate.mjs
                                → [effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору
$ npm run validate:catalog      → validate-catalog: ok (48 SKU, 7 профилей)
$ DATABASE_URL=… npx drizzle-kit push --force
                                → [i] No changes detected   (схема БД не менялась)
$ TEST_DATABASE_URL=… CRON_SECRET=… npx vitest run
                                → Test Files 70 passed (70); Tests 770 passed (770)
$ npm run test:flow             → # pass 5 / # fail 0
$ npm run build                 → exit 0, ✓ Compiled successfully
$ npm run check:bundle          → [bundle] ok — / 224.8 КБ ≤ 300 КБ
$ npx playwright test           → 172 passed, 12 skipped (6.3m), 0 unexpected failures
$ npm audit --omit=dev          → found 0 vulnerabilities
```

Было: 68 файлов / 736 тестов, E2E 160 passed, бандл 223.2 КБ, `action-form.tsx`
602 строки. Стало: **70 / 770**, E2E **172 passed**, бандл **224.8 КБ** (+1.6 КБ
— шесть новых модулей), `action-form.tsx` **561**.

### Ограничения

- Автоповтор ровно один и только для `timeout`/`network`. `5xx` повторяется
  вручную кнопкой «Повторить отправку»: сервер ответил, значит связь есть, и
  долбить его автоматически незачем.
- Обратный отсчёт `Retry-After` живёт, пока видна плашка: при уходе со страницы
  срок не запоминается. Лимит в любом случае проверяет сервер.
- Поле «Когда удобно» (радиогруппа) подсвечивается текстом в плашке и получает
  фокус на первой опции, но не рамкой — у радиогруппы нет единого `aria-invalid`.
- В rescue-диалоге подсветка полей не добавлялась: поле одно (телефон) и
  проверяется на клиенте до отправки, а `422` туда доходит только от серверного
  пересчёта состава.
- `describeLeadFailure` читает `Date.now()` (время можно передать вторым
  аргументом — тесты так и делают).
- Проверено только в Chromium (desktop 1280×900 и mobile 390×844). **Safari и
  Firefox не проверялись — проверка не выполнена.**
- `curl` прода не выполнялся (прод собирается из `main`).

### Откат

`git revert` этого коммита возвращает один общий текст на все отказы, отсутствие
автоповтора и формулировку «принята». Серверное поведение не менялось, миграций
БД нет, флаг отката не требуется: денежный путь (цена, состав заявки,
`grandTotal`) не затронут.

## Версионирование согласия в БД (PT-014)

ТЗ v5, раздел 4 (Фаза 4, P1); задача `PT-014` (источники `A-19`, `A-20`,
`T-319`, `T-320`).

### Проблема

Согласие на обработку персональных данных существовало в проекте как
`consent: z.literal(true)` и как `consent: true` **константой** в payload обеих
форм. Последствия:

1. В таблице `leads` не было ни версии текста политики, ни момента согласия —
   по базе нельзя ответить, с какой редакцией человек согласился и когда.
2. Сервер не мог отличить явное согласие от так написанного кода: клиент
   присылал `true` в любом случае.
3. Страница `/privacy` рисовала «Дата обновления: {new Date().toLocaleDateString("ru-RU")}» —
   то есть **дату сборки**. Любой деплой «обновлял» политику без единой правки
   текста, а привязывать согласие было не к чему: версия, которой не
   существовало, менялась сама по себе.

### Решение

1. **`PRIVACY_POLICY_VERSION`** в `content/legal.ts` — одна константа на проект:
   `2026-09-10` (дата последней правки текста политики по
   `git log -1 --format=%ad --date=short -- app/privacy/page.tsx`). Формат
   `ГГГГ-ММ-ДД[.N]`. Меняется только вместе с правкой текста.
2. **`lib/privacy-policy.ts`** (новый, чистый) — разбор версии: формат,
   календарная корректность (`2026-13-45` версией не считается), человекочитаемая
   дата. `app/privacy/page.tsx` больше не берёт дату из часов.
3. **`lib/lead/use-consent-capture.ts`** (новый) — один хук на обе формы: факт
   согласия, ISO-момент клика по чекбоксу и редакция политики. Снял галочку —
   момент сбрасывается: у отозванного согласия не остаётся времени.
4. **`lib/lead/consent.ts`** (новый, чистый) — что именно писать в БД:
   - версия из тела запроса принимается только распознаваемая, иначе `NULL`
     («неизвестно»). Подставлять вместо `NULL` текущую редакцию нельзя — это
     приписало бы человеку согласие с текстом, которого он не видел;
   - момент согласия берётся из клиента только в правдоподобном окне
     (`-24 ч … +5 мин`), иначе — серверное время: часы посетителя могут спешить
     на годы;
   - расхождение с текущей редакцией логируется всегда.
5. **`db/schema.ts`** — `consent_version text`, `consent_at timestamptz`, обе
   nullable: существующие строки остаются `NULL` (фаза `expand` раздела 3.8, без
   перезаписи истории).
6. **Флаг `LEAD_CONSENT_VERSION_REQUIRED`** (по умолчанию `0`) — правило 8
   раздела 2 ТЗ. С флагом `1` заявка с устаревшей или отсутствующей версией
   отклоняется `422` с текстом «Политика конфиденциальности обновилась…».
   По умолчанию расхождение только пишется в лог: деплой новой редакции не
   должен терять посетителей со старой вкладкой.
7. **Rescue-заявка** (`lib/lead/rescue-lead.ts`) — `consentGiven` стало
   обязательным полем входа: без отмеченного чекбокса `submitRescueLead`
   возвращает отказ, **не делая запроса**. Диалог (`components/ui/confirm-dialog.tsx`)
   передаёт факт согласия и момент клика в обработчик отправки.
8. **`consentAt` исключён из отпечатка payload** (`lib/lead/canonical.ts`) —
   иначе PT-009/PT-013 сломались бы: снял и снова отметил галочку → другой
   `payloadHash` → `409` вместо кода уже сохранённой заявки и потеря дедупа.
   `consentVersion` в отпечаток входит: в пределах сборки она неизменна и
   является частью юридического факта.

Побочная находка при реализации: обработчик отправки в диалоге —
`useCallback(…, [hasPhoneField, submit])` — без состояния согласия в
зависимостях. Как только согласие стало передаваться в `run`, замыкание
запомнило `given: false` первого рендера, и все rescue-заявки начали уходить с
`consentGiven: false`. Поймано существующими E2E-тестами PT-004 (28 падений),
исправлено устойчивым объектом из хука (`useMemo`) и явной зависимостью.

### Тесты

**Unit** — `tests/privacy-policy.test.ts` (**11**: формат, календарь, разбор
мусора, человекочитаемая дата, проверка исходника страницы политики) и
`tests/lead-consent.test.ts` (**13**: версия текущая/старая/мусор, окно времени
клиента и его границы, замена серверным временем, независимость отпечатка и
sha256 от `consentAt`, зависимость от `consentVersion` и от `consent: false`).

**Интеграция с БД** — 6 новых тестов в `tests/lead-route-db.test.ts`: версия и
момент доезжают до колонок; без версии — `NULL`, а момент ставит сервер;
невозможное время заменяется серверным; мусор в версии не доезжает до БД; флаг
`LEAD_CONSENT_VERSION_REQUIRED=1` отклоняет устаревшую и отсутствующую версию
(`422`, `code: consent_version_stale`); по умолчанию устаревшая версия
принимается и логируется.

**Rescue** — 3 новых теста в `tests/rescue-lead.test.ts`: без согласия запрос не
уходит вовсе; payload несёт `consent`/`consentVersion`/`consentAt`;
`buildRescueLeadPayload` не подставляет `true` за человека.

**E2E** — новый `e2e/consent-version.spec.ts` (3 теста × 2 проекта): форма несёт
факт, редакцию и момент клика; снятая и снова отмеченная галочка обновляет момент
(и блокирует кнопку, пока согласия нет); `/privacy` показывает дату редакции из
константы, а не сегодняшнюю. Плюс тест в `e2e/rescue-and-draft.spec.ts`: rescue
несёт версию и момент клика.

**Обновлённые существующие:** фабрика входа в `tests/rescue-lead.test.ts`
получила обязательные `consentGiven`/`consentAt` (тип больше не позволяет их
не передать).

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run lint                  → ✖ 19 problems (0 errors, 19 warnings)   ← все предсуществующие
$ npx tsc --noEmit              → 0 ошибок
$ node scripts/check-file-size.mjs
                                → [file-size] ok — проверено 123 файлов, лимит 600 строк, 4 legacy-исключения
$ node scripts/check-effect-setstate.mjs
                                → [effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору
$ npm run validate:catalog      → validate-catalog: ok (48 SKU, 7 профилей)
$ DATABASE_URL=… npx drizzle-kit push --force
                                → [✓] Changes applied   (добавлены consent_version, consent_at)
$ TEST_DATABASE_URL=… CRON_SECRET=… npx vitest run
                                → Test Files 72 passed (72); Tests 803 passed (803)
$ npm run test:flow             → # pass 5 / # fail 0
$ npm run build                 → exit 0, ✓ Compiled successfully
$ npm run check:bundle          → [bundle] ok — / 225.2 КБ ≤ 300 КБ
$ npx playwright test           → 180 passed, 12 skipped (6.9m), 0 unexpected failures
$ npm audit --omit=dev          → found 0 vulnerabilities
```

Было: 70 файлов / 770 тестов, E2E 172 passed, бандл 224.8 КБ. Стало:
**72 / 803**, E2E **180 passed**, бандл **225.2 КБ**. `action-form.tsx` сократился
с 561 до **549** строк (порог в LEGACY_BUDGET понижен): чекбокс согласия вынесен
в `lead-consent-checkbox.tsx`.

### Ограничения

- `PRIVACY_POLICY_VERSION` обновляется вручную вместе с текстом политики.
  Автоматически вывести дату из `git` нельзя: на Amvera сборка идёт из
  `main`, а глубина истории в контейнере не гарантирована.
- `consent_version`/`consent_at` у заявок до PT-014 остаются `NULL` — история не
  перезаписывается, восстановить факт согласия задним числом невозможно.
- Клиент, открытый до деплоя, ещё какое-то время шлёт заявки без версии: они
  принимаются (поэтому флаг строгости по умолчанию выключен), но в БД будет
  `NULL`. Это осознанный выбор в пользу неприёма потерь заявок.
- Текст согласия в UI не показывает редакцию явно («…с политикой
  конфиденциальности»); версия передаётся в заявке. Добавлять ли её в подпись
  чекбокса — решение владельца, на юридическую силу записи это не влияет.
- Проверено в Chromium (desktop 1280×900 и mobile 390×844). **Safari и Firefox
  не проверялись — проверка не выполнена.**
- `curl` прода не выполнялся (прод собирается из `main`); миграция в проде
  применится при деплое через `drizzle-kit push` (nullable-колонки, без
  блокирующей перезаписи).

### Откат

`git revert` этого коммита убирает запись версии и момента согласия (колонки в
БД останутся — drizzle `push` не удаляет их автоматически; при желании удалить
вручную: `ALTER TABLE leads DROP COLUMN consent_version, DROP COLUMN consent_at`).
Флаг `LEAD_CONSENT_VERSION_REQUIRED=0` (значение по умолчанию) выключает
единственную проверку, способную отклонить заявку, — это и есть аварийный откат
без деплоя.

## Алерт при систематических сбоях доставки (PT-015)

ТЗ v5, раздел 4 (Фаза 4, P1); задача `PT-015`.

### Проблема

После PT-002/PT-003 заявка сохраняется в БД **до** попытки отправки, а отказ
канала доставки не влияет на ответ: человек видит «Заявка №K7F3Q сохранена».
Для посетителя это правильно. Для владельца — слепая зона: если Telegram-бот
отозван, а ключ Web3Forms протух, заявки продолжают «сохраняться» неделями, и
никто их не увидит вовремя. Единственный след — строки `failed` в
`lead_deliveries` и логи контейнера, которые никто не читает.

### Решение

Если **N подряд** попыток доставки завершились неудачей **во все** каналы —
уходит служебное уведомление по каналу, который от Telegram заявок и Web3Forms
не зависит (`DELIVERY_ALERT_WEBHOOK_URL` — любой HTTP-приёмник JSON, либо
второй Telegram-бот/чат). Алерт, отправленный через тот же бот, умер бы вместе
с тем, о чём сообщает, — поэтому переиспользовать `deliverToTelegram` запрещено
самой структурой модулей.

Как считается «N подряд»:

1. Из БД берутся последние `DELIVERY_ALERT_LOOKBACK` заданий в порядке времени
   **последней попытки** (`coalesce(last_attempt_at, created_at)`), а не времени
   создания. Иначе ретрай вчерашнего задания встал бы в хвост и разорвал серию
   там, где сбоя нет: затянувшийся инцидент выглядит именно так — новых заявок
   нет, крон безуспешно повторяет старые.
2. Серия — идущие с самой свежей попытки строки со статусом `failed`. Первая же
   успешная отправка обнуляет её. Задания без попыток (`pending`, `attempts=0`)
   серию не рвут: они ещё не пробовали отправиться.
3. Алерт срабатывает, только если серия не короче `DELIVERY_ALERT_THRESHOLD`,
   покрывает **все** настроенные каналы и началась внутри
   `DELIVERY_ALERT_WINDOW_MIN`. Один лежащий бот при живой почте — не сигнал:
   заявки доходят, а будить владельца шумом значит приучить его игнорировать
   алерты.

Проверка вызывается из двух мест:

- `POST /api/lead` — после `deliverAll`, если упал хотя бы один канал. Ответ
  клиенту её **не ждёт**: это по-прежнему fire-and-forget, и сломанный приёмник
  алерта не может ни задержать ответ, ни вернуть 500 на денежном пути;
- `POST /api/lead/retry` — в конце прогона крона, и это главное место для
  затяжного сбоя: серия видна даже тогда, когда новых заявок нет вовсе.

Охлаждение хранится в таблице `delivery_alerts`, а не в памяти процесса:
контейнер перезапускается, а «не чаще раза в час» должно это переживать. Запись
пишется **и при неудачной отправке алерта** — иначе сломанный вебхук давал бы
новый запрос на каждый прогон крона, то есть шторм вместо сигнала.

В тексте уведомления нет персональных данных: ни телефона, ни имени, ни состава
заказа — только счётчики, каналы, время (МСК) и обрезанные ошибки. Алерт уходит
на внешний сервис, который не входит в контур обработки персональных данных
сайта. По той же причине `lastError` каналов чистится: вырезаются URL, почта,
телефон и длинные последовательности, похожие на токены. Реализация одна —
`sanitizeAlertText` в `lib/lead/alert-notify.ts`.

### Файлы

| Файл | Что делает |
|---|---|
| `lib/lead/delivery-alert.ts` | чистая логика: `computeDeliveryHealth`, `evaluateDeliveryHealth`, `buildDeliveryAlertMessage`, оркестратор `maybeAlertDeliveryDegradation` |
| `lib/lead/alert-notify.ts` | приёмники алерта (вебхук, второй бот) и очистка текста |
| `db/schema.ts` | таблица `delivery_alerts` + колонка `lead_deliveries.last_attempt_at` |
| `lib/lead/store-types.ts`, `store-pg.ts`, `store.ts` | `listRecentDeliveries`, `findLastDeliveryAlert`, `recordDeliveryAlert` — в обеих реализациях хранилища |
| `lib/env.ts`, `.env.example`, `scripts/check-env.mjs` | 8 переменных `DELIVERY_ALERT_*` + предупреждение, если канал алерта не задан |
| `app/api/lead/route.ts`, `app/api/lead/retry/route.ts` | вызов проверки |

Колонка `last_attempt_at` добавлена nullable (фаза `expand` раздела 3.8): у
существующих строк значения нет, читается `created_at`, первая же попытка
заполняет её сама.

Попутно закрыт пробел PT-014: флаг `LEAD_CONSENT_VERSION_REQUIRED` не был
описан ни в `.env.example`, ни в `SCHEMA_KEYS` стража `check-env.mjs` (страж
сверяет свой список с примером, а не с `lib/env.ts`, поэтому расхождение не
обнаруживалось само).

### Тесты

**Unit** — `tests/delivery-alert.test.ts` (**40**): порог, обнуление серии
успехом, успех в середине ряда, один лежащий канал, серия старше окна,
охлаждение (границы), флаг, ненастроенный приёмник, пустая очередь, `pending`
без попыток, независимость от порядка строк на входе, ретрай старого задания,
счётчики окна; конфигурация из окружения; текст алерта (состав и отсутствие
телефона/почты/URL/токена); очистка текста; отправка на вебхук и на второй бот
(отдельный токен, не бот заявок), оба приёмника при отказе первого, сетевое
исключение, отсутствие настроек, не-http(s) URL; полный цикл на in-memory
хранилище (журнал, охлаждение, отказ приёмника, выключенный флаг — хранилище не
опрашивается вовсе).

**Проверка встройки в роуты** — там же, 4 теста: крон отправляет алерт после
серии неудач и не меняет прежние поля ответа (`retried/sent/failed/recovered`);
крон без сбоев возвращает `alert: { fired: false, reason }`; `POST /api/lead`
запускает проверку после ответа клиенту (через `vi.waitFor`); при успешной
доставке проверки нет вовсе.

**Интеграция с БД** — `tests/delivery-alert-db.test.ts` (**9**):
`last_attempt_at` пустой до попытки и заполняется после, повторная попытка
обновляет строку на месте; сортировка серии по времени попытки (ретрай старого
задания поднимается наверх); журнал алертов пишет и отдаёт последнюю запись;
полный цикл на реальной БД с проверкой, что телефон и имя из заявки не попали ни
в вебхук, ни в журнал; **охлаждение переживает новый экземпляр хранилища**
(эмуляция рестарта контейнера); отказ приёмника — запись с `delivered_via NULL`
и ровно один запрос наружу; один упавший канал — алерта нет; серия короче порога
— алерта нет; флаг `=0` гасит проверку.

**Обновлённые существующие:** `tests/env.test.ts` (+6): дефолты и пороги
`DELIVERY_ALERT_*`, предупреждение о ненастроенном канале, второй бот как канал,
«полная конфигурация» теперь включает канал алерта.

**Изоляция БД-тестов (`vitest.config.ts`).** Третий файл с тестами БД вскрыл
гонку, которая существовала и раньше: `tests/lead-store-pg.test.ts` и
`tests/lead-route-db.test.ts` работают с одними таблицами и в `beforeEach`
делают `DELETE` по всей таблице, а vitest запускает файлы параллельно. В CI это
вылилось в случайные падения `lead-route-db` (`404` вместо `200`, `undefined`
вместо версии политики) и `recordDelivery` (`row is undefined` — строка исчезла
между `SELECT` и `UPDATE`). БД-файлы вынесены в отдельный проект vitest с
`fileParallelism: false`: они идут строго по очереди, остальные 70+ файлов
по-прежнему параллельны (проверено тремя полными прогонами подряд — 858/858).
Развести их по разным схемам нельзя: CI поднимает один `postgres:17-alpine` с
единственной базой `potolkovo_test`. Корневой `include` при этом убран — с
заданным `projects` корневой проект тоже собирал тесты, и каждый файл
выполнялся дважды (145 файлов вместо 74).

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run lint                  → ✖ 19 problems (0 errors, 19 warnings)   ← все предсуществующие
$ npx tsc --noEmit              → 0 ошибок
$ node scripts/check-file-size.mjs
                                → [file-size] ok — проверено 123 файлов, лимит 600 строк, 4 legacy-исключения
$ node scripts/check-effect-setstate.mjs
                                → [effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору
$ npm run validate:catalog      → validate-catalog: ok (48 SKU, 7 профилей)
$ npm run check:env             → [env] ok — 24 переменных документированы (было 15)
$ DATABASE_URL=… npx drizzle-kit push --force
                                → [✓] Changes applied  (delivery_alerts, lead_deliveries.last_attempt_at)
$ TEST_DATABASE_URL=… npx vitest run
                                → Test Files 74 passed (74); Tests 858 passed (858)
$ npm run test:flow             → # pass 5 / # fail 0
$ npm run build                 → exit 0, ✓ Compiled successfully
$ npm run check:bundle          → [bundle] ok — / 225.2 КБ ≤ 300 КБ (не изменился: код серверный)
$ npx playwright test           → 180 passed, 12 skipped (7.1m), 0 unexpected failures
$ npm audit --omit=dev          → found 0 vulnerabilities
```

Было: 72 файла / 803 теста. Стало: **74 / 858** (+55). E2E — 180 passed, как и
до задачи.

### Ограничения

- **Алерт не отправится, пока не настроен приёмник.** По умолчанию не задан ни
  `DELIVERY_ALERT_WEBHOOK_URL`, ни второй бот — проверка при этом работает,
  пишет предупреждение в лог один раз на процесс и не отправляет ничего.
  **Действие владельца:** задать `DELIVERY_ALERT_WEBHOOK_URL` (ntfy, Apprise,
  Slack/Discord-интеграция или своя ручка) либо `DELIVERY_ALERT_TELEGRAM_BOT_TOKEN`
  и `DELIVERY_ALERT_TELEGRAM_CHAT_ID` второго бота/чата. Проверка, что переменные
  доехали: `npm run check:env` — предупреждение «канал алерта не задан» должно
  исчезнуть.
- Крон `/api/lead/retry` на Amvera настраивается внешним планировщиком
  (`vercel.json` в репозитории нет). Без крона алерт всё равно срабатывает — но
  только по новым заявкам: серия растёт на ретраях, а ретраев без крона нет.
- Охлаждение считается по любой записи журнала, включая неудачную отправку
  алерта. Осознанный выбор: шторм записей и запросов хуже, чем один
  недошедший алерт; ошибка отправки пишется в `delivery_alerts.last_error` и в
  лог контейнера.
- Порог по умолчанию `4` — это две заявки, у которых легли оба канала. На
  сайте с трафиком «несколько заявок в день» такое событие может занять часы;
  снижать порог до `2` значит алертить на каждую первую заявку со сбоем.
- Задания с `attempts >= 5` крон больше не повторяет (предел `MAX_ATTEMPTS`),
  поэтому серия перестаёт расти, а через `DELIVERY_ALERT_WINDOW_MIN` проверка
  отвечает `streak-too-old`. Алерт об одном инциденте — один-два, не бесконечные.
- E2E-тест не добавлялся: в CI job `e2e` не поднимает PostgreSQL (БД есть
  только в job `static`), а проверка целиком серверная. Проводка в роуты покрыта
  тестами, которые вызывают сами обработчики `POST /api/lead` и
  `POST /api/lead/retry`.
- Проверено в Chromium (desktop и mobile). Safari и Firefox — **проверка не
  выполнена**. `curl` прода не выполнялся (прод собирается из `main`).

### Откат

`DELIVERY_ALERT_ENABLED=0` — выключает проверку целиком, без деплоя: ни одного
запроса к БД и наружу, ответ крона несёт `alert: { fired: false, reason:
"disabled" }`. `git revert` убирает код; таблицы `delivery_alerts` и колонка
`last_attempt_at` в БД останутся (`drizzle-kit push` не удаляет их
автоматически) — при желании: `ALTER TABLE leads DROP …` не нужен, достаточно
`DROP TABLE delivery_alerts; ALTER TABLE lead_deliveries DROP COLUMN
last_attempt_at;`.

## Календарь дат замера без деплоя (PT-016)

ТЗ v5, раздел 4 (Фаза 4, P1); задача `PT-016` (источники `B-F108`, `T-322`).

### Что было сломано

Свободные даты замера жили в `content/availability.ts` — файле, который правится
коммитом. Чтобы поменять «чт, сб» на реальные окна, нужны были правка, сборка и
деплой; между деплоями сайт показывал дни недели, которые давно заняты. Страж
`scripts/check-availability.mjs` ограничивал срок годности тремя неделями и
ронял сборку, но процесса обновления не создавал: он лишь напоминал, что календарь
протух. Отдельная ловушка — статическая генерация: строка запекалась в HTML на
этапе сборки, то есть «автоскрытие» просроченных дат срабатывало только после
следующего деплоя.

### Как устроено теперь

Даты — строки таблицы `availability_slots` (`slot_date` уникальна, `note` —
подпись окна вроде «утро»). Вторая таблица, `availability_settings` (одна строка,
`id = 1`), хранит факт «календарь заполняли через админку» и время последнего
сохранения. Она нужна, чтобы отличить **не настроено** от **свободных окон нет**:
в первом случае сайт показывает запасной файл (иначе блок срочности погас бы
сразу после деплоя, до первого захода владельца), во втором — молчит честно.

| Условие | Что видит посетитель |
|---|---|
| `AVAILABILITY_DB_ENABLED=0` или нет `DATABASE_URL` | запасной календарь из файла (поведение до PT-016) |
| в `availability_settings` нет строки | запасной календарь из файла |
| БД заполнена, будущие окна есть | `Свободные даты замера: пт 18.09 (утро), вс 20.09, пт 25.09` |
| БД заполнена, будущих окон ноль | блока нет вовсе |
| БД недоступна | запасной календарь + предупреждение в лог контейнера |

Просроченные даты отсекаются при чтении по московскому дню
(`lib/availability/format.ts`): сервер живёт в UTC, и без явной зоны «сегодня»
в 00:30 мск оказывалось вчерашним днём. Прошедшие строки из БД не удаляются —
это история предложенных окон; в ответе админки они приходят отдельным списком
`expired` и в сохранение не возвращаются.

**Проводка до посетителя.** Строку показывают три места: форма на главной, Шаг 2
калькулятора и блок о мастере. Первые два — клиентские компоненты, а модалка
калькулятора подвешена в `app/providers.tsx`, то есть выше любой страницы.
Читать БД в `layout.tsx` означало бы сделать динамическим весь сайт ради одной
строки, поэтому работает `GET /api/availability` (публичный, кэш 30 с в процессе
и `s-maxage=30`) и хук `useAvailabilityLabel()`: первый рендер — запасная строка
из файла (HTML не меняется, блок не прыгает), после гидрации — данные из БД.
Три компонента на странице делят один запрос, повторные открытия вкладки в
течение минуты берут значение из `sessionStorage` (через обёртку PT-012).
Запрос не удался — остаётся запасная строка: календарь не стоит того, чтобы
из-за него пропадал блок «почему сейчас».

### Как владельцу обновить даты

1. Открыть `https://potolkovo-msk.ru/admin/availability` (можно с телефона).
2. Ввести пароль — значение `AVAILABILITY_TOKEN` из переменных Amvera — и нажать
   «Загрузить календарь». Пароль хранится в `sessionStorage` вкладки и стирается
   при её закрытии.
3. Добавить даты: поле даты (минимум сегодня, максимум 60 дней вперёд) и
   необязательная подпись («утро», «после 17:00»). Лишнее — «Убрать».
4. «Сохранить на сайте». Список заменяется целиком одной транзакцией, поэтому
   обрыв связи не оставит сайт с половиной дат.
5. Проверить главную: у посетителя строка обновится в течение минуты (кэш
   вкладки 60 с), при новой загрузке страницы — сразу.

Пустой список — валидное сохранение: «свободных окон нет», блок на сайте
скрывается. То же произойдёт само, когда все введённые даты пройдут.

То же самое без страницы, одним запросом:

```bash
curl -X PUT https://potolkovo-msk.ru/api/admin/availability \
  -H "Authorization: Bearer $AVAILABILITY_TOKEN" -H "content-type: application/json" \
  -d '{"slots":[{"date":"2026-09-18","note":"утро"},{"date":"2026-09-20"}]}'
```

Ответы: `200` — сохранено; `401` — неверный пароль; `422` — список с ошибками
(в `issues` человекочитаемые тексты: «2026-09-01 уже прошла — уберите её из
списка»); `503` — не настроено (нет `AVAILABILITY_TOKEN`, нет `DATABASE_URL` или
флаг отката выключен); `413` — тело больше 64 КБ.

### Безопасность

Токен отдельный от `CRON_SECRET`: крон и календарь меняют разные вещи, и утечка
одного не должна открывать другое. Сравнение побайтово с постоянным временем
(`timingSafeEqual`), поэтому значение другой длины и «почти верный» токен дают
`401`, а не исключение. Страница закрыта от индексации дважды: `noindex` в
метаданных и `Disallow: /admin` в `robots.txt`; в `sitemap.xml` её нет. Тело
запроса меряется до разбора JSON.

### Тесты

- `tests/availability-slots.test.ts` (**19**) — чистые функции: формат даты и
  дня недели, «сегодня» по Москве, отсечение прошедшего, строка при нуле окон,
  разбор тела сохранения (прошедшая дата, горизонт 60 дней, дубликаты, мусор,
  длинная подпись, пустой список).
- `tests/availability-snapshot.test.ts` (**9**) — выбор источника на подменённом
  хранилище: флаг выключен, нет БД, календарь не заполнен, заполнен, все даты
  прошли, ноль окон, сбой БД.
- `tests/availability-api.test.ts` (**4**) — публичный роут: запасной календарь
  при выключенном флаге, без `DATABASE_URL` и при недоступной БД (200, не 500),
  короткий кэш ответа.
- `tests/availability-admin-route.test.ts` (**11**) — доступ и разбор тела: 503
  «не настроено» отличается от 401, «почти верный» токен, 422 с текстом для
  человека, 413 до разбора JSON, `no-store` на отказах.
- `tests/availability-db.test.ts` (**10**, настоящий PostgreSQL, добавлен в
  последовательный проект `db` в `vitest.config.ts`) — применение схемы, замена
  списка целиком, одна строка настроек, ноль окон после сохранения, просроченные
  даты в `expired`, `PUT` сразу виден в публичном ответе (сброс кэша процесса),
  `422` не трогает таблицу, уникальность даты.
- `tests/env.test.ts` — **+4** на новые переменные и предупреждение «без пароля
  календарь снова правится только деплоем».

Всего 915 тестов (было 858). Прогнано локально: `tsc --noEmit` 0 ошибок,
`eslint` 0 ошибок (19 прежних предупреждений), `next build` — все страницы
остались статическими, динамические только два новых API, бандл главной
225.7 КБ ≤ 300 КБ, `check:env` в strict-режиме (26 переменных), `test:flow` 5/5,
`validate:catalog` ok.

Живьём проверено на prod-сборке с локальной БД: `PUT` с датами → публичный
ответ сразу `source: db` с новыми датами; все даты сдвинуты в прошлое →
`label: null`, блок скрыт без деплоя; `AVAILABILITY_DB_ENABLED=0` → сайт снова
на файле, админка отвечает 503.

### Страж календаря больше не роняет сборку

Раньше `check-availability.mjs` падал, если `validUntil` ушло дальше 21 дня или
в прошлое: файл был единственным источником, и протухшая дата означала ложь на
сайте. Теперь файл — запасной, а протухший запасной источник молчит
(`getAvailabilityLabel()` вернёт `null`), поэтому страж **предупреждает** и
возвращает 0. Решение владельца по PT-016, вариант «а»: иначе следующий деплой
после истечения даты падал бы из-за файла, который больше никто не правит.
Падает страж по-прежнему только на структурно сломанном файле (нет `validUntil`
или это не дата) — без него запасной календарь нечем ограничить. Проверка
«не дальше трёх недель» убрана и из `tests/availability-window.test.ts` по той
же причине; обязательным осталось поведение: протухший календарь молчит.

Комментарий внутри `content/availability.ts` про «роняет сборку» устарел и
намеренно не исправлен в этой ветке: файл правится в `PR #31` (срок годности
календаря), и правка соседних строк дала бы конфликт. Поправить следом.

### Что намеренно не сделано

- **Дата в БД не синхронизируется с реальным календарём мастера.** Автоматической
  выгрузки нет; источник правды — человек. Задача закрывала «нельзя обновить без
  деплоя», а не «обновляется само».
- **Нет истории правок и журнала изменений.** `availability_settings.updatedAt` —
  единственная метка времени. Для одного мастера и десятков строк этого
  достаточно; аудит появился бы вместе с ценой усложнения записи.
- **Прошедшие даты не чистятся.** Оставляются как история; чтение их отсекает.
  Если таблица когда-нибудь вырастет до тысяч строк, нужна будет архивация —
  сейчас запрос читает её целиком, и это десятки строк.
- **E2E не добавлялся:** в CI job `e2e` не поднимает PostgreSQL (БД есть только
  в job `static`), а без БД спеки проверяли бы только запасной путь. Админка и
  публичный роут покрыты тестами, которые вызывают сами обработчики.
- **В браузере не проверялось**: Chromium в песочнице не поднимался, поведение
  хука после гидрации подтверждено кодом и `curl`. Ручная проверка страницы
  `/admin/availability` и строки на главной с телефона — за владельцем.
- **Прод не проверялся**: прод собирается из `main`, а задача идёт в `quizv2ver1`.

### Откат

`AVAILABILITY_DB_ENABLED=0` в переменных Amvera — без деплоя: сайт мгновенно
возвращается на `content/availability.ts`, админка отвечает 503 `disabled`,
строки в БД остаются нетронутыми. `git revert` убирает код; таблицы можно не
трогать, при желании: `DROP TABLE availability_slots; DROP TABLE
availability_settings;`.

---

## Товары без фото: не прячем, а помечаем (PT-017)

`B-F109` · `T-323`.

### Что написано в ТЗ и что оказалось в данных

В ТЗ задача сформулирована от факта «34 SKU без локального фото подтверждены».
По правилу 10 раздела 2 цифра переверена на HEAD `f5411e8` — и она **устарела**:

```
$ npm run check:catalog-images
[catalog-images] ok — 100% товаров с ценой имеют локальное фото

$ cat data/catalog-images-missing.json
[]
```

В снапшоте 547 товаров, все с ценой, все 547 есть в манифесте
`data/catalog-images.json`, в `public/catalog/` лежит 1094 файла (256 и 512 px на
товар), записей «в манифесте, но нет файла» — 0. «34» описывают состояние до
`scripts/fill-missing-covers.mjs` и обновления ссылок из актуального фида.

Поэтому задача сделана механизмом, а не разовой правкой списка. Без механизма
проблему возвращает первый же еженедельный `refresh-catalog.yml`: новый SKU из
фида, чью обложку поставщик отдаёт с ошибкой, попадает в
`data/catalog-images-missing.json` и показывается заглушкой. Сегодня приток
новых SKU приостановлен — `refresh-feed.mjs` падает без секрета `FEED_URL`
(долг №7 в `OWNER-TODO-2026-09-15.md`), — но чинить его будут, и к тому моменту
правило уже на месте.

### Одно правило на весь сайт

`lib/catalog-photo.ts` — три состояния вместо «есть/нет»:

| ранг | состояние | откуда знаем |
| --- | --- | --- |
| `0` | локальное превью `public/catalog/{id}-{256,512}.webp` | ключ в `data/catalog-images.json` |
| `1` | только ссылка на хост поставщика | `coverImage` есть, сборщик её не проверял |
| `2` | фото нет | `coverImage` пустой либо товар/обложка есть в отчёте `data/catalog-images-missing.json` |

`sortByPhoto()` сортирует устойчиво: порядок внутри группы не меняется, то есть
цена, наличие и релевантность поиска не перемешиваются — сдвигается только
приоритет показа. `isPhotoPending()` — признак ранга `2`; по нему рисуется
пометка «Фото уточняется» (`PHOTO_PENDING_LABEL`).

До задачи «есть ли фото» решалось в трёх местах по-разному: каталог смотрел в
манифест, `ProductImage` — в манифест плюс внешнюю обложку, автоподбор
светильников не смотрел вовсе. Теперь источник один.

Где применяется:

- **Каталог** (`filterCatalogProducts`): раздел → фильтры → поиск → фото вперёд.
  Поиск намеренно идёт ДО сортировки: позиция без фото находится прямым запросом
  и не выпадает из раздела.
- **Автоподбор светильников** (`pointsOfKind`): картинка-образец на карточке типа
  и кнопка «Добавить N популярных» берут первый товар списка — теперь сначала
  фото-группа, внутри неё по цене.
- **Цена «от»** (`minPriceOfKind`): истинный минимум БЕЗ оглядки на фото. Список
  упорядочен по снимку, и `[0]` дал бы «от 420 ₽», когда в каталоге есть тот же
  светильник за 350 ₽ без фото. Цена — обязательство, фотографией её двигать
  нельзя.
- **Топ для schema.org** (`getTrackSaleProductOffers`): сначала позиции со
  снимком — без `image` карточка товара в поисковой выдаче не собирается.
- **Карточка товара** (`CatalogProductCard`): бейдж «Фото уточняется»
  (`data-testid="photo-pending-badge"`); та же пометка печатается в SVG-заглушке
  под названием товара.
- **Комплект** (`kit-rules`, `kit-offer`, `catalog-kit-gaps`): про фото не знает
  вовсе, и это закреплено тестом-стражем. Обязательное комплектующее без снимка
  остаётся обязательным — иначе собранный комплект технически неполный.

Попутно закрыты две дыры того же класса:

1. `ProductImageLightbox` при пустом `src` рисовал плашку «нет фото», даже если
   локальное превью лежало в `public/catalog` — товар с фотографией выглядел
   товаром без фотографии. Теперь локальное превью важнее внешней ссылки, а
   вместо плашки — общая заглушка с пометкой.
2. `ProductImage` уходил запросом по обложке, которую сборщик уже признал битой:
   моргание битой картинки и лишний 404 у покупателя. Теперь заглушка сразу.

### Проверка на живой сборке

Сегодня в каталоге нет ни одной позиции без фото, поэтому сценарий воспроизведён
временно на собранном сайте: у товара `eks-0-00001335` (КОЛИБРИ трековый
светильник РИО черный, 12W, 3080 ₽) запись убрана из манифеста и добавлена в
`data/catalog-images-missing.json`, страница снята `curl` после пересборки.

| | до (фото есть) | после (фото отобрано) |
| --- | --- | --- |
| место карточки в разделе | 1-е из 16 | 16-е из 16 |
| бейдж «Фото уточняется» | 0 | 1 |
| `<img>` с локальным превью | 19 | 17 |
| `<img>` с SVG-заглушкой | 0 | 1 |
| хотлинков на `eksmarket.ru` в `<img>` | 0 | 0 |
| плашек «нет фото» | 0 | 0 |
| карточек в разделе | 16 | 16 |
| комплектов «Быстрый старт» | 3 | 3 |

Комплект не развалился: обложка комплекта «Для кухни» (её представитель — тот же
РИО) штатно упала на `/svc-tracksale.jpeg`. После эксперимента данные
восстановлены (`git status` по `data/` чистый).

Отдельно снята страница на коде ДО задачи и после: порядок 16 карточек каталога и
список `ItemList` в schema.org совпали полностью — при 100 % покрытия фото
новое правило ничего не переставляет.

### Файлы

- `lib/catalog-photo.ts` — новый модуль правила (ранги, сортировка, пометка,
  `photoCoverage` для отчётов).
- `lib/lighting/catalog-filters.ts` — `withPhotoFirst` заменён на общий
  `sortByPhoto`, ранг можно подменить в тесте.
- `lib/lighting/popular-points.ts` — `pointsOfKind` фото-первый, `minPriceOfKind`
  считает истинный минимум.
- `components/feed2/ProductImage.tsx`, `ProductImageLightbox.tsx` — заглушка с
  пометкой, локальное превью важнее внешней ссылки, нет запроса по битой обложке.
- `components/lighting/CatalogProductCard.tsx` — бейдж «Фото уточняется».
- `app/…/CatalogSectionClient.tsx` — локальный `hasPhoto` удалён (757 → 748 строк,
  порог в `scripts/check-file-size.mjs` понижен).
- `app/…/LightKitShowcase.tsx` — `kitImageSrc` на общем `hasLocalPhoto`, топ для
  schema.org фото-первый.
- `e2e/catalog-images.spec.ts` — устаревший комментарий про «16 светильников
  КОЛИБРИ без обложек» приведён к фактам.

### Тесты

904 passed / 34 skipped (938) — было 899/933. Новые и изменённые:

- `tests/catalog-photo.test.ts` (20) — ранги, устойчивость сортировки, пометка в
  заглушке, бейдж и лайтбокс через `renderToStaticMarkup`, покрытие живого
  каталога (`none === 0` — фиксация того, что «34» больше не воспроизводится).
- `tests/product-image-pending.test.ts` (5) — ветка «обложка заведомо битая»
  через `vi.mock`: в живом каталоге такого товара сейчас нет, а подменять данные
  каталога фиктивными — значит тестировать выдумку.
- `tests/popular-points.test.ts` (+3) — фото-группы внутри списка, «от» = истинный
  минимум, автопредложение уходит товару со снимком, цена «от» не сдвигается.
- `tests/catalog-filters.test.ts` (+2) — товар без фото находится прямым поиском
  и опускается ниже, но не выпадает.
- `tests/kit-rules.test.ts` (+3) — комплектующее без фото попадает в комплект, а
  в правилах комплекта нет ни слова про фотографию.

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npx tsc --noEmit
(нет вывода — 0 ошибок)

$ npm run lint
✖ 19 problems (0 errors, 19 warnings)        # все 19 — прежние

$ npm test
 Test Files  78 passed | 3 skipped (81)
      Tests  904 passed | 34 skipped (938)

$ node scripts/check-file-size.mjs
[file-size] ok — проверено 128 файлов, лимит 600 строк, 4 legacy-исключения

$ node scripts/check-effect-setstate.mjs
[effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору

$ npm run check:catalog-images
[catalog-images] ok — 100% товаров с ценой имеют локальное фото

$ npm run check:bundle
[bundle] ok — / 225.7 КБ ≤ 300 КБ

$ npm run validate:catalog
validate-catalog: ok (48 SKU, 7 профилей)

$ npm run build
✓ Compiled successfully
✓ Generating static pages using 1 worker (19/19)
```

34 пропуска — три БД-файла (`availability-db`, `delivery-alert-db`,
`lead-route-db`): они skip-ятся без `TEST_DATABASE_URL`, в песочнице его нет. В CI
база поднимается, и там эти тесты исполняются.

### Ограничения

- **E2E локально не запускался**: браузеры Playwright в песочнице не установлены
  (`~/.cache/ms-playwright` отсутствует). Проверка — в CI job `e2e`; существующий
  сценарий 14 (`e2e/catalog-images.spec.ts`) ожидает локальные фото и отсутствие
  битых картинок, что на сегодняшних данных не изменилось.
- **В браузере глазами не проверялось**: бейдж и заглушка подтверждены
  SSR-разметкой (`renderToStaticMarkup`) и `curl` боевой сборки. Как выглядит
  бейдж на узком экране — на усмотрение владельца при просмотре превью.
- **Ручной список по цоколю в модалке остался ценовым**
  (`wizard-step1-lighting.tsx`): файл занимает ровно свой бюджет 1396 строк, и
  одна строка импорта уронила бы стража размера. Автоподбор модалки фото-первый
  (он идёт через `pointsOfKind`), а ручной выбор — это осознанный выбор
  человека, где порядок по цене полезнее. Правка имеет смысл в PT-018, когда
  файл распилят.
- **Автопредложение может стать дороже самого дешёвого варианта**, если у самого
  дешёвого товара типа нет фото. Это прямое следствие требования ТЗ («понизить в
  автоподборе»). Сумма в кнопке считается от фактически выбранного товара, цена
  «от» на карточке типа остаётся истинным минимумом, а ручной выбор показывает
  все позиции — обмана в деньгах нет. Сегодня эффект нулевой: фото есть у всех.
- **Флаг отката не добавлялся**: правило 8 раздела 2 касается денежного пути, а
  расчёт цены не изменён (итоги корзины, скидки, «от» — как были). Точка отката
  одна — вызов `sortByPhoto` в `pointsOfKind`/`filterCatalogProducts`.
- **Прод не проверялся**: прод собирается из `main`, задача идёт в `quizv2ver1`.
- `content/*.ts` не тронуты (правило 0.4), публичные URL не менялись.

### Откат

`git revert <sha>` — данных задача не меняет: манифест `data/catalog-images.json`,
отчёт `data/catalog-images-missing.json` и `public/catalog/` не тронуты, поэтому
откат кода не требует никаких действий с файлами. `git revert` одного коммита
возвращает и `CatalogSectionClient.tsx` (757 строк), и порог стража размера в
`scripts/check-file-size.mjs` (тоже 757) — они менялись вместе, поэтому страж не
начнёт падать на «выросшем» файле.

## Технический долг Шага 1 «Свет» разобран (PT-018)

ТЗ v5, раздел 4 (Фаза 5, тестовая защита и техдолг); задача `PT-018`
(источники `B-F104`, `A-22`(MD), `T-324`).

Два самых длинных файла клиентского пути сокращены до ориентира команды
(≤600 строк) без изменения поведения — полный E2E до и после даёт те же
`180 passed / 12 skipped`:

| Файл | Было | Стало |
|---|---|---|
| `components/calculator-modal/wizard-step1-lighting.tsx` | 1395 | 544 |
| `app/uslugi/prodazha-trekovogo-osveshcheniya/_components/CatalogSectionClient.tsx` | 748 | 539 |

Оба legacy-исключения в `scripts/check-file-size.mjs` сняты: файлы живут под
общим лимитом 600 строк и расти без падения стража больше не могут.

Слои — как в эталоне Шага 0 (`lib/calculator/reducer.ts`):

```
чистые правила     step1-selectors · step1-progress · step1-cart-rules ·
                   step1-footer-action · track-sale-snapshot
хуки-сборки        use-step1-cart · use-step1-wizard · use-step1-screens ·
                   use-step1-tabs · use-track-sale-cart
компоненты-проводки Step1CatalogTab · Step1Recommendations
```

Эффекты с `setState` намеренно оставлены в компонентах — иначе они вышли бы
из-под стража `check-effect-setstate`. Единственное исключение: тело
`setSnapshot(prev => …)` в каталоге страницы стало чистой функцией
`nextCatalogSnapshot`, а сам эффект-мост остался на месте (приём из
`lib/calculator/rooms-snapshot.ts`, N-050).

Добавлено 134 теста (было 904, стало 1038). Подробный разбор по коммитам,
точные выводы проверок и порядок отката — в `PT-018-REPORT.md`.

Шаг 1 при этом **не** превращался в отдельный автомат со своим редьюсером:
состояние оверрайда экрана (`wOverride`) осталось в оркестраторе, потому что
его сеттер нужен и корзине (выбор профиля меняет систему трека). Полный вынос —
отдельная задача с планом отката, как и предупреждал `PHASE-C-REPORT.md`.

## Обязательные CI-гейты и реестр пропусков (PT-019)

ТЗ v5, раздел 4 (Фаза 5); задача `PT-019` (источники `A-12`, `T-325`).

### Что оказалось на самом деле

ТЗ исходила из факта «`npm run test:flow` падает на `resolveStep0ConfirmLabel is
not a function`». На HEAD это **не так**: прогон проходит. Функции с таким
именем в `lib/calculator-flow.ts` никогда не было, блок с её вызовом удалён в
`134c90b` («Шаг 0: одна подпись кнопки вместо трёх расходящихся источников»), а в
скрипте остался комментарий с разбором.

Настоящая дыра была в другом: **`test:flow` не вызывался в CI вообще**. Контракт
маршрутизации Шага 0, режимов скидки света и начальных опций модалки проверялся
только локально — именно поэтому сломанный вызов прожил в скрипте так долго.
Сломанный гейт и незапущенный гейт выглядят одинаково: зелёный CI.

Вторая часть требования — «без плавающих результатов» — тоже не выполнялась:
`retries: 1` в CI спасает от сетевых флаков, но заодно прячет настоящие. Тест
падал, повторялся, проходил, job зеленел, и узнать о флаке было нельзя.

### Что сделано

- Шаг «Поток калькулятора (test:flow)» в job `static` — после unit-тестов.
- `scripts/check-e2e-flaky.mjs` — читает JSON-отчёт Playwright и перечисляет
  тесты со статусом `flaky`, то есть прошедшие только со второй попытки.
  Режимы как у `check:env` (PT-006): `RELEASE=1` — блокирующий, иначе
  предупреждение. Отсутствие отчёта в блокирующем режиме — падение: утверждать
  «флаков нет» без отчёта нельзя.
- Блокирующий режим включён на `main`, `quizv2ver1` и в PR, которые в них идут
  (`github.base_ref`): чинить флак после мержа уже поздно. На остальных ветках —
  предупреждение, чтобы не мешать промежуточной работе.
- `playwright.config.ts` пишет `test-results/results.json` при `CI=1`
  (каталог в `.gitignore`); при падении job файл уезжает в артефакт
  `playwright-report`.
- `npm run ci:all` — весь обязательный pipeline из ТЗ одной командой (см.
  «Проверки» выше), чтобы его можно было воспроизвести локально.
- `test:flow` добавлен в pre-push `lefthook`: харнесс идёт ~20 мс.
- `test:flow` закрыл дыру в собственном покрытии: проверялись 5 из 7 экспортов
  `calculator-flow.ts`, теперь все 7 — добавлены `resolveStep2Copy` (копирайт
  Шага 2 по пяти интентам, ровно один placeholder `{callbackWindow}` в блоке
  «Что дальше», откат незнакомого интента к форме потолка) и
  `fillCallbackWindow` (подстановка окна, честное «в ближайшее время» при пустом
  значении, отсутствие мутации входного массива). Тесты проверены мутацией
  правила: при `callbackWindow.trim() || "в ближайшее время"` →
  `callbackWindow.trim()` прогон падает.

### Реестр пропусков и повторов в тестах

ТЗ требует причину и владельца для любого `skip`. Владелец всех пунктов —
`svladimirtsk-crypto` (владелец продукта); исполнитель — Arena Agent.

**Unit (vitest): 53 skipped теста в 4 файлах.** Причина общая — нужна реальная
PostgreSQL, схема накатывается `drizzle-kit push`.

| Файл | Тестов | Причина пропуска | Выполняются ли в CI |
|---|---|---|---|
| `tests/lead-route-db.test.ts:73` | 15 | `describe.skipIf(!TEST_DATABASE_URL)` — N-001, `POST /api/lead` с реальной БД | **Да**, всегда: job `static` поднимает `postgres:17-alpine` и задаёт `TEST_DATABASE_URL` |
| `tests/availability-db.test.ts:46` | 10 | то же — PT-016, календарь замеров в PostgreSQL | Да |
| `tests/delivery-alert-db.test.ts:58` | 9 | то же — PT-015, алерт о сбоях доставки | Да |
| `tests/lead-delivery-integration-db.test.ts:123` | 19 | то же — PT-020, доставка на реальной БД и фейковом HTTP-сервере | Да |

Локально включаются одной переменной:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/potolkovo_test npm test
```

Пропуск здесь — не «плавающий» результат: в CI тесты выполняются на каждом пуше,
а локальное отсутствие БД — осознанная деградация (иначе unit-прогон требовал бы
поднятой PostgreSQL у каждого, кто правит текст на странице). Страховка от
тихого пропуска — комментарий N-001 в `ci.yml`: без реальной БД интеграционные
тесты хранилища молча пропускаются, и регрессия в `PgLeadStore` доехала бы до
прода незамеченной.

**E2E (Playwright): 12 skipped из 192.** Причина общая — два проекта раскладки
(`chromium-desktop` 1280×900 и `chromium-mobile` 390×844), а сценарий существует
только для одной из них. Пропуск ставится через `test.skip(условие, причина)` и
виден в выводе прогона вместе с текстом причины.

| Место | Тестов | В каком проекте пропускается | Причина |
|---|---|---|---|
| `e2e/track-sale.spec.ts:12` | 2 | desktop | бар корзины на странице света существует только под sm-брейкпоинтом (T-091) |
| `e2e/track-sale.spec.ts:56` | 1 | desktop | то же: состав заявки собирается с мобильного бара |
| `e2e/funnel-modern.spec.ts:36` | 2 | mobile | сценарий завязан на desktop-раскладку |
| `e2e/lighting-first.spec.ts:14` | 1 | mobile | desktop-раскладка |
| `e2e/draft-restore.spec.ts:223` | 1 | mobile | нужна desktop-раскладка каталога |
| `e2e/entry-context.spec.ts:175` | 1 | desktop | мобильный стики — `lg:hidden` |
| `e2e/entry-context.spec.ts:233` | 1 | desktop | то же |
| `e2e/modal-layout.spec.ts:34` | 1 | desktop | только мобильный проект |
| `e2e/modal-layout.spec.ts:51` | 1 | mobile | только desktop-проект |
| `e2e/modal-layout.spec.ts:78` | 1 | desktop | только мобильный проект |
| **Итого** | **12** | | совпадает с `12 skipped` в прогоне |

Ни один из этих пропусков не скрывает непроверенное поведение: сценарий
выполняется в том проекте, где раскладка существует. Правило на будущее — новый
`test.skip` в E2E обязан иметь текстовую причину вторым аргументом и строку в
этой таблице.

**Повторные попытки (`retries: 1` в CI).** Сами по себе они больше не являются
«зелёным молчанием»: любой тест, прошедший со второй попытки, попадает в отчёт
как `flaky`, и `npm run check:e2e-flaky` печатает его имя. На `main`,
`quizv2ver1` и в PR, идущих в эти ветки, это падение job. Если флак оказывается
осознанным (например, известный сетевой ретрай внешнего сервиса), он
документируется здесь же — с причиной и владельцем — а не оставляется в
повторах молча.

**Других пропусков нет:** `test.only`/`describe.only` запрещены в CI
(`forbidOnly`), `.skip`/`.todo`/`fixme` в `tests/` и `e2e/` не используются,
кроме перечисленных выше.

## Доставка под настоящим HTTP и атомарный claim (PT-020)

ТЗ v5, раздел 4 (Фаза 5); задача `PT-020` (источники `A-13` (PDF, `F-14`), `T-326`).

### Зачем

CI и до этой задачи поднимал `postgres:17-alpine`, но БД использовалась только
для `PgLeadStore`. Каналы доставки во всех тестах были заглушены через
`vi.mock("@/lib/lead/deliver-telegram")`, поэтому их HTTP-слой не проверялся
ничем: ни 429, ни обрыв соединения, ни контракт Web3Forms «HTTP 200, но
`success: false` — это провал», ни поведение при выключенном канале.

### Фейковый сервер доставки

`tests/helpers/fake-delivery.ts` — настоящий `node:http` на `127.0.0.1` плюс
перехват `globalThis.fetch`. URL в каналах захардкожены
(`https://api.telegram.org/bot<token>/sendMessage`,
`https://api.web3forms.com/submit`), поэтому подменить их можно только на
уровне `fetch` — прод-код ради тестов не менялся.

Перехват строгий: любой внешний хост вне списка бросает исключение
`внешний вызов в тесте запрещён (правило 7 раздела 2 ТЗ)`. То есть запрет
реальных отправок обеспечен технически, а не дисциплиной: новый внешний вызов
в коде доставки уронит тест, а не уйдёт в боевой сервис.

Программируется статус, тело (JSON или мусор), задержка, обрыв соединения,
«не отвечать вовсе» и последовательность ответов — «упасть дважды, потом
ожить».

### Что покрыто

| Файл | Тестов | Что проверяет |
|---|---|---|
| `tests/lead-delivery-channels.test.ts` | 16 | HTTP-слой каналов: состав тела запроса, 429/500, тело не-JSON, обрыв сокета, медленный ответ, `TELEGRAM_LEADS_ENABLED=0`, отсутствие конфигурации (ни одного запроса), запрет внешнего хоста |
| `tests/lead-delivery-integration-db.test.ts` | 19 | настоящая БД + фейковый HTTP: транзакционность аутбокса (включая откат заявки при сбое вставки задания), идемпотентность насквозь, крон ретрая, недоступные каналы, гонки, флаг отката |

Отдельно зафиксировано поведение, которое решением не является, но теперь
видимое: Telegram-канал смотрит только на `response.ok`, поэтому HTTP 200 с
телом `{ok:false}` считается успехом. На практике Telegram при ошибке отвечает
4xx, так что случай гипотетический — но менять это поведение теперь можно
только вместе с тестом.

### Найденный дефект: дубль отправки

Тест гонок воспроизвёл его детерминированно, в двух независимых сценариях:

1. **Два параллельных прогона крона.** `listPendingDeliveries` и
   `listFailedDeliveries` — обычные `SELECT` без резервирования строк, поэтому
   оба прогона забирали одно и то же задание: `fake.count("telegram")` = **2
   вместо 1**. Клиент получил бы два одинаковых сообщения.
2. **Приём заявки и крон одновременно.** `/api/lead` создаёт задания в статусе
   `pending` и отправляет их фоном, не дожидаясь ответа клиенту; крон в это окно
   видит те же строки. Результат тот же — 2 отправки.

ТЗ, строка 124 (PT-003), предписывает это закрыть: «Добавить уникальный индекс
`(lead_id, channel)` и атомарный `claim` (`FOR UPDATE SKIP LOCKED` или
`UPDATE ... WHERE status='pending' AND (lease_until IS NULL OR lease_until <
now()) RETURNING`)». Проверка БД (`\d lead_deliveries`) показала, что ни
индекса, ни колонки аренды не было — из PT-003 была реализована транзакция, но
не claim.

### Решение

- **Схема.** Колонка `lead_deliveries.lease_until` (nullable — фаза `expand`,
  раздел 3.8: у существующих строк значения нет, что читается как «свободна») и
  `uniqueIndex lead_deliveries_lead_channel_key (lead_id, channel)`.
- **`PgLeadStore.claimDeliveries(limit, maxAttempts)`** — один запрос:
  `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) ... RETURNING`.
  Порядок прежний: сначала ни разу не отправленные `pending`, потом `failed`.
- **`createLeadWithDeliveries`** создаёт задания уже арендованными: это закрывает
  окно «приём заявки ↔ крон».
- **`recordDelivery`** освобождает аренду по итогам попытки, поэтому упавшее
  задание не ждёт истечения срока и следующий прогон крона его берет сразу.
- **Смерть процесса** задание не теряет: аренда `DELIVERY_LEASE_MS` = 120 с
  истекает сама, отдельного статуса `processing` и его расчистки не появилось.
- **`InMemoryLeadStore`** повторяет контракт (иначе дефект боевой БД остался бы
  невидимым для тестов, которые гоняются на in-memory). Добавлен
  `releaseLeasesForTests()`: в бою аренду снимают `recordDelivery` и истечение
  срока, тестам ждать две минуты незачем.

### Миграция БД — применить ДО деплоя

Новый код пишет в `lease_until` при каждой заявке, поэтому на старой схеме
приём заявок упадёт с `column "lease_until" does not exist`. Порядок: проверка
прод-БД на дубли `(lead_id, channel)` → `drizzle-kit push` → мерж в `main` и
пересборка. Пошагово — раздел 15 файла `OWNER-TODO-2026-09-15.md`. Сама колонка
обратно совместима: старый код её не читает, поэтому применить схему заранее
безопасно.

В CI шаг «Применить схему БД» (`drizzle-kit push --force`) уже есть и выполняется
до `npm run test`, поэтому новые тесты в CI идут на настоящей БД.

### Gate (раздел 6 ТЗ) — точный вывод

```
$ npm run ci:all                → EXIT=0   (lint → tsc → test → test:flow →
                                            validate:catalog → build →
                                            check:bundle → test:e2e →
                                            check:e2e-flaky)
$ npm run lint                  → ✖ 18 problems (0 errors, 18 warnings)   ← все предсуществующие
$ npx tsc --noEmit              → 0 ошибок
$ npm run test                  → Test Files 88 passed (88); Tests 1119 passed (1119)
$ npm run test:flow             → # tests 8 / # pass 8 / # fail 0
$ npm run validate:catalog      → validate-catalog: ok (48 SKU, 7 профилей)
$ node scripts/check-file-size.mjs
                                → [file-size] ok — проверено 131 файлов, лимит 600 строк, 2 legacy-исключения
$ node scripts/check-effect-setstate.mjs
                                → [effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору
$ npm run build                 → ✓ Compiled successfully in 3.2s; 19/19 статических страниц
$ npm run check:bundle          → [bundle] ok — / 225.7 КБ ≤ 300 КБ (не изменился: код серверный)
$ npm run test:e2e              → 180 passed (7.3m)
$ npm run check:e2e-flaky       → [e2e-flaky] всего: 180 passed, 0 failed, 0 flaky, 12 skipped
                                  [e2e-flaky] ok — повторных попыток не потребовалось
$ npm run check:env             → [env] ok — 27 переменных документированы
$ TEST_DATABASE_URL=… npx vitest run (без БД, как в локальной разработке)
                                → Test Files 84 passed | 4 skipped (88); Tests 1054 passed | 53 skipped (1107)
```

Было: 86 файлов / 1084 теста (с БД). Стало: **88 / 1119** (+2 файла, +35 тестов). E2E — 180
passed, как и до задачи: изменений в UI нет.

Реестр пропусков выше обновлё: 34 → **53** skipped локально без БД (добавился
файл `tests/lead-delivery-integration-db.test.ts`, 19 тестов; в CI выполняются).

### Ограничения

- Реальные Telegram и Web3Forms не вызывались нигде — ни в тестах, ни при
  подготовке задачи (правило 7 раздела 2 ТЗ). Прод не проверялся: `curl`
  боевого сайта не выполнялся, прод-БД не открывалась (доступа нет) — проверка
  дублей `(lead_id, channel)` на проде **не выполнена**, это шаг владельца.
- `InMemoryLeadStore` повторяет контракт `claim`, но не повторяет транзакцию и
  уникальный индекс `(lead_id, channel)`: в памяти их нет. Расхождение
  осознанное — in-memory реализация нужна для локальной разработки, а не для
  гарантий целостности.
- Аренда 120 с означает: если процесс умер сразу после приёма заявки, крон
  подберёт задание не мгновенно, а после истечения аренды. При рекомендованном
  интервале крона (15 мин, README; ТЗ предлагает 1 мин) это незаметно.
- Safari и Firefox не проверялись: изменений в клиентском коде нет.

### Откат

`LEAD_OUTBOX_CLAIM_ENABLED=0` — без деплоя: крон снова читает задания двумя
`SELECT`, аренда не проставляется. Поведение до PT-020 возвращается целиком,
вместе с дефектом дубля — это зафиксировано отдельным тестом («флаг отката …
возвращает прежнее поведение»), чтобы выключатель нельзя было сломать молча.

Колонка `lease_until` и уникальный индекс при этом остаются в схеме: старому
коду они не мешают. `git revert` убирает код; при желании убрать и схему:
`ALTER TABLE lead_deliveries DROP CONSTRAINT IF EXISTS lead_deliveries_lead_channel_key;
DROP INDEX IF EXISTS lead_deliveries_lead_channel_key; ALTER TABLE lead_deliveries
DROP COLUMN IF EXISTS lease_until;`
