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
| `lead_rescue_shown` / `lead_rescue_accepted` | `total` | rescue-диалог (T-026) |
| `form_opened` | `form`, `source` | `action-form.tsx` |
| `lead_submit` | `placement`, `lead_kind`, `order_intent`, `grand_total`, `rooms`, `lighting_items`, `source`, `page_path`, `lead_id` | `action-form.tsx` |
| `lead_error` | `kind` (validation/network/server/ratelimit), `placement` | `action-form.tsx` |
| `messenger_click` | `messenger`, `placement`, `with_context` | Шаг 2, страницы услуг |

Параметры визита (`ym(id, "params", …)`): `calc_total` и `calc_scenario` — при каждой сводке
Шага 0; `lead_total` — при успешной отправке заявки.

## Приём заявок — `/api/lead` (T-027)

Все формы сайта отправляют JSON на `POST /api/lead`. Прямых обращений к Web3Forms
из браузера больше нет: клиентский ключ `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` удалён,
используется серверный `WEB3FORMS_ACCESS_KEY`.

Конвейер запроса: honeypot → rate-limit (5 запросов / 10 мин на IP) → zod-валидация
(`lib/lead/schema.ts`) → дедуп по телефону за 10 минут → запись → доставка в Telegram
(основной канал) и Web3Forms (дубль). Неуспешная доставка **не роняет** ответ: заявка
уже сохранена, а канал помечается `failed` и повторяется кроном.

Ответ: `{ ok: true, leadId: "K7F3Q", callbackWindow: "сегодня до 21:00" | "завтра с 9:00" }`.
Окно перезвона считается по времени сервера в зоне Europe/Moscow и рабочим часам 9:00–21:00.

| Переменная | Назначение |
|---|---|
| `LEAD_API_ENABLED` | `0` — вернуть 503 и не принимать заявки |
| `TELEGRAM_LEADS_ENABLED` | `0` — не отправлять в Telegram (Web3Forms продолжит работать) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | доставка в Telegram |
| `WEB3FORMS_ACCESS_KEY` | серверный ключ дубля на почту |
| `CRON_SECRET` | доступ к `POST /api/lead/retry` (заголовок `Authorization: Bearer …`) |
| `DATABASE_URL` | строка подключения; схема — `db/schema.sql` |

Повторная доставка: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/lead/retry`
— берёт до 20 упавших доставок, максимум 5 попыток на каждую.

**Хранилище.** Схема таблиц `leads` и `lead_deliveries` описана в `db/schema.sql`
(Приложение Б ТЗ). ORM в проект пока не добавлена, поэтому `lib/lead/store.ts` содержит
интерфейс `LeadStore` и in-memory реализацию: заявки живут в памяти процесса и
обслуживают дедуп с ретраями. Для продакшена нужно реализовать `LeadStore` поверх
SQL из `db/schema.sql` — вызывающий код (`route.ts`) при этом не меняется.

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
