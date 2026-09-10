# Отчёт: ФАЗА 0 (HOTFIX) по tz-agent.md

База: ветка `quizv2ver1`, коммит `1db58b3`. Все изменения — в рабочей копии `/home/user/repo`.

## Зелёное состояние

```
npx eslint .            → 0 errors (warnings остались от легаси)
npx tsc --noEmit        → 0 errors
npm run test            → 17 passed (vitest)
node scripts/validate-catalog.mjs → ok (48 SKU, 7 профилей)
npm run build           → успешно, 18 маршрутов
```

## Что сделано

| Задача | Файлы | Суть |
|---|---|---|
| **T‑001** секреты и мусор | `.gitignore`, `README.md`, корень | `.env.local` убран из индекса, `!.env.example` в игноре, удалены 20 `*.jpeg` из корня, в README раздел «Секреты» с TODO о ротации `AMVERA_API_KEY` |
| **T‑002** формы без калькулятора | `action-form.tsx`, `home-action.tsx`, `ServiceActionSection.tsx`, `wizard-step2-summary.tsx` | Удалён блок «Нельзя отправить пустую заявку». Обязательные пропсы `source`/`placement`, авто-`leadKind`. Приоритет пропса над `snapshot.leadSource`; `calculator_source` — отдельным полем. В payload добавлены `source`, `placement`, `lead_kind`, `service_slug`, `page_path`. В модалке при пустом расчёте — нефатальное предупреждение |
| **T‑003** отладка в квизе | 5 экранов quiz‑v2, `wizard-step0-calculator.tsx` | Убраны все `QUIZ V2 — …`, баннер «вернуться к старой версии», JSON‑дамп комнаты. Generic‑fallback → карточка «Этот параметр пока недоступен» + автопереход |
| **T‑004** минимальный заказ | `room-snapshot.ts`, `use-ceiling-calculator-engine.ts`, `step0-section-summary.tsx`, `price-strip.tsx` | `calcRoomsTotal → { raw, applied, minimumApplied }`. Одна сумма в сводке и стрипе, бейдж «мин. 18 000 ₽» удалён, вместо него объясняющая строка |
| **T‑005** лейблы и теневой/парящий | новый `lib/calculator-v2/labels.ts`, `ParamScreen`, `RoomEditScreen`, `SummaryScreen` | Словари `SCENARIO/CEILING/CORNICE/TRACK_LABELS`, `describeRoom()`. Кнопка «Показать теневой и парящий профиль →» реально включает `modern` без потери площади. В карточке комнаты — полный состав и все узлы редактируемы. «Современный сценарий · 2 помещения» |
| **T‑006** hash‑скрипт | `app/layout.tsx` | Скрипт `strip-internal-hash` удалён — `#price`/`#action` больше не срезаются |
| **T‑007** мобильный checkout | `globals.css`, `mobile-sticky-cta.tsx`, `CatalogSectionClient.tsx` | Шкала слоёв `--z-sticky/cart/modal/modal-footer/confirm`. Стики скрывается при `[data-cart-bar][data-count>0]` (MutationObserver). На панели корзины — кнопка «Посмотреть», высота кнопок ≥ 44 px |
| **T‑008** устаревший grandTotal | `calculator-modal-context.tsx`, `wizard-step2-summary.tsx`, `mobile-sticky-cta.tsx`, `action-form.tsx`, `price-calculator-context.tsx` | `grandTotal` больше не пишется (`undefined`), вместо него явные `extraInstallRub`/`extraInstallLines`. Стики и форма считают сумму из селекторов контекста (`ceilingEffectiveTotal + lightingEffectiveTotal`). В письме нет строки с разницей старых сумм |
| **T‑009** досчёт монтажа | `wizard-step2-summary.tsx` | Сравниваются натуральные величины (метры/точки), а не рубли → без удвоения. Строки в hero: «Потолок и работы», «Монтаж света: N точек, M м трека — уже в потолке», «+ монтаж ещё K точек» |
| **T‑010** стартовый экран Шага 1 | новый `lib/lighting/resolve-initial-step.ts`, `wizard-step1-lighting.tsx` | Чистый резолвер; `wizardInitializedRef` удалён, пересчёт идёт при изменении `derivedInputs`, пока подбор не тронут. Состояние `none` = экран ручного подбора, футер «К итогу →» активен. При исчезновении трека — сброс через тот же резолвер |
| **T‑011** метраж и whitelist | `product-length-meters.ts`, `vendor-code-overrides.ts`, `catalog-ui-config.ts`, новый `scripts/validate-catalog.mjs` | Регэкспы с `u` и границей `(?![\p{L}])`, для габаритов `A*B*C мм` берётся максимум. Добавлены длины `0У-00006341/6342 = 3 м`; `0У-00001341` → COLIBRI `TRACK_PROFILE` (2 м), `0У-00001342` → COLIBRI `TRACK_ACCESSORY`, оба убраны из ART‑whitelist. `validate-catalog` подключён к `prebuild` |
| **T‑012** лампы/закладные | `wizard-step1-lighting.tsx`, `catalog-ui-config.ts` | Оба эффекта принудительной синхронизации удалены. Блок «Комплектующие» с чипами‑предложениями над «Выбранным»; несуществующий `0У-00007121` заменён на реальный `0У-00005425` |
| **T‑013** цоколи | `feed2-products.ts`, `catalog-ui-config.ts` | `normalizeSocketText` (`mr-16→mr16`, `gu 10→gu10`, `gu5,3→gu5.3`), `GU10` — отдельный цоколь и отдельный таб, таб «MR16» → «MR16 / GU5.3», добавлена секция «Прочее» |
| **T‑014** комплекты света | `LightKitShowcase.tsx`, `ServiceHero.tsx`, `page.tsx`, `content/services.ts` | Комплекты собираются через `normalizeFeedCatalogProducts + applyVendorOverrides`; в каждый COLIBRI‑комплект добавлен ввод питания `0У-00001343`, в «гостиную» — прямые соединители по числу стыков. Ценовой якорь вычисляется (`priceBadgeOverride`), строка «комплект от 15 100 ₽» удалена |
| **T‑015** поля формы | `action-form.tsx` | `type/inputMode/autoComplete` для телефона, маска `+7 (___) ___-__-__` без зависимостей, `autoComplete` для имени и района, человеческие тексты ошибок, сообщение о конфигурации с телефоном, honeypot `botcheck` |
| **T‑020** единый прайс (из фазы 1, нужен для T‑004/005) | новый `content/pricing.ts` | Все цены/проценты из одного места; `lighting-formulas`, `CatalogSectionClient`, `eksmarket-assortment`, `CatalogSection` читают отсюда; у `getDiscountedPrice` убран дефолт 15 |

## Тесты

`tests/pricing.test.ts` (7) — соответствие `pricing` ↔ `homepage.price.calculator`, минимальный заказ (10 м² → 18 000 / 30 м² → 30 000 / 0 → 0), `describeRoom` для теневого 17 м.п. → «Теневой профиль · 17 м.п. · 16 150 ₽».

`tests/lighting.test.ts` (10) — резолвер стартового экрана (4 кейса), длины всех профилей из whitelist > 0, шинопровод АРТ 3000 мм = 3 м, нормализация цоколей, наличие GU10, досчёт монтажа (12/12 → 0, 14/12 → 1500 ₽).

## Как проверить руками

1. `/uslugi/skrytye-karnizy` → форма внизу → отправка работает без калькулятора; в запросе `source=skrytye-karnizy`, `placement=service-page`, `lead_kind=direct`.
2. `/#price` → скролл к секции, hash сохраняется, «назад» работает.
3. Калькулятор → комната 10 м² → сводка показывает 18 000 ₽ и строку про минимальный заказ, без бейджа.
4. Шаг 0 «Простой потолок» → кнопка «Показать теневой и парящий профиль →» открывает теневой без сброса площади.
5. Страница света на мобильном: добавить товар → панель корзины видна, старый стики‑CTA исчезает, есть «Посмотреть».

## Не сделано (требует владельца)

- Ротация `AMVERA_API_KEY` в кабинете провайдера — ручное действие (TODO в README).
- `gitleaks` в pre‑commit/CI — вынесено в T‑090 (фаза 4).
- Playwright e2e — зависимости установлены, сценарии добавляются в T‑090/T‑091.
