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
