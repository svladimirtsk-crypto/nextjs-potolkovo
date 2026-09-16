# PT-020 — интеграционные тесты с реальной БД и фейковым delivery-сервером

- **ТЗ:** `POTOLKOVO-TZ-V5-FINAL.md`, раздел 4 (Фаза 5), строка ~194. Источники: `A-13` (PDF, `F-14`), `T-326`.
- **Ветка:** `quizv2ver1-fix/p5-pt020` (от `origin/quizv2ver1` = `9838e46`).
- **Коммиты:** `a08ddff` (фейковый сервер + тесты каналов), `1aee183` (интеграционные тесты + атомарный claim), `2534d2f` (документация), `+` этот отчёт.
- **Итог:** 14 файлов, `+1532 / −7`. Тестов: **1084 → 1119** (+35), файлов vitest: 86 → 88. `npm run ci:all` → **EXIT=0**.
- **Побочный, но главный результат:** найден и закрыт реальный дефект денежного пути — **дубль отправки заявки** при параллельных прогонах крона. Решение согласовано с владельцем (вариант A: реализовать `claim` по строке 124 ТЗ в рамках этой задачи).

---

## 1. Что сделано и почему

### 1.1 Фейковый delivery-сервер (`tests/helpers/fake-delivery.ts`, 241 строка)

ТЗ требует: «Telegram/Web3Forms — только фейковый HTTP-сервер в тестах, реальные вызовы запрещены правилом 7 раздела 2». URL в каналах захардкожены:

```
lib/lead/deliver-telegram.ts:25    fetch(`https://api.telegram.org/bot${token}/sendMessage`, …)
lib/lead/deliver-web3forms.ts:18   fetch("https://api.web3forms.com/submit", …)
```

Поэтому подмена возможна только на уровне `globalThis.fetch` — **прод-код ради тестов не менялся**. Сервер настоящий (`node:http`, слушает `127.0.0.1:<случайный порт>`), перехват переписывает на него запросы к двум хостам, а **любой другой внешний хост бросает исключение**:

```
PT-020: внешний вызов в тесте запрещён (правило 7 раздела 2 ТЗ): https://example.com/anything.
Хост нужно добавить в INTERCEPTED_HOSTS фейкового сервера доставки.
```

То есть запрет реальных отправок обеспечен технически, а не дисциплиной: новый внешний вызов в коде доставки уронит тест, а не уйдёт в боевой сервис. Проверяется отдельным тестом, в том числе на похожем хосте `api.telegram.org.evil.test`.

Программируется: статус, тело (JSON или произвольный мусор), задержка, обрыв соединения без ответа, «не отвечать вовсе» и последовательность ответов («упасть дважды, потом ожить»). Канал определяется по пути (`/submit` → web3forms, токен в `/bot<token>/sendMessage` → telegram или alert), а не по заголовку `Host`: `host` входит в список запрещённых заголовков fetch и после переписывания URL до сервера не доехал бы.

### 1.2 Тесты HTTP-слоя каналов (`tests/lead-delivery-channels.test.ts`, 16 тестов)

До этой задачи `deliverToTelegram` / `deliverToWeb3Forms` не были проверены **ни одним тестом**: везде они заглушены через `vi.mock`, а заглушка отвечает «успехом» и не умеет ни 429, ни обрыва соединения. Покрыто:

| Группа | Что проверяется |
|---|---|
| Telegram | состав тела (`chat_id`, `text` с телефоном/именем/кодом заявки, `parse_mode: HTML`), `TELEGRAM_LEADS_ENABLED=0` → ни одного запроса, отсутствие токена/`chat_id` → ни одного запроса, 429, 500, обрыв сокета, медленный ответ (120 мс) |
| Web3Forms | состав тела (`access_key`, `from_name`, `phone`, `subject`, `message`), **HTTP 200 без `success:true` — провал**, 200 с телом не-JSON — провал, 500, обрыв сокета, отсутствие ключа → ни одного запроса |
| Изоляция | внешний хост запрещён; запрос к `api.telegram.org` физически уходит на `127.0.0.1` |

Отдельно зафиксировано поведение, которое решением не является, но теперь видимое: **Telegram-канал смотрит только на `response.ok`**, поэтому HTTP 200 с телом `{ok:false}` считается успехом. На практике Telegram при ошибке отвечает 4xx, случай гипотетический; менять поведение теперь можно только вместе с тестом.

### 1.3 Интеграционные тесты с реальной БД (`tests/lead-delivery-integration-db.test.ts`, 19 тестов)

Файл добавлен в `DB_TESTS` (`vitest.config.ts`) — он чистит те же таблицы (`leads`, `lead_deliveries`, `delivery_alerts`), что остальные БД-тесты, и обязан идти в последовательном проекте `db` с `fileParallelism: false`. Иначе в CI повторилась бы уже описанная там гонка (параллельный работник удаляет строки посреди чужого теста).

| Группа | Тестов | Что проверяется |
|---|---|---|
| Транзакционность аутбокса (PT-003) | 4 | заявка и задания появляются вместе и видны отдельным запросом; **сбой вставки задания откатывает и заявку**; заявка без каналов сохраняется без заданий; уникальный индекс `(lead_id, channel)` существует в БД и не даёт завести второе задание |
| Идемпотентность (PT-009) насквозь | 3 | повтор с тем же `requestId` → 200 и **ровно одно сообщение во внешний канал**; два параллельных запроса с одним `requestId` → `[200, 201]`, один код, одна заявка, одна отправка; тот же `requestId` с другим содержимым → 409 и никакой отправки |
| Крон ретрая | 4 | доводит `pending` до `sent` (`attempts=1`, `sentAt`, аренда снята); сбой канала → `failed` с текстом ошибки, следующий прогон восстанавливает (`attempts=2`, ровно 2 запроса к каналу); `attempts>=5` крон не трогает; неверный `CRON_SECRET` → 401 и ни одного запроса |
| Недоступные каналы при приёме | 2 | 503 от обоих каналов → заявка сохранена (201), оба задания `failed` с текстом ошибки; обрыв соединения → то же |
| `claim`: аренда и гонки | 5 | арендованное задание крон не забирает; два параллельных `claim` не отдают одно задание дважды; строка без `lease_until` (наследие фазы expand) считается свободной; **два параллельных прогона крона — одна отправка**; **приём заявки и крон одновременно — одна отправка**; флаг отката возвращает прежнее поведение |

Проверка отката — отдельный тест, а не комментарий: с `LEAD_OUTBOX_CLAIM_ENABLED=0` крон снова читает задания двумя `SELECT` и снова отправляет дубль (`fake.count("telegram") === 2`). Выключатель нельзя сломать молча.

---

## 2. Найденный дефект: дубль отправки заявки

### 2.1 Факт до правки (точный вывод)

```
$ TEST_DATABASE_URL=… npx vitest run tests/lead-delivery-integration-db.test.ts
 × два параллельных прогона крона не отправляют одно задание дважды
 × приём заявки и крон, запущенные одновременно, не отправляют задание дважды
AssertionError: expected 2 to be 1 // Object.is equality
AssertionError: expected 2 to be 1 // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 12 passed (14)
```

Воспроизводится **детерминированно**, в двух независимых сценариях:

1. **Два параллельных прогона крона.** `listPendingDeliveries` / `listFailedDeliveries` — обычные `SELECT` без резервирования, `recordDelivery` — select-then-update. Оба прогона забирают одну строку → клиент получает два одинаковых сообщения в Telegram (и два письма через Web3Forms).
2. **Приём заявки и крон одновременно.** `/api/lead` создаёт задания в статусе `pending` и отправляет их фоном (`void deliverAll(...)`, строка 381), не дожидаясь ответа клиенту. Крон в это окно видит те же строки.

### 2.2 Это не «новая хотелка», а невыполненное предписание ТЗ

`POTOLKOVO-TZ-V5-FINAL.md`, строка 124 (разбор PT-003):

> Добавить уникальный индекс `(lead_id, channel)` и атомарный `claim` (`FOR UPDATE SKIP LOCKED` или `UPDATE ... WHERE status='pending' AND (lease_until IS NULL OR lease_until < now()) RETURNING`).

Проверка фактического состояния БД (локальная PostgreSQL 17.11, схема после `drizzle-kit push` ветки `quizv2ver1`):

```
$ psql -c "\d lead_deliveries"
Indexes:
    "lead_deliveries_pkey" PRIMARY KEY, btree (id)
    "lead_deliveries_status_idx" btree (status, created_at)
```

Ни уникального индекса `(lead_id, channel)`, ни колонки аренды. Из PT-003 была реализована транзакция «лид + задания», но не `claim`.

### 2.3 Решение (вариант A, согласован владельцем)

| Слой | Изменение |
|---|---|
| `db/schema.ts` | колонка `lease_until` (nullable — фаза `expand`, раздел 3.8: backfill не нужен, отсутствие значения читается как «свободна») и `uniqueIndex("lead_deliveries_lead_channel_key").on(leadId, channel)` |
| `lib/lead/store-pg.ts` | `claimDeliveries(limit, maxAttempts)` — один запрос `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) … RETURNING`; порядок прежний (сначала `pending`, потом `failed`). `createLeadWithDeliveries` создаёт задания уже арендованными (закрывает окно «приём ↔ крон»). `recordDelivery` освобождает аренду по итогам попытки |
| `app/api/lead/retry/route.ts` | крон берёт задания через `claim`; при `LEAD_OUTBOX_CLAIM_ENABLED=0` — прежние два `SELECT` |
| `lib/lead/store.ts` | `InMemoryLeadStore` повторяет контракт `claim` + `releaseLeasesForTests()` |
| `lib/env.ts` | `LEAD_OUTBOX_CLAIM_ENABLED` (дефолт `1`) — флаг отката, правило 8 раздела 2 |

Почему так, а не иначе:

- **Один `UPDATE`, а не «select потом update»** — между двумя запросами строку успевает забрать кто угодно; именно так дефект и возникал.
- **Аренда, а не статус `processing`** — не появилось состояния, которое нужно расчищать: смерть процесса посреди отправки не вешает задание навсегда, аренда `DELIVERY_LEASE_MS = 120 с` истекает сама.
- **`recordDelivery` обнуляет аренду** — упавшее задание не ждёт истечения срока, следующий прогон крона берёт его сразу (проверено тестом: `attempts=2`, ровно 2 запроса к каналу).
- **Аренда при создании** — единственное, что закрывает второй сценарий гонки (приём + крон): advisory lock на крон здесь не помог бы.

После правки:

```
$ psql -c "\d lead_deliveries"
 lease_until     | timestamp with time zone |           |          |
Indexes:
    "lead_deliveries_pkey" PRIMARY KEY, btree (id)
    "lead_deliveries_lead_channel_key" UNIQUE, btree (lead_id, channel)
    "lead_deliveries_status_idx" btree (status, created_at)

$ TEST_DATABASE_URL=… npx vitest run tests/lead-delivery-integration-db.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)
```

### 2.4 Регрессия, которую правка задела, и как закрыта

Полный прогон показал 2 падения в `tests/delivery-alert.test.ts` (PT-015, in-memory): тесты моделировали «заявка принята, доставка не удалась» через `createLeadWithDeliveries` и ждали, что крон её подберёт. С арендой крон честно проходил мимо (`retried: 0` вместо `4`). Это не ошибка тестов и не ошибка кода: аренда теперь есть и в in-memory реализации, иначе дефект боевой БД остался бы для тестов невидимым. В оба теста добавлен `target.releaseLeasesForTests()` с комментарием, что сценарий — «процесс умер до отправки».

---

## 3. Файлы

```
 .env.example                               |   9 +
 README.md                                  | 158 +++++++-
 app/api/lead/retry/route.ts                |  28 +-
 db/schema.ts                               |  30 +-
 lib/env.ts                                 |  14 +
 lib/lead/store-pg.ts                       |  76 +++-
 lib/lead/store-types.ts                    |  29 ++
 lib/lead/store.ts                          |  52 +++
 scripts/check-env.mjs                      |   1 +
 tests/delivery-alert.test.ts               |   8 +
 tests/helpers/fake-delivery.ts             | 241 ++++++++++++
 tests/lead-delivery-channels.test.ts       | 318 ++++++++++++++++
 tests/lead-delivery-integration-db.test.ts | 572 +++++++++++++++++++++++++++++
 vitest.config.ts                           |   3 +
 14 files changed, 1532 insertions(+), 7 deletions(-)
```

Прод-код затронут только в части доставки/аутбокса: `db/schema.ts`, `lib/env.ts`, `lib/lead/store-types.ts`, `lib/lead/store-pg.ts`, `lib/lead/store.ts`, `app/api/lead/retry/route.ts`. Клиентский код не менялся. `content/*.ts` не тронуты (правило 0.4).

`data/page-dates.json` намеренно не коммитится: перегенерируется в `prebuild` (`build-page-dates.mjs`) на каждой сборке.

---

## 4. Тесты и точный вывод команд

### 4.1 Локальное окружение

PostgreSQL 17.11 (Debian), кластер `17 main`, БД `potolkovo_test`, схема накатана `npx drizzle-kit push --force`. Прогоны — с `TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/potolkovo_test` и `CRON_SECRET=ci-test-secret` (в CI обе переменные заданы на уровне job `static`).

### 4.2 Проверка мутациями (тесты каналов)

Тесты, которые «прошли с первого раза», проверены на то, что они вообще что-то ловят:

```
# мутация A: в deliver-web3forms.ts убрана проверка тела
-   if (!response.ok || !result?.success) {
+   if (!response.ok) {
# мутация B: в deliver-telegram.ts обойдён рубильник
-   if (!env.TELEGRAM_LEADS_ENABLED) {
+   if (false) {

$ npx vitest run tests/lead-delivery-channels.test.ts
 × при TELEGRAM_LEADS_ENABLED=0 не делает ни одного запроса
 × HTTP 200 без success:true — это провал (главный контракт канала)
 × 200 с телом не-JSON — провал, а не исключение
      Tests  3 failed | 13 passed (16)
```

Обе мутации откачены, `git diff --stat` после отката пуст.

### 4.3 Единый pipeline (раздел 6 ТЗ)

```
$ TEST_DATABASE_URL=… CRON_SECRET=ci-test-secret npm run ci:all
> npm run lint && npx tsc --noEmit && npm run test && npm run test:flow && npm run validate:catalog
    && npm run build && npm run check:bundle && npm run test:e2e && npm run check:e2e-flaky

✖ 18 problems (0 errors, 18 warnings)                    ← lint, все предупреждения предсуществующие
                                                           (по изменённым файлам: 0 ошибок, 0 предупреждений)
npx tsc --noEmit                        → 0 ошибок
npm run test                            → Test Files 88 passed (88)
                                            Tests  1119 passed (1119)      Duration 27.88s
npm run test:flow                       → # tests 8 / # pass 8 / # fail 0
npm run validate:catalog                → validate-catalog: ok (48 SKU, 7 профилей)
node scripts/check-file-size.mjs        → [file-size] ok — проверено 131 файлов, лимит 600 строк, 2 legacy-исключения
node scripts/check-effect-setstate.mjs  → [effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору
npm run build                           → ✓ Compiled successfully in 3.2s
                                          ✓ Generating static pages using 1 worker (19/19) in 1161ms
npm run check:bundle                    → [bundle] ok — / 225.7 КБ ≤ 300 КБ   (не изменился: код серверный)
npm run test:e2e                        → 180 passed (7.3m)
npm run check:e2e-flaky                 → [e2e-flaky] всего: 180 passed, 0 failed, 0 flaky, 12 skipped
                                          [e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный
EXIT=0
```

Дополнительно, вне `ci:all`:

```
$ npm run check:env   → [env] ok — 27 переменных документированы      (было 26; добавлена LEAD_OUTBOX_CLAIM_ENABLED)
$ npm run check:env   → строгий режим как в CI (RELEASE=1 и согласованный набор переменных) — тоже ok, EXIT=0
```

### 4.4 Прогон без БД (как в локальной разработке)

```
$ npx vitest run            # TEST_DATABASE_URL не задан
 Test Files  84 passed | 4 skipped (88)
      Tests  1054 passed | 53 skipped (1107)
```

Реестр пропусков в `README.md` обновлён: 34 → **53** (15 `lead-route-db` + 10 `availability-db` + 9 `delivery-alert-db` + **19 `lead-delivery-integration-db`**). Все — `describe.skipIf(!TEST_DATABASE_URL)`, в CI выполняются на каждом пуше.

Было 86 файлов / 1084 теста (с БД), стало **88 / 1119** (+35).

### 4.5 Стабильность (три прогона подряд)

Тесты гонок обязаны быть детерминированными, иначе они ничего не доказывают:

```
$ for i in 1 2 3; do TEST_DATABASE_URL=… npx vitest run \
    tests/lead-delivery-integration-db.test.ts tests/lead-delivery-channels.test.ts; done
прогон 1:       Tests  35 passed (35)
прогон 2:       Tests  35 passed (35)
прогон 3:       Tests  35 passed (35)


---

## 5. Что нужно от владельца (до деплоя)

Порядок критичен: новый код пишет в `lease_until` при каждой заявке, поэтому на старой схеме приём заявок упадёт с `column "lease_until" does not exist`.

1. Проверить прод-БД на дубли `(lead_id, channel)` — SQL в разделе 15 `OWNER-TODO-2026-09-15.md`. Ожидаемо 0 строк; если есть — push не запускать, прислать вывод.
2. `DATABASE_URL="<прод>" npx drizzle-kit push`.
3. Проверить, что колонка и уникальный индекс появились (SQL там же).
4. Переменные окружения задавать не нужно (`LEAD_OUTBOX_CLAIM_ENABLED` по умолчанию `1`).
5. Только после этого — мерж `quizv2ver1 → main` и пересборка контейнера Amvera.
6. Глазами: тестовая заявка → **одно** сообщение в Telegram; два ручных вызова крона подряд → второй `retried: 0`.

Всё это продублировано в разделе «Миграция БД» нового раздела README и в разделе 15 `OWNER-TODO-2026-09-15.md` (+ пункт 6б чек-листа).

---

## 6. Ограничения и непроверенное

- **Реальные Telegram и Web3Forms не вызывались нигде** — ни в тестах, ни при подготовке задачи (правило 7 раздела 2 ТЗ). Перехват `fetch` это обеспечивает технически.
- **Прод не проверялся.** `curl` боевого сайта не выполнялся, прод-БД не открывалась (доступа нет) — проверка дублей `(lead_id, channel)` на проде **не выполнена**, это шаг владельца (раздел 5).
- `InMemoryLeadStore` повторяет контракт `claim`, но не повторяет транзакцию и уникальный индекс `(lead_id, channel)` — в памяти их нет. Расхождение осознанное: in-memory нужен для локальной разработки, а не для гарантий целостности.
- Аренда 120 с: если процесс умер сразу после приёма заявки, крон подберёт задание не мгновенно, а после истечения аренды. При интервале крона 15 мин (README) или 1 мин (рекомендация ТЗ) это незаметно.
- Safari и Firefox не проверялись: изменений в клиентском коде нет. E2E — Chromium (desktop и mobile), 180 passed.
- Нагрузка/производительность `claim` не измерялись: batch крона — 20 строк, один `UPDATE` с подзапросом; индексы `status_idx` и новый уникальный это покрывают, но стенда с объёмом прод-БД в песочнице нет.
- Остаточные 18 предупреждений ESLint — предсуществующие, в других файлах; по изменённым файлам 0 ошибок и 0 предупреждений.

---

## 7. Откат

- **Без деплоя:** `LEAD_OUTBOX_CLAIM_ENABLED=0` — крон снова читает задания двумя `SELECT`, аренда не проставляется. Возвращается поведение до PT-020 вместе с дефектом дубля (зафиксировано тестом).
- **Код:** `git revert a08ddff 1aee183 2534d2f`. Тестовые файлы можно оставить — они не трогают прод-код, кроме одного: при откате `1aee183` тесты гонок снова станут красными (это ожидаемо и есть индикатор возврата дефекта).
- **Схема:** колонка и индекс обратно совместимы со старым кодом, удалять их не обязательно. При желании:

```sql
DROP INDEX IF EXISTS lead_deliveries_lead_channel_key;
ALTER TABLE lead_deliveries DROP COLUMN IF EXISTS lease_until;
```

---

## 8. CI на ветке задачи (фактический прогон)

`PR #41` → `quizv2ver1`, head `f1d53e8`. Все 5 проверок зелёные:

```
Lint · types · unit          completed  success
Build · bundle budget        completed  success
E2E (Playwright)             completed  success
Секреты (gitleaks)           completed  success
Vercel Preview Comments      completed  success
```

Шаги job `Lint · types · unit` (все `success`): `npm ci` → `ESLint` → `TypeScript`
→ **`Применить схему БД`** → `Unit-тесты (vitest)` → `Поток калькулятора (test:flow)`
→ `Окружение и реквизиты` → `Каталог` → `Календарь замеров`.

Выдержка из лога этой job — видно, что схема с новой колонкой и индексом в CI
накатилась, а оба новых файла выполнились (а не пропустились):

```
[✓] Changes applied
 ✓  unit  tests/lead-delivery-channels.test.ts (16 tests) 270ms
 ✓  db  tests/lead-delivery-integration-db.test.ts (19 tests) 1407ms
 Test Files  88 passed (88)
      Tests  1119 passed (1119)
# pass 8
[env] ok — 27 переменных документированы
```

Лог сервиса `postgres:17-alpine` в той же job содержит ожидаемую ошибку из теста
уникального индекса — прямое подтверждение, что индекс в CI создан:

```
ERROR:  duplicate key value violates unique constraint "lead_deliveries_lead_channel_key"
STATEMENT:  insert into "lead_deliveries" ("id", "lead_id", "channel", "status", "attempts", …
```

Job `E2E (Playwright)`: шаги `Восстановить сборку` → `Распаковать сборку` →
`Установить браузеры` → `Playwright` → **`Плавающие E2E-тесты`** → `Отчёт при
падении` (`skipped` — не понадобился). Фактический вывод:

```
180 passed (6.2m)
[e2e-flaky] всего: 180 passed, 0 failed, 0 flaky, 12 skipped
[e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный
```

Вывод: интеграционные тесты PT-020 в CI выполняются на каждом пуше — то, ради
чего ТЗ требует использовать уже поднимаемый `postgres:17-alpine`, а не только
unit-тесты `PgLeadStore`.
