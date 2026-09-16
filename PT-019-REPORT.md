# PT-019 — обязательные CI-гейты без «плавающих» результатов

**ТЗ:** `POTOLKOVO-TZ-V5-FINAL.md`, строка 192 (Фаза 5, «тестовая защита и техдолг»).
**Источники:** `A-12` · `T-325`.
**Ветка:** `quizv2ver1-fix/p5-pt019` (из `origin/quizv2ver1` = `649bd33`, мерж `PR #37`).
**Коммиты:** `189a36e` (test:flow), `7db204b` (CI + гейт на флаки), `26117c7` (реестр в README), + отчёт.
**Статус:** выполнено. Одно утверждение ТЗ оказалось устаревшим — см. раздел 2.

---

## 1. Требование ТЗ

> `npm run test:flow` (`scripts/test-calculator-flow.mjs`) падает на
> `resolveStep0ConfirmLabel is not a function` (зафиксировано независимо в обоих
> документах-предшественниках). Обновить контракт под актуальный код или заменить
> эквивалентной проверкой; включить в единый обязательный pipeline
> (`lint && tsc --noEmit && test && test:flow && validate:catalog && build &&
> check:bundle && test:e2e`), задокументировать причину и владельца для любого `skip`.

Три части: (а) починить `test:flow`, (б) включить его в единый обязательный pipeline,
(в) задокументировать причину и владельца для любого пропуска. Плюс название задачи —
«без плавающих результатов».

---

## 2. Что оказалось на самом деле (проверено на HEAD, а не по памяти)

**(а) Премиза устарела — `test:flow` проходит.**

```
$ npm run test:flow
# tests 8        ← было 5 до этой задачи
# pass 8
# fail 0
```

Функции `resolveStep0ConfirmLabel` в `lib/calculator-flow.ts` **никогда не было**;
блок с её вызовом удалён раньше, в `134c90b` («Шаг 0: одна подпись кнопки вместо
трёх расходящихся источников»), а в скрипте остался комментарий с разбором
(`scripts/test-calculator-flow.mjs:128-134`). Подписи кнопок Шага 0 живут в
`getParamConfirmLabel` (`lib/step0-fsm.ts`) и проверяются `tests/step0-fsm.test.ts`.

**(б) Настоящая дыра — гейт не запускался в CI вообще.**
До этой задачи `npm run test:flow` не вызывался ни в одном job `.github/workflows/ci.yml`,
ни в `lefthook.yml`. Контракт маршрутизации Шага 0, режимов скидки света и начальных
опций модалки проверялся только локально — именно поэтому сломанный вызов и прожил
в скрипте так долго. **Сломанный гейт и незапущенный гейт выглядят одинаково:
зелёный CI.**

**(в) «Плавающие» результаты маскировались настройкой `retries: 1`.**
Повторная попытка в CI спасает от сетевых флаков, но заодно прячет настоящие:
тест падал, повторялся, проходил, job зеленел, и узнать о флаке было нельзя.

**(г) Дыра в самом `test:flow`:** харнесс проверял 5 из 7 экспортов
`calculator-flow.ts`. Непокрытыми были `resolveStep2Copy` (копирайт Шага 2 — текст
шага заявки) и `fillCallbackWindow` (подстановка окна перезвона, которое приходит
с сервера в ответе `/api/lead`).

---

## 3. Что сделано

### 3.1. `test:flow` закрывает все экспорты контракта (`189a36e`)

`scripts/test-calculator-flow.mjs`: 5 тестов → 8.

- **Копирайт Шага 2 определён для всех пяти интентов** (`ceiling_only`,
  `lighting_with_ceiling`, `lighting_only`, `advanced`, `direct`): непустая подпись
  кнопки, чипы, флаг `showFulfilment` и **ровно один** placeholder `{callbackWindow}`
  в блоке «Что дальше».
- **Смысловые различия:** «только свет» спрашивает способ получения
  (`showFulfilment: true`); потолок и «потолок + свет» дают одну форму; `direct` не
  дублирует заголовок секции страницы (пустые `formTitle`/`formSubtitle`);
  незнакомый интент (мог прийти из старого черновика) откатывается к форме потолка,
  а не к `undefined`.
- **`fillCallbackWindow`:** подстановка окна; честное «в ближайшее время» при пустом
  или пробельном значении (иначе клиент увидел бы «Перезвоню » с дырой); входной
  массив не мутируется (шаги переиспользуются между рендерами); placeholder не
  остаётся ни в одном интенте.

Проверка, что тесты не полые — мутацией правила:

```
$ # callbackWindow.trim() || "в ближайшее время"  →  callbackWindow.trim()
$ npm run test:flow
not ok 8 - fillCallbackWindow подставляет окно, а при пустом — честное «в ближайшее время»
# pass 7
# fail 1
$ # возврат исходного файла
# pass 8
# fail 0
```

### 3.2. Единый обязательный pipeline (`7db204b`)

| Файл | Изменение |
|---|---|
| `.github/workflows/ci.yml` | шаг «Поток калькулятора (test:flow)» в job `static`; шаг «Плавающие E2E-тесты» в job `e2e`; в артефакт падения добавлен `test-results/results.json` |
| `scripts/check-e2e-flaky.mjs` | новый гейт: читает JSON-отчёт Playwright, перечисляет тесты со статусом `flaky` |
| `playwright.config.ts` | JSON-репортёр (`test-results/results.json`) — и в CI, и локально |
| `package.json` | `check:e2e-flaky`; `ci:all` — весь pipeline из ТЗ одной командой |
| `lefthook.yml` | `test:flow` в pre-push (харнесс идёт ~20 мс) |

Порядок в `ci:all` — буквально цепочка из ТЗ плюс гейт на флаки:

```
lint → tsc --noEmit → test → test:flow → validate:catalog → build → check:bundle → test:e2e → check:e2e-flaky
```

`build` тянет `prebuild`, то есть все стражи входят в pipeline:
`check-legal-fields`, `validate-catalog`, `build-catalog-index`, `check-images`,
`check-catalog-images`, `check-file-size` (лимит 600 строк), `check-effect-setstate`,
`check-availability`, `build-og-image`, `build-page-dates`.

### 3.3. Гейт на «плавающие» E2E

`scripts/check-e2e-flaky.mjs` — режимы как у `check:env` (PT-006):

| Условие | Поведение |
|---|---|
| `flaky = 0` | `ok — повторных попыток не потребовалось, результат стабильный`, exit 0 |
| `flaky > 0`, `RELEASE=1` | список тестов с числом попыток, exit **1** |
| `flaky > 0`, без `RELEASE` | предупреждение, exit 0 |
| отчёт не прочитан, `RELEASE=1` | exit **1** — утверждать «флаков нет» без отчёта нельзя |
| отчёт не прочитан, без `RELEASE` | предупреждение, exit 0 |

`RELEASE=1` в CI ставится на `main`, `quizv2ver1` **и в PR, которые в них идут**
(`github.base_ref`): чинить флак после мержа уже поздно. На прочих ветках —
предупреждение, чтобы не мешать промежуточной работе.

Проверено на синтетическом отчёте с одним `flaky`:

```
$ E2E_REPORT=/tmp/fake-results.json node scripts/check-e2e-flaky.mjs
[e2e-flaky] всего: 179 passed, 0 failed, 1 flaky, 12 skipped
[e2e-flaky] «плавающих» тестов: 1
  - e2e/track-sale.spec.ts › Страница света (мобильная) › сценарий 5: … (попыток: 2)
[e2e-flaky] предупреждение: на фиче-ветке не блокирую. …
EXIT=0
$ RELEASE=1 E2E_REPORT=/tmp/fake-results.json node scripts/check-e2e-flaky.mjs
… тот же список …
EXIT=1
```

### 3.4. Реестр пропусков: причина и владелец (`26117c7`)

Полная таблица — в README, раздел «Реестр пропусков и повторов в тестах».
Владелец всех пунктов — `svladimirtsk-crypto` (владелец продукта),
исполнитель — Arena Agent.

**Unit (vitest): 34 skipped = 15 + 10 + 9** — три файла с
`describe.skipIf(!TEST_DATABASE_URL)`:

| Файл | Тестов | Задача | В CI |
|---|---|---|---|
| `tests/lead-route-db.test.ts:73` | 15 | N-001, `POST /api/lead` с реальной БД | **выполняются всегда** |
| `tests/availability-db.test.ts:46` | 10 | PT-016, календарь замеров в PostgreSQL | выполняются |
| `tests/delivery-alert-db.test.ts:58` | 9 | PT-015, алерт о сбоях доставки | выполняются |

Job `static` поднимает `postgres:17-alpine`, накатывает схему `drizzle-kit push`
и задаёт `TEST_DATABASE_URL` — то есть локальный пропуск не означает непроверенный
код. Локально включается одной переменной (команда в README).

**E2E (Playwright): 12 skipped из 192** — два проекта раскладки
(`chromium-desktop` 1280×900, `chromium-mobile` 390×844), сценарий существует
только для одной:

| Место | Тестов | Пропускается в | Причина |
|---|---|---|---|
| `e2e/track-sale.spec.ts:12` | 2 | desktop | бар корзины только под sm-брейкпоинтом (T-091) |
| `e2e/track-sale.spec.ts:56` | 1 | desktop | состав заявки собирается с мобильного бара |
| `e2e/funnel-modern.spec.ts:36` | 2 | mobile | сценарий завязан на desktop-раскладку |
| `e2e/lighting-first.spec.ts:14` | 1 | mobile | desktop-раскладка |
| `e2e/draft-restore.spec.ts:223` | 1 | mobile | нужна desktop-раскладка каталога |
| `e2e/entry-context.spec.ts:175` | 1 | desktop | мобильный стики — `lg:hidden` |
| `e2e/entry-context.spec.ts:233` | 1 | desktop | то же |
| `e2e/modal-layout.spec.ts:34` | 1 | desktop | только мобильный проект |
| `e2e/modal-layout.spec.ts:51` | 1 | mobile | только desktop-проект |
| `e2e/modal-layout.spec.ts:78` | 1 | desktop | только мобильный проект |
| **Итого** | **12** | | сходится с `12 skipped` в реальном прогоне |

**Других пропусков нет:** `.only`/`.fixme`/`.todo`/`xit`/`xdescribe` в `tests/` и
`e2e/` не используются, `forbidOnly` в CI включён; все 14 вхождений
`.skip`/`.skipIf` перечислены выше. Правило на будущее записано в README: новый
`test.skip` обязан иметь текстовую причину вторым аргументом и строку в реестре.

**Повторные попытки** (`retries: 1` в CI) больше не «зелёное молчание»: прошедший
со второй попытки тест виден как `flaky` и на релизных ветках роняет job.

### 3.5. Документация

- README, раздел «Проверки» переписан: был устаревший набор из пяти команд без
  `test:flow`, `check:bundle`, E2E и стражей.
- README, новый раздел «Обязательные CI-гейты и реестр пропусков (PT-019)».
- README, новый раздел «Технический долг Шага 1 «Свет» разобран (PT-018)»:
  в репо принят порядок «раздел в README на каждую задачу» (PT-011…PT-017), а
  PT-018 был задокументирован только отдельным отчётом.

---

## 4. Проверки — точный вывод

```
$ npm run test:flow
# tests 8
# pass 8
# fail 0

$ node scripts/check-e2e-flaky.mjs        # на реальном отчёте прогона
[e2e-flaky] всего: 2 passed, 0 failed, 0 flaky, 0 skipped
[e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный

$ RELEASE=1 node scripts/check-e2e-flaky.mjs   # без файла отчёта
[e2e-flaky] отчёт test-results/results.json не прочитан: ENOENT
[e2e-flaky] в блокирующем режиме отсутствие отчёта — падение.
EXIT=1

$ npx tsc --noEmit
(0 ошибок)

$ python3 -c "import yaml; …"             # ci.yml
YAML валиден; jobs: ['static', 'build', 'e2e', 'secrets']
шаги static: ESLint, TypeScript, Применить схему БД, Unit-тесты (vitest),
             Поток калькулятора (test:flow), Окружение и реквизиты, Каталог,
             Календарь замеров
шаги e2e:    Восстановить сборку, Распаковать сборку, Установить браузеры,
             Playwright, Плавающие E2E-тесты, Отчёт при падении
```

### Полный pipeline одной командой

Прогон целиком на ветке задачи, одним вызовом — все девять гейтов подряд:

```
$ npm run ci:all

> nextjs@0.1.0 lint                       # eslint — 0 ошибок
> npx tsc --noEmit                        # 0 ошибок
> nextjs@0.1.0 test
 Test Files  83 passed | 3 skipped (86)
      Tests  1038 passed | 34 skipped (1072)

> nextjs@0.1.0 test:flow
# tests 8
# pass 8
# fail 0

> nextjs@0.1.0 validate:catalog
> nextjs@0.1.0 prebuild                   # стражи, входят в build
[file-size] ok — проверено 131 файлов, лимит 600 строк, 2 legacy-исключения
[effect-setstate] ok — 18 разрешённых сеттеров, 3 моста к стору

> nextjs@0.1.0 build
✓ Compiled successfully in 3.0s

> nextjs@0.1.0 check:bundle
[bundle] ok — / 225.7 КБ ≤ 300 КБ

> nextjs@0.1.0 test:e2e
  12 skipped
  180 passed (7.2m)

> nextjs@0.1.0 check:e2e-flaky
[e2e-flaky] всего: 180 passed, 0 failed, 0 flaky, 12 skipped
[e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный

EXIT=0
```

`34 skipped` в unit-прогоне — это три файла с `skipIf(!TEST_DATABASE_URL)`
(локально PostgreSQL не поднималась); в CI они выполняются, см. реестр выше.
`12 skipped` в E2E — раскладочные, перечислены поштучно.
`0 flaky` — ни один тест не потребовал повторной попытки.

### CI на ветке задачи (`PR #39`, прогон `35067007069`, `30e3590`)

Оба новых шага не просто «зелёные» — они действительно выполнились, что проверено
по логам job, а не по итоговому статусу:

```
JOB: Lint · types · unit | success
    ESLint · TypeScript · Применить схему БД · Unit-тесты (vitest)
    Поток калькулятора (test:flow)         success
        # tests 8
        # pass 8
        # fail 0
    Окружение и реквизиты · Каталог · Календарь замеров

JOB: Build · bundle budget | success
JOB: E2E (Playwright) | success
    Playwright                             success
    Плавающие E2E-тесты                    success
        [e2e-flaky] всего: 180 passed, 0 failed, 0 flaky, 12 skipped
        [e2e-flaky] ok — повторных попыток не потребовалось, результат стабильный
    Отчёт при падении                      skipped   ← не понадобился
JOB: Секреты (gitleaks) | success
```

Гейт на флаки шёл в **блокирующем** режиме: `base_ref` этого PR — `quizv2ver1`,
то есть `RELEASE=1`. `0 flaky` на всём прогоне из 192 тестов.

---

## 5. Ограничения

1. **Гейт на флаки не проверялся на настоящем флаке** — только на синтетическом
   JSON-отчёте (структура `stats` + `suites[].specs[].tests[].status === "flaky"`
   взята из реального отчёта Playwright той же версии). Настоящий флак
   воспроизводить намеренно не стали: это потребовало бы внести нестабильность в
   рабочий тест.
2. **`retries: 1` оставлен.** Убирать повторы совсем — значит вернуть падения на
   сетевых сбоях раннера; ТЗ требует не «без повторов», а «без плавающих
   результатов», то есть без незамеченных повторов. Теперь повтор виден и на
   релизных ветках блокирует.
3. **Блокирующий режим не действует на фиче-ветках, из которых PR идёт не в
   `main`/`quizv2ver1`** — осознанно, по образцу `check:env` (PT-006).
4. **Интеграционные тесты с реальной БД остаются задачей `PT-020`**
   (`A-13`(PDF, `F-14`) · `T-326`): здесь задокументировано, что три файла
   с `skipIf(!TEST_DATABASE_URL)` в CI выполняются, но новых сценариев
   (транзакционность outbox, гонки ретрая, идемпотентность) не добавлено.
5. **`test:flow` транспилирует `calculator-flow.ts` через `vm` без разрешения
   импортов** — поэтому проверить им можно только то, что определено в самом
   файле. Подписи кнопок Шага 0 остаются в `tests/step0-fsm.test.ts` (vitest).
   Это ограничение харнесса задокументировано в самом скрипте.
6. Прод не проверялся — задача не подразумевает деплоя.

---

## 6. Откат

```
git revert 26117c7   # документация README (реестр, раздел PT-018, «Проверки»)
git revert 7db204b   # шаги CI, гейт на флаки, ci:all, JSON-репортёр, pre-push
git revert 189a36e   # три теста в test:flow
```

Коммуты независимы; `scripts/check-e2e-flaky.mjs` удалится вместе с `7db204b`.
Данных задача не меняет: ни БД, ни контент, ни цены не тронуты
(`content/*.ts` не редактировался — правило 0.4 ТЗ).
