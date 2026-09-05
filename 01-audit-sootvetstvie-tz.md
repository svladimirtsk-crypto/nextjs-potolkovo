# Аудит №1 · Соответствие репозитория ТЗ (`tz-agent.md`)

**Объект:** `svladimirtsk-crypto/nextjs-potolkovo`, ветка `quizv2ver1`, HEAD `e5fc955` («Add CI workflow…»).
**Эталон:** `tz-agent.md` v1.0 (91 находка → 47 задач T‑001…T‑091, фазы 0–4).
**Метод:** клон ветки, чтение кода, grep по критериям приёмки, локальный прогон `tsc / vitest / eslint / next build / check:bundle`.

## 0. Итог в одном абзаце

Формально закрыты все 47 задач (по одному коммиту на задачу, как требует п. 0.1). Локально всё зелёное: `tsc` — 0 ошибок, `vitest` — 222/222, `eslint` — 0 ошибок / 22 warning, `next build` — 18 статических страниц + 3 API, First Load JS главной — 212 КБ (бюджет 300). **Но 7 задач выполнены частично, и 3 из них — критичные для бизнеса:** лиды **не пишутся в БД** (только память процесса → на Vercel/serverless дедуп, rate‑limit, ретраи и номера заявок не работают), архитектура «единый стор» (T‑030) и «единый каталог света» (T‑031) не доведены (по‑прежнему три источника состояния и два параллельных UI каталога по 2 248 и 1 353 строк), обязательные e2e‑сценарии основного пути воронки (T‑091: сц. 1, 2, 3, 6, 7, 8, 9) не написаны.

## 1. Зелёное состояние (п. 0.5 ТЗ) — проверено локально

| Проверка | Требование ТЗ | Факт |
|---|---|---|
| `npx tsc --noEmit` | 0 errors | ✅ 0 |
| `npm run test` (vitest) | все зелёные | ✅ 27 файлов / 222 теста |
| `npx eslint .` | 0 errors | ✅ 0 errors, 22 warnings |
| `npm run build` | 18+ статических страниц | ✅ 18 static + 3 API |
| `check:bundle` | главная ≤ 300 КБ | ✅ 212,2 КБ |
| `validate-catalog` (prebuild) | зелёный | ✅ 48 SKU, 7 профилей |
| `catalog-index.json` | ≤ 120 КБ | ✅ 104,5 КБ; prefill 14,3 КБ (≤ 20) |
| `npm run test:e2e` | smoke, фаза ≥ 1 | ⚠️ 8 тестов в 3 спеках; см. T‑091 |
| CI на GitHub | зелёный на PR | ❔ файл `ci.yml` закоммичен последним коммитом, результат прогона не проверялся |

## 2. Постатейная проверка задач

Легенда: ✅ выполнено · ⚠️ частично · ❌ не выполнено · 👤 требует владельца

### Фаза 0 — Hotfix

| ID | Задача | Статус | Доказательство / замечание |
|---|---|---|---|
| T‑001 | Секреты, чистка репо | ✅ 👤 | `git ls-files` без `.env.local`; `*.jpeg` в корне — 0; gitleaks в `lefthook.yml` и `ci.yml`. **Ротация `AMVERA_API_KEY` — ручное действие владельца, не подтверждено.** |
| T‑002 | Формы без калькулятора | ✅ | `ActionForm` с обязательными `source/placement`, `leadKind` авто; e2e `lead-forms.spec.ts` (сц. 4) |
| T‑003 | Отладка из квиза | ✅ | grep `QUIZ V2|quiz=v1|JSON.stringify(room` → 0 |
| T‑004 | Мин. заказ, одна сумма | ✅ | `calcRoomsTotal → {raw, applied, minimumApplied}`, `tests/pricing.test.ts`. UX‑замечание: сумма 18 000 ₽ показывается **до** любого ввода (см. аудит №2) |
| T‑005 | Лейблы, кнопка теневой/парящий | ✅ | `lib/calculator-v2/labels.ts`, тест `describeRoom` (17 м.п. → 16 150 ₽); grep сырых `standard/none/modern` в JSX → 0 |
| T‑006 | Скрипт, срезающий hash | ✅ | grep `strip-internal-hash` → 0; e2e сц. 10 |
| T‑007 | Мобильный checkout света | ✅ | `--z-*` токены в `globals.css`, `[data-cart-bar]` + MutationObserver, e2e `track-sale.spec.ts` |
| T‑008 | Устаревший `grandTotal` | ✅ | `grandTotal` не пишется; `extraInstallRub/Lines`; остался комментарий «legacy field» в `calculator-modal-context.tsx:340` |
| T‑009 | Досчёт монтажа | ✅ | сравнение в натуральных единицах; тест 12/12 → 0, 14/12 → 1 500 ₽ |
| T‑010 | Стартовый экран Шага 1 | ✅ | `lib/lighting/resolve-initial-step.ts`, 4 кейса в тестах |
| T‑011 | Метраж профилей, whitelist | ✅ | регэкспы с `u`/`(?![\p{L}])`, `scripts/validate-catalog.mjs` в `prebuild` |
| T‑012 | Лампы/закладные — предложение | ✅ | эффекты авто‑синка удалены, блок «Комплектующие»; e2e‑приёмка (MR16 ZOOM ×4 → платформа предложена) **не автоматизирована** |
| T‑013 | Цоколи MR16/GU10 | ✅ | `normalizeSocketText`, табы «MR16 / GU5.3», «GU10», «Прочее» (видны на скриншоте) |
| T‑014 | Комплекты страницы света | ✅ | `priceBadgeOverride`, ввод питания `0У‑00001343` в COLIBRI‑комплектах |
| T‑015 | Поля формы | ✅ | `type=tel/inputMode/autoComplete`, маска, honeypot `botcheck` |

### Фаза 1 — Целостность воронки

| ID | Задача | Статус | Доказательство / замечание |
|---|---|---|---|
| T‑020 | `content/pricing.ts` | ⚠️ | Файл есть, значения = ТЗ, тест соответствия `homepage.price.calculator`. **Критерий «grep литералов 25/10/15 рядом с discount → 0» не выполнен:** `price-strip.tsx:91 percent={25}`, `price-calculator-context.tsx:366 (25 : 10)`, `LightingCartDrawer.tsx:152 «−10%»`. `content/services.ts` — `priceBadge/fromLabel` по‑прежнему строковые литералы, не `formatFrom(pricing)` (см. T‑046) |
| T‑021 | Пресеты страниц в V2 | ✅ | `lib/calculator/presets.ts`, `page-context.tsx`, `tests/presets.test.ts`; `svetoprozrachnye` — пресет отключён |
| T‑022 | `LeadSnapshotV2` | ✅ | `lib/calculator/types.ts`, `tests/lead-snapshot.test.ts` |
| T‑023 | Ремаунт сессии, черновик | ✅ | `sessionId`, `lib/calculator/draft.ts` (`potolkovo:calc-draft:v2`), `tests/draft.test.ts` |
| T‑024 | Lighting‑first prefill | ✅ | `pendingLightingPrefill`, `tests/lighting-first.test.ts`, подсказка «Из вашего набора: … — учтено» |
| T‑025 | Аналитика | ✅ | `lib/analytics.ts` — все 21 событие Приложения В; таблица целей в README (§ «Цели Яндекс.Метрики») |
| T‑026 | Rescue‑оффер | ✅ | `lead_rescue_shown/accepted`, `lib/lead/telegram-link.ts` + тест; e2e сц. 8 отсутствует |
| T‑027 | `/api/lead`: БД, TG, W3F, ретраи | ⚠️ **критично** | Есть: zod‑схема, rate‑limit in‑memory, Telegram, Web3Forms‑дубль, `/api/lead/retry` с `CRON_SECRET`, `runtime = "nodejs"`, серверный `WEB3FORMS_ACCESS_KEY` (публичный ключ удалён). **Нет БД:** `lib/lead/store.ts` → `getLeadStore()` всегда возвращает `InMemoryLeadStore`; `DATABASE_URL` валидируется в `lib/env.ts`, но нигде не используется; `db/schema.sql` — мёртвый файл (комментарий в нём «при заданном DATABASE_URL пишет сюда» — неверен). Следствия на serverless: 6‑й запрос за 10 мин **не** получит 429 после холодного старта, дедуп по телефону не работает между инстансами, `lead_deliveries` и ретраи теряются, `leadId` (`K7F3Q`) не восстановим. Причина — противоречие в самом ТЗ: п. 0.3 запрещает зависимости сверх списка, а п. 2.4/Приложение Б требуют БД и `drizzle-kit push` |
| T‑028 | Копирайт Шага 2, экран успеха | ✅ | `resolveStep2Copy`, `tests/step2-copy.test.ts` |
| T‑029 | Фид вне клиентского бандла | ✅ | `catalog-index.json` 104,5 КБ, ленивый `import()` модалки, `error.tsx/not-found.tsx`, бюджет 212 КБ. Полный фид импортируют только серверные компоненты страницы света (`CatalogSection`, `LightKitShowcase`, `TrackSaleSystemGuideSection` — без `"use client"`) — допустимо по п. 2 задачи |
| T‑030 | Редьюсер‑движок и селекторы | ⚠️ **архитектурно** | Есть `reducer.ts`, `selectors.ts`, `fsm.ts`, `types.ts`, `presets.ts`, `draft.ts` + тесты. **Нет** `store.tsx` (`CalculatorProvider/useCalculator`), `pricing.ts`, `adapters.ts`. `PriceCalculatorQuizV2` не переписан на `useCalculator()` — состояние по‑прежнему живёт в трёх местах: `lib/calculator-v2/use-ceiling-calculator-engine.ts` (357), `calculator-modal-context.tsx` (550), `price-calculator-context.tsx` (408). Setter‑колбэки `onStep0FooterActionChange / setStep1FooterAction / …` — 34 вхождения (ТЗ: удалить). `setState` внутри `useEffect` для синхронизации: `calculator-modal-context.tsx:398`, `wizard-step2-summary.tsx:273`, `wizard-step1-lighting.tsx:1269`, `PriceCalculatorQuizV2.tsx:122`. Критерий приёмки не выполнен |
| T‑031 | Единая корзина света | ⚠️ | `use-lighting-cart.ts`, `kit-rules.ts`, `LightingCartDrawer.tsx`, confirm при конфликте систем — есть. **Общий `components/lighting/LightingCatalog.tsx` не создан**: UI каталога дублирован в `wizard-step1-lighting.tsx` (2 248 строк) и `CatalogSectionClient.tsx` (1 353 строки) |
| T‑032 | Автосборка профиля | ✅ | `profilesForMeters`, `tests/kit-rules.test.ts` |

### Фаза 2 — Конверсия и оффер

| ID | Задача | Статус | Доказательство / замечание |
|---|---|---|---|
| T‑040 | Hero главной | ✅ | `hero-cta.tsx` → `openCalculator({source:"home:hero"})` напрямую; тексты 6.2; строка фактов. Замечание аудита №2: одно и то же фото (`about-master.jpeg`) в hero и в блоке «О мастере» |
| T‑041 | Экраны квиза | ✅ | `CalcModeScreen` удалён, переключатель «Считаю: комнату/объект» на экране площади, `RangeField` с чипами `10…40`, `pricing.defaults.roomArea = 18` |
| T‑042 | `completeKit` | ✅ | БП по мощности, соединители; тесты |
| T‑043 | Секции «Люстры»/«Подсветка карниза» | ✅ | `tests/catalog-sections.test.ts` |
| T‑044 | Одна цена, баннер режима, карточки систем | ✅ | `system-entry-price.ts` + тест |
| T‑045 | Страница света: бар, интент, FAQ, условия | ✅ | `TrackSaleTermsSection`, `TrackSaleOrderingSection`, диалог «−10 % / −25 %», e2e сц. 5 (до Шага 2 не доходит) |
| T‑046 | Страницы услуг | ⚠️ | FAQ + `FAQPage` JSON‑LD, `about/useCases`, отзывы, `ServiceRelatedServices` с `shortDescription`, `ServiceCompareSection` — есть. **Не выполнено:** п. 1 — H1 всех услуг по‑прежнему содержат «в Москве и МО» (`content/services.ts:204, 456, …`); ценовой якорь не через `formatFrom(pricing)` — литералы, из‑за чего **расхождения с прайсом**: `skrytye-karnizy` — «от 2 000 ₽ / м.п.», а в `pricing.cornice` — 1 000 / 1 800 / 4 500; `svetovye-linii` — `priceBadge` «/ линия» vs `fromLabel` «/ метр» |
| T‑047 | Согласие, реквизиты, даты | ✅ 👤 | `availability.ts`, `legal.ts`, чекбокс согласия, `check:legal`. **`legalName/inn/ogrnip = TODO_OWNER`** — до заполнения релиз формально запрещён самим ТЗ |

### Фаза 3 — Техдолг

| ID | Задача | Статус | Доказательство / замечание |
|---|---|---|---|
| T‑060 | Мёртвый код | ✅ | V1‑калькулятор, AI‑советчик, `lighting-kits.ts`, легаси track‑sale секции удалены. `knip/ts-prune` в CI нет |
| T‑061 | Пайплайн изображений | ⚠️ | `public/optimized` — 188 файлов WebP/AVIF, `<Picture>`, `check-images` в prebuild. **Каталог:** `data/catalog-images.json = {}` — `build:catalog-images` ни разу не запускался; карточки грузят хотлинки `eksmarket.ru/upload/…` и при сбое показывают заглушку «Фото товара» (именно это видно на скриншотах Шага 1 и страницы света). Из песочницы URL отвечает 200, т.е. проблема — блокировка/медленный CDN поставщика у части клиентов, а не битые ссылки |
| T‑062 | `lib/env.ts` | ✅ | zod‑валидация, предупреждения, `tests/env.test.ts` |
| T‑063 | SEO: хаб, Offer, lastModified | ✅ | `/uslugi` хаб (9 карточек), `lib/seo-schema.ts`, `tests/seo-hub.test.ts` |
| T‑064 | Дизайн‑токены | ✅ | `tests/design-tokens.test.ts`; на практике модалка всё ещё смешивает `rounded-xl/2xl/full` и три размера кнопок |
| T‑065 | Глобальный поиск | ✅ | `tests/catalog-search.test.ts`, e2e |

### Фаза 4 — CI и регресс

| ID | Задача | Статус | Доказательство / замечание |
|---|---|---|---|
| T‑090 | Инфраструктура, CI | ✅ ❔ | `playwright.config.ts` (desktop 1280 + Pixel 5), `.gitleaks.toml`, `lefthook.yml`, `check-bundle-budget.mjs`, `.github/workflows/ci.yml`. Прогон на GitHub не подтверждён (PHASE‑4‑REPORT: файл не удавалось запушить без scope `workflow`; сейчас закоммичен) |
| T‑091 | Обязательный минимум регресса | ⚠️ **критично** | vitest — Приложение Д покрыто. Playwright: реализованы сц. **4, 10, часть 5** + 2 теста back‑chain. **Не реализованы сц. 1, 2, 3, 6, 7, 8, 9** — т.е. основной путь «главная → квиз → Шаг 1 → Шаг 2 → `/api/lead`», lighting‑first с комплектом, rescue‑диалог, черновик. Это именно те сценарии, где раньше были регрессии (S1‑01, S2‑03, UX‑09) |

## 3. Целевые метрики ТЗ (раздел 1) — что можно подтвердить кодом

| Метрика | Цель | Статус по коду |
|---|---|---|
| Отправка page‑формы без калькулятора | ≥ 95 % | ✅ разблокировано, e2e |
| Лид с полным составом | 100 % | ✅ `LeadSnapshotV2` + `format-lead` |
| Расхождение сумм Шаг 0/1/2 ↔ стики ↔ письмо | 0 | ⚠️ единый `selectTotals` есть, но стики/форма частично читают контекст модалки, а не стор (T‑030 не завершён) — риск регресса |
| Полный комплект света в лиде | ≥ 90 % | ⚠️ `completeKit` есть; блокировка «К итогу» без БП — реализована как предупреждение; e2e нет |
| JS главной до калькулятора | ≤ 300 КБ | ✅ 212 КБ |
| LCP mobile (hero ≤ 150 КБ) | < 2,5 с | ✅ AVIF/WebP 480/960/1440 сгенерированы; замер Lighthouse не проводился |
| Битые фото каталога | 0 % | ❌ локальные превью не собраны, зависимость от хостинга поставщика |
| Товары с ценой, достижимые в UI | 100 % | ✅ `tests/catalog-coverage.test.ts` |
| Открытие калькулятора / визит, сводка, контакт | 25 / 55 / 30 % | ❔ события есть, цели в Метрике должен создать владелец |

## 4. Отклонения от «правил агента» (раздел 0 ТЗ)

1. **п. 0.3 «нельзя менять тексты `content/*.ts`, кроме указанных»** — соблюдено формально, но из‑за этого не исправлены противоречия в ценах (`skrytye-karnizy`, `svetovye-linii`).
2. **п. 0.3 «нельзя `setState` внутри `useEffect`»** — 4 нарушения остаются в `components/calculator-modal/**`.
3. **п. 0.3 «зависимости»** vs **п. 2.4 «БД»** — конфликт разрешён в пользу «без БД», о чём честно написано в `store.ts`, но это ломает 4 бизнес‑требования (дедуп, лимит, ретраи, номер заявки).
4. **п. 0.6 «отчёт по задаче»** — есть только для фаз 0 и 4 (`PHASE-0-REPORT.md`, `PHASE-4-REPORT.md`); фазы 1–3 без отчётов.

## 5. Что нужно сделать владельцу (не код)

- Ротировать `AMVERA_API_KEY`; убедиться, что в Vercel/Amvera заданы `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `WEB3FORMS_ACCESS_KEY`, `CRON_SECRET`.
- Заполнить `legalName / inn / ogrnip` в `content/contacts.ts` (иначе `check:legal` и ТЗ блокируют релиз).
- Создать цели в Метрике по таблице README.
- Подтвердить аккаунт Telegram `potolkovo_msk` и отсутствие WhatsApp.
- Решить вопрос БД (Neon/Vercel Postgres/Amvera Postgres) — без этого T‑027 не закрывается.

## 6. Приоритеты по итогам аудита №1

| Приоритет | Что | Почему |
|---|---|---|
| P0 | Подключить БД к `lib/lead/store.ts` (Drizzle + `pg`), реализовать `PgLeadStore` | Заявки, ретраи, дедуп и номера заявок сейчас теряются при каждом холодном старте |
| P0 | Собрать локальные превью каталога (`build:catalog-images`) и коммитить/строить в CI | Каталог без фото — это витрина без товара (скриншоты) |
| P0 | Написать e2e сц. 1, 2, 3, 6, 7, 8, 9 | Основная воронка не защищена регрессом |
| P1 | Ценовые якоря услуг из `pricing.ts` (`formatFrom`), убрать литералы 25/10 | Клиент видит разные цены на одну услугу |
| P1 | Завершить T‑030 (`store.tsx`, `useCalculator`, убрать setter‑колбэки и `setState` в эффектах) | Три источника состояния → повторение багов сумм |
| P2 | Общий `LightingCatalog.tsx` (T‑031 п. 1) | 3 600 строк дублирующегося UI |
| P2 | H1 без «в Москве и МО», регион в `title` | SEO‑каннибализация и длина H1 |

Подробные UX/маркетинговые/копирайтерские находки — в аудите №2, задачи с приёмкой — в ТЗ v2.
