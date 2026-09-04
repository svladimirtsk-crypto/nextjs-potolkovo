\# ТЗ для ИИ‑агента: доработка сайта ПОТОЛКОВО (ветка \`quizv2\`) по итогам трёх аудитов

Версия 1.0 · База: коммит \`ded8382\` · Стек: Next.js 16.1 (App Router, Turbopack) · React 19.2 · Tailwind 4 · TypeScript · без БД (добавляется в рамках ТЗ) · лиды → Web3Forms · Яндекс.Метрика \`107200362\`

Документ консолидирует \*\*91 находку\*\* трёх аудитов (№1 — сайт/воронка \`UX/MK/EN\`, №2 — Шаг 1 \`S1\`, №3 — Шаг 2/страница света/услуги \`S2/LF/LP/SV\`) в \*\*одну последовательность задач\*\* с файлами, точными действиями, критериями приёмки и тестами. Каждая задача имеет ID \`T‑xxx\` и ссылки на исходные находки. Приложение А — таблица соответствия «находка → задача».

\---

\#\# 0\. Правила работы агента

0.1. \*\*Ветка и коммиты.\*\* Работать в ветке \`quizv2\` (или \`quizv2-fix/\<фаза\>\`). Один коммит \= одна задача \`T‑xxx\`; сообщение: \`T-012: короткое описание (UX-02, SV-02)\`. Не делать squash фаз в один коммит.

0.2. \*\*Порядок.\*\* Задачи выполняются по фазам 0 → 1 → 2 → 3 → 4\. Внутри фазы — в порядке номеров. Задача из следующей фазы не начинается, пока не зелёная текущая фаза (см. 0.5).

0.3. \*\*Что нельзя.\*\*  
\- Нельзя менять цены/проценты, кроме как через \`content/pricing.ts\` (создаётся в T‑020). Значения переносятся из \`content/homepage.ts → price.calculator\` \*\*без изменений\*\*: полотно 1 000 / 800 / 800 ₽·м²; теневой 950, парящий 2 500 ₽·м.п.; карнизы 4 500 / 1 800 / 1 000; линии 3 500; трек 2 500 / 1 500; точки 750; люстры 1 000; подсветка карниза 1 500 \+ БП 1 500; минимальный заказ 18 000; скидки на свет 25 % (с потолком) / 10 % (только свет).  
\- Нельзя удалять/переименовывать URL страниц, \`id\` якорей \`hero/proof/price/trust/promise/action\`, JSON‑LD, \`sitemap\`, \`robots\`.  
\- Нельзя менять тексты \`content/\*.ts\`, кроме явно указанных в задачах (раздел 6).  
\- Нельзя добавлять зависимости сверх списка: \`zod\`, \`vitest\`, \`@playwright/test\`, \`sharp\` (dev), \`@upstash/ratelimit\` \*\*не\*\* нужен — rate‑limit делать in‑memory \+ БД.  
\- Нельзя оставлять \`any\` в новом коде; нельзя писать \`setState\` внутри \`useEffect\` для синхронизации состояний (замена — reducer/селекторы).

0.4. \*\*Флаги.\*\* Новые крупные поведения — за env‑флагами с дефолтом «включено»: \`NEXT\_PUBLIC\_CALC\_QUIZ\_V2\` (существует), \`LEAD\_API\_ENABLED\`, \`TELEGRAM\_LEADS\_ENABLED\`. V1‑калькулятор удаляется в фазе 4\.

0.5. \*\*Зелёное состояние фазы\*\* (обязательно перед переходом):  
\`\`\`  
npm run lint            \# 0 errors  
npx tsc \--noEmit        \# 0 errors  
npm run test            \# vitest, все зелёные  
npm run test:e2e        \# playwright smoke (фаза ≥ 1\)  
npm run build           \# успешно, 18+ статических страниц  
\`\`\`  
0.6. \*\*Отчёт по задаче.\*\* В описании коммита/PR: что сделано, какие файлы, как проверить руками (шаги), какие тесты добавлены.

\---

\#\# 1\. Цели и целевые метрики

| Метрика | Сейчас | Цель |  
|---|---|---|  
| Открытие калькулятора / визит | неизвестно | ≥ 25 % |  
| Дошли до сводки Шага 0 / открыли | неизвестно | ≥ 55 % |  
| Вошли на Шаг 1 → собрали комплект | неизвестно | ≥ 50 % |  
| Контакт (форма / rescue / мессенджер с кодом) / сводка | только \`form\_submit\_success\` | ≥ 30 % |  
| Успешная отправка page‑формы без калькулятора | 0 % (блокировка) | ≥ 95 % |  
| Лид с полным составом (комнаты, сценарий, свет с артикулами, источник‑страница) | частично | 100 % |  
| Расхождение сумм Шаг 0/1/2 ↔ стики ↔ письмо | есть | 0 |  
| Технически полный комплект света в лиде | \~0 % | ≥ 90 % |  
| JS главной до открытия калькулятора | \~1,7 МБ | ≤ 300 КБ |  
| LCP mobile (hero) | 766 КБ JPEG | \< 2,5 с, ≤ 150 КБ |  
| Битые фото каталога | ≈ 9 % | 0 % |  
| Товары с ценой, достижимые в UI | ≈ 70–80 % | 100 % |

\---

\#\# 2\. Целевая архитектура (что должно получиться)

\#\#\# 2.1. Единый стор калькулятора — \`lib/calculator/\`

\`\`\`  
lib/calculator/  
  types.ts          \# RoomConfig, LeadSnapshotV2, LightingCartItem, Requirements, Totals  
  pricing.ts        \# чистые функции: calcRoom(room, pricing) → RoomSnapshot; calcTotals(state) → Totals  
  reducer.ts        \# calculatorReducer(state, action) — ЕДИНСТВЕННЫЙ источник истины  
  selectors.ts      \# selectTotals, selectRequirements, selectFooterAction, selectProgress, selectSummary, selectLeadSnapshot  
  store.tsx         \# CalculatorProvider (useReducer \+ sessionStorage persist) \+ useCalculator()  
  fsm.ts            \# перенос lib/step0-fsm.ts: getNextScreen, getBackFallback, calcProgress (фиксированный M)  
  presets.ts        \# presetToRoom(ServiceCalculatorPreset) → Partial\<RoomConfig\> \+ scenario  
  adapters.ts       \# toLegacySnapshot(state) — только для аналитики/старого письма на переходный период  
\`\`\`

\*\*State:\*\*  
\`\`\`ts  
type CalculatorState \= {  
  sessionId: number;                       // инкремент при openCalculator  
  entryMode: "default" | "lighting-first";  
  source: string;                          // "\<slug\>:\<placement\>"  
  scenario: "standard" | "modern" | "advanced";  
  scope: "room" | "object" | null;  
  rooms: RoomConfig\[\];                     // полный состав каждой комнаты  
  activeRoomId: string | null;  
  screenHistory: Step0Screen\[\];            // квиз  
  confirmed: Record\<string, boolean\>;      // param → подтверждён  
  prefilled: Record\<string, boolean\>;      // param → предзаполнен пресетом/светом (показывать, но не confirmed)  
  pendingLightingPrefill: { trackMeters: number; points: number; trackType: TrackType | null } | null;  
  currentStep: 0 | 1 | 2;  
  lighting: {  
    cart: Record\<productId, { qty: number; auto?: "lamp" | "mount" | "psu" | "feed" | "connector" }\>;  
    system: "COLIBRI\_220" | "CLARUS\_48" | "TRACK\_220" | null;  
    wizardStep: LightingWizardStep | null;  
    touched: boolean;  
  };  
  lead: { submittedAt: number | null; leadId: string | null };  
};  
\`\`\`  
Все производные (\`totals\`, \`requirements\`, \`derivedInputs\`, \`snapshot.lighting\`, \`grandTotal\`) — \*\*только селекторы\*\*, не поля.

\#\#\# 2.2. Единый каталог света — \`lib/lighting/\`

\`\`\`  
lib/lighting/  
  catalog-index.ts  \# ленивый мемоизированный индекс: byId, byVendor, bySystem, byKind, socket; один на приложение; загрузка через import() урезанного словаря  
  normalize.ts      \# normalizeFeedCatalogProducts \+ applyVendorOverrides \+ socket/length нормализация (единственное место)  
  kit-rules.ts      \# requirements(state), completeKit(cart, required), conflicts(cart, product), profilesForMeters(meters, system)  
  use-lighting-cart.ts \# useLightingCart(): actions add/remove/setQty/replaceSystem/applySuggestion; читает/пишет reducer 2.1  
  discounts.ts      \# применение процентов из content/pricing.ts  
\`\`\`  
Компонент \`components/lighting/LightingCatalog.tsx\` — общий UI (секции, поиск, карточки, мини‑корзина), используется и в модалке (Шаг 1), и на странице света.

\#\#\# 2.3. Единый прайс и оффер — \`content/pricing.ts\`

\`\`\`ts  
export const pricing \= {  
  ceiling: { standard: 1000, shadowBase: 800, floatingBase: 800, shadowProfilePerM: 950, floatingProfilePerM: 2500 },  
  cornice: { builtIn: 4500, hiddenNiche: 1800, surface: 1000 },  
  lightLinesPerM: 3500,  
  track: { builtInPerM: 2500, surfacePerM: 1500 },  
  spotInstall: 750, chandelierInstall: 1000,  
  corniceLighting: { perM: 1500, psu: 1500 },  
  minimumOrderRub: 18000,  
  lightingDiscount: { withCeilingPct: 25, lightingOnlyPct: 10 },  
  trackSpotsPerMeter: 1,  
  defaults: { roomArea: 18, objectArea: 60 },  
} as const;  
\`\`\`  
\`content/homepage.ts → price.calculator\`, \`lib/home-proof-pricing.ts\`, \`lib/lighting-formulas.ts\`, \`content/services.ts (priceBadge/fromLabel)\`, \`ServiceCompareSection\`, JSON‑LD \`Offer\` — читают \*\*отсюда\*\*. Скидка из фида (\`discountPercentForCeilingOrder: 15\`) валидируется при импорте и \*\*не используется\*\* в UI.

\#\#\# 2.4. Лид‑пайплайн — \`app/api/lead/route.ts\`

Браузер → \`POST /api/lead\` (zod) → запись в БД \`leads\` → Telegram Bot API мастеру (мгновенно) → Web3Forms (дубль на почту) → ответ \`{ ok, leadId, callbackWindow }\`. Ретрай отправок из таблицы \`lead\_deliveries\` (cron‑route). Rate‑limit: 5 заявок / 10 мин / IP \+ дедуп по \`phone \+ hash(payload)\` за 10 мин.

\#\#\# 2.5. Аналитика — \`lib/analytics.ts\`

Единая схема событий (Приложение В). Все компоненты вызывают только функции из этого файла. \`total\` — параметром визита.

\#\#\# 2.6. Контекст страницы — \`components/calculator-modal/page-context.tsx\`

\`CalculatorPageContextProvider({ preset, scenario, sourceSlug })\` на уровне layout услуги; любой вход в калькулятор (hero, стики, хедер, тизер) берёт пресет отсюда.

\---

\#\# 3\. Фазы и задачи

\#\#\# ФАЗА 0 — HOTFIX (1–2 дня). Цель: перестать терять лиды и врать в суммах

\#\#\#\# T‑001 · Ротация секрета и чистка репозитория · (EN‑01, SV‑07)  
\*\*Файлы:\*\* \`.env.local\`, \`.gitignore\`, корень репо.  
\*\*Сделать:\*\*  
1\. \`git rm \--cached .env.local\`; убедиться, что \`.gitignore\` содержит \`.env\*\` и \`\!.env.example\`.  
2\. В \`README.md\` добавить раздел «Секреты»: \`AMVERA\_API\_KEY\` считать скомпрометированным — ротировать в кабинете провайдера (ручное действие владельца; агент оставляет TODO в PR).  
3\. Удалить 20 файлов \`\*.jpeg\` из корня репозитория (\`proj-\*.jpeg\`, \`svc-\*.jpeg\`, \`step-\*.jpeg\`) — они дублируют \`public/\*\`.  
4\. Добавить \`gitleaks\` в pre‑commit (\`.pre-commit-config.yaml\` или \`lefthook.yml\`) и в CI (T‑090).  
\*\*Приёмка:\*\* \`git ls-files | grep \-E '^\\.env\\.local$'\` пусто; \`ls \*.jpeg\` в корне пусто; build проходит.

\#\#\#\# T‑002 · Разблокировать формы без калькулятора · (S2‑01, SV‑01, LF‑01, SV‑06)  
\*\*Файлы:\*\* \`components/home/action-form.tsx\`, \`components/home/home-action.tsx\`, \`app/uslugi/\_components/ServiceActionSection.tsx\`, \`components/calculator-modal/wizard-step2-summary.tsx\`.  
\*\*Сделать:\*\*  
1\. Пропсы \`ActionForm\`: \`source: string\` (обяз.), \`placement: "home" | "service-page" | "modal"\`, \`leadKind?: "direct" | "calculator" | "lighting-only"\` (если не задан — вычислять: есть комнаты → \`calculator\`, только свет → \`lighting-only\`, иначе \`direct\`).  
2\. Удалить блок «Нельзя отправить пустую заявку» (\`action-form.tsx:162–176\`). В модалке (placement \`modal\`) при пустом расчёте показывать нефатальное предупреждение под формой: «Расчёт не приложится — это нормально, уточню по телефону».  
3\. \`home-action.tsx\`: \`\<ActionForm source="home" placement="home" /\>\`; \`ServiceActionSection.tsx\`: \`\<ActionForm source={service.slug} placement="service-page" /\>\`; Шаг 2: \`source={options?.source ?? "modal"} placement="modal"\`.  
4\. \`effectiveSource\`: приоритет \*\*пропса\*\* над \`snapshot.leadSource\`; \`snapshot.leadSource\` дописывать в отдельное поле \`calculator\_source\`.  
5\. В payload: \`page\_path \= window.location.pathname\`, \`placement\`, \`lead\_kind\`, \`service\_slug\`.  
\*\*Приёмка:\*\* Playwright: \`/uslugi/skrytye-karnizy\` → заполнить → успех; перехваченный запрос содержит \`source=skrytye-karnizy\`, \`placement=service-page\`, \`lead\_kind=direct\`. Главная \`\#action\` — то же с \`source=home\`.

\#\#\#\# T‑003 · Убрать отладочные элементы из квиза · (UX‑01)  
\*\*Файлы:\*\* \`components/calculator-modal/step0/quiz-v2/screens/CalcModeScreen.tsx\`, \`RoomPickerScreen.tsx\`, \`RoomEditScreen.tsx\`, \`ParamScreen.tsx\`, \`components/calculator-modal/wizard-step0-calculator.tsx\`.  
\*\*Сделать:\*\* удалить все \`\<span\>QUIZ V2 — …\</span\>\`; удалить баннер «Вернуться к старой версии калькулятора» (переключение только \`?quiz=v1\`/env без UI); generic‑fallback \`ParamScreen\` заменить на карточку «Этот параметр пока недоступен» \+ автоматический \`goNext()\` через \`useEffect\` при монтировании fallback (единственный допустимый эффект — навигация).  
\*\*Приёмка:\*\* grep \`QUIZ V2|quiz=v1|JSON.stringify(room\` в \`components/\` → 0\.

\#\#\#\# T‑004 · Минимальный заказ и одна сумма в V2 · (UX‑04)  
\*\*Файлы:\*\* \`lib/calculator-v2/room-snapshot.ts\`, \`components/calculator-modal/step0/quiz-v2/screens/SummaryScreen.tsx\`, \`components/calculator-modal/price-strip.tsx\`, \`content/homepage.ts\`.  
\*\*Сделать:\*\*  
1\. \`homepage.price.calculator.minimumOrderRub \= 18000\` (до T‑020 — здесь).  
2\. \`calcRoomsTotal(rooms)\` → \`{ raw, applied, minimumApplied: boolean }\`; \`applied \= max(raw, minimumOrderRub)\`.  
3\. Сводка и PriceStrip читают один хук \`useStep0Totals()\` (временно в \`use-ceiling-calculator-engine.ts\`), показывают \*\*одну\*\* сумму; если \`minimumApplied\` — строка «Минимальный заказ — 18 000 ₽: в него входит выезд, замер и монтаж до 18 м²» (текст — раздел 6.1).  
4\. Убрать бейдж «мин. 18 000 ₽» из PriceStrip.  
\*\*Приёмка:\*\* vitest \`calcRoomsTotal(\[{area:10, standard}\]) → applied 18000, minimumApplied true\`; \`\[{area:30}\] → 30000, false\`.

\#\#\#\# T‑005 · Кнопка «Показать теневой и парящий профиль» и словарь лейблов · (UX‑06, UX‑07)  
\*\*Файлы:\*\* \`quiz-v2/screens/ParamScreen.tsx\`, \`RoomEditScreen.tsx\`, \`SummaryScreen.tsx\`, новый \`lib/calculator-v2/labels.ts\`.  
\*\*Сделать:\*\*  
1\. \`labels.ts\`: \`SCENARIO\_LABELS\`, \`CEILING\_LABELS\`, \`CORNICE\_LABELS\`, \`TRACK\_LABELS\`, \`describeRoom(room, pricing) → { lines: {label, value, amountRub}\[\], totalRub }\` (все включённые узлы с метрами и суммой).  
2\. Кнопка «Показать теневой и парящий профиль →» в \`ParamScreen (param \=== "ceiling")\`: \`engine.chooseScenario("modern")\` без потери площади; пересчитать \`enabledParams\`; перейти на экран \`shadowProfile\`.  
3\. \`RoomEditScreen\`: карточка комнаты \= \`describeRoom\`; редактируемы все узлы (теневой/парящий/линии/подсветка/люстры), не только 4\.  
4\. \`SummaryScreen\`: «Современный сценарий · 2 помещения» вместо «modern сценарий · 1 помещение».  
\*\*Приёмка:\*\* grep \`\\b(standard|none|built-in|surface|modern)\\b\` внутри JSX‑текста экранов → 0; тест \`describeRoom\` для комнаты с теневым 17 м.п. возвращает строку «Теневой профиль · 17 м.п. · 16 150 ₽».

\#\#\#\# T‑006 · Удалить скрипт, срезающий \`\#price/\#action\` · (UX‑18)  
\*\*Файлы:\*\* \`app/layout.tsx\` (\`\<Script id="strip-internal-hash"\>\`).  
\*\*Сделать:\*\* удалить скрипт. Если модалка/форма открывались «сами» по hash — проверить \`lib/scroll-to-anchor.ts\` и обработчики якорей; они не должны вызывать \`openCalculator\` при загрузке.  
\*\*Приёмка:\*\* открыть \`/\#price\` → скролл к секции цены, hash сохранён, кнопка «назад» работает.

\#\#\#\# T‑007 · Мобильный checkout на странице света · (LP‑01)  
\*\*Файлы:\*\* \`components/home/mobile-sticky-cta.tsx\`, \`app/uslugi/prodazha-trekovogo-osveshcheniya/\_components/CatalogSectionClient.tsx\`, \`app/globals.css\`.  
\*\*Сделать:\*\*  
1\. В \`globals.css\` \`@theme\`: \`--z-sticky: 40; \--z-cart: 45; \--z-modal: 120; \--z-modal-footer: 145; \--z-confirm: 200\`.  
2\. \`MobileStickyCta\` скрывается, если в DOM есть \`\[data-cart-bar\]\` с \`data-count \> 0\` (проверка через \`MutationObserver\` или через общий контекст корзины после T‑031). До T‑031 — атрибут на панели корзины страницы.  
3\. На мобильной панели корзины добавить кнопку «Посмотреть» (открывает список в модалке \`initialLightingView: "selected"\`); высота кнопок ≥ 44 px.  
\*\*Приёмка:\*\* Playwright 390×844: добавить товар → \`\[data-cart-bar\]\` виден, \`.mobile-sticky-cta\` отсутствует, клик «Оформить» открывает модалку.

\#\#\#\# T‑008 · Устаревший \`grandTotal\` и стики‑бар · (S2‑03)  
\*\*Файлы:\*\* \`components/calculator-modal/calculator-modal-context.tsx\`, \`lib/calculator-v2/use-ceiling-calculator-engine.ts\`, \`components/home/mobile-sticky-cta.tsx\`, \`components/home/action-form.tsx\`.  
\*\*Сделать (временное до T‑030):\*\*  
1\. В \`markStep0SessionInteracted\` и в эффекте движка, пишущем snapshot: \`grandTotal: undefined\`.  
2\. \`MobileStickyCta.displayTotal \= ceilingEffective \+ lightingEffective\`, где оба берутся из \`useCalculatorModal()\` (там уже есть \`grandTotal\` селектор контекста), а не из \`snapshot.grandTotal\`.  
3\. \`action-form.tsx\`: \`effectiveCeilingRub\` брать из контекста модалки (\`ceilingEffectiveTotal\`), а \`getCalculatorSummaryLines\` не печатать «Установка светильников: (grand − total)», если \`extraInstall\` не пришёл явно (добавить в snapshot поле \`extraInstallRub\` c описанием \`extraInstallLines\[\]\`).  
\*\*Приёмка:\*\* e2e: Шаг 2 → назад → удалить комнату → Шаг 2 и стики показывают одинаковую сумму; письмо не содержит строки с разницей старых сумм.

\#\#\#\# T‑009 · Досчёт монтажа: видимый и без удвоения · (S2‑02, S1‑02 часть, S1‑11 часть)  
\*\*Файлы:\*\* \`lib/calculator-v2/use-ceiling-calculator-engine.ts\`, \`components/calculator-modal/wizard-step2-summary.tsx\`, \`components/calculator-modal/price-strip.tsx\`.  
\*\*Сделать:\*\*  
1\. Движок пишет в snapshot агрегат: \`derivedInputs \= { trackLengthMeters: Σ, pointSpotsQty: Σ, trackMountType: any built-in ? "built-in" : any surface ? "surface" : "none", recommendedTrackSpotsQty: Σ }\`, \`lightsTotal \= Σ\`, \`trackTotal \= Σ\`, \`roomsRequirements\[\] \= {roomId,label,trackMeters,points,trackType}\`.  
2\. Шаг 2: \`extraSpotInstall \= max(0, selectedPoints − Σpoints) × spotInstall\`; \`extraTrackInstall \= max(0, selectedMeters − Σmeters) × rate\`. Строки в hero‑разбивке: «Потолок и работы X ₽» · «Монтаж света: N точек, M м трека — уже в потолке» · при \`extra \> 0\` «+ монтаж ещё K точек Y ₽» · «Свет Z ₽ (−25 %)» · «Итого».  
3\. PriceStrip на Шаге 1 показывает ту же строку монтажа (живую).  
\*\*Приёмка:\*\* vitest: rooms 2×6 точек, корзина 12 корпусов → \`extraSpotInstall 0\`; 14 корпусов → \`2 × 750 \= 1500\`. e2e: слагаемые hero \= итог.

\#\#\#\# T‑010 · Пересчёт стартового экрана Шага 1 · (S1‑01)  
\*\*Файлы:\*\* \`components/calculator-modal/wizard-step1-lighting.tsx\`, новый \`lib/lighting/resolve-initial-step.ts\`.  
\*\*Сделать:\*\*  
1\. \`resolveInitialLightingStep({ requiredTrackMeters, requiredPointQty, cart }) → WStep\`: трек \> 0 → \`system\` (или \`trackProfile\`, если система уже в корзине); только точки → \`points\`; ничего → \`none\`.  
2\. Удалить \`wizardInitializedRef\` и \`useState\`‑инициализацию \`wStep\`; вычислять при входе \`prev \=== 0 && currentStep \=== 1\` и при изменении \`derivedInputs\`, пока \`touched \=== false\`.  
3\. Экран «На шаге потолка не задан трек…» показывать только при \`WStep \=== "none"\`; футер в этом состоянии — «К итогу →» активен.  
4\. При исчезновении трека на Шаге 0 (система осталась) — сброс \`wSystem\`, \`wStep\` через тот же резолвер.  
\*\*Приёмка:\*\* e2e: standard \+ 6 точек → Шаг 1 открыт на «Точечные светильники», футер «Подтвердить точки →» активен после 6 шт.

\#\#\#\# T‑011 · Метраж профилей и whitelist · (S1‑03)  
\*\*Файлы:\*\* \`lib/product-length-meters.ts\`, \`lib/vendor-code-overrides.ts\`, \`lib/catalog-ui-config.ts\`, новый \`scripts/validate-catalog.mjs\`.  
\*\*Сделать:\*\*  
1\. \`parseMetersFromText\`: регэкспы с флагом \`u\` и границей \`(?\!\[\\p{L}\])\`: \`/(\\d+(?:\[.,\]\\d+)?)\\s\*(мм|mm)(?\!\[\\p{L}\])/gu\`, \`/(\\d+(?:\[.,\]\\d+)?)\\s\*(см|cm)(?\!\[\\p{L}\])/gu\`, \`/(\\d+(?:\[.,\]\\d+)?)\\s\*(м|m)(?\!\[\\p{L}\])/gu\`; для габаритов \`A\*B\*C мм\` брать \*\*максимум\*\*.  
2\. \`TRACK\_PROFILE\_PIECE\_LENGTH\_METERS\`: добавить \`0У-00006341: 3\`, \`0У-00006342: 3\`; удалить \`0У-00001341\`, \`0У-00001342\` из ART‑записей.  
3\. \`TRACK\_PROFILE\_WHITELIST.TRACK\_220\`: убрать \`0У-00001341/1342\`; \`0У-00001341\` → \`COLIBRI\_220 / TRACK\_PROFILE (шинопровод 2 м)\` только если подтверждено, иначе \`TRACK\_ACCESSORY\`; \`0У-00001342\` → \`COLIBRI\_220 / TRACK\_ACCESSORY (угловой коннектор)\`.  
4\. \`scripts/validate-catalog.mjs\` (запускается в \`prebuild\`): каждый SKU из всех whitelist/override/\`POINT\_TO\_MOUNT\_VENDOR\_CODE\`/\`CLARUS\_PSU\_VENDOR\_CODES\`/комплектов \`LightKitShowcase\` существует в фиде; каждый \`TRACK\_PROFILE\` из whitelist имеет \`inferPieceLengthMeters \> 0\`; падать с списком проблем.  
\*\*Приёмка:\*\* vitest на 9 SKU ART/COLIBRI/CLARUS профилей (piece \> 0, system совпадает); \`validate-catalog\` зелёный.

\#\#\#\# T‑012 · Лампы/закладные — предложение вместо принуждения · (S1‑04)  
\*\*Файлы:\*\* \`wizard-step1-lighting.tsx\` (эффекты «Auto-sync lamps», «Auto-sync mounts»), \`lib/vendor-code-overrides.ts\`.  
\*\*Сделать:\*\*  
1\. Удалить оба эффекта принудительной синхронизации.  
2\. Добавить блок «Комплектующие» над «Выбранным»: чипы‑предложения «К 8 светильникам нужно 8 ламп GX53 — добавить самые доступные (592 ₽)» → \`applySuggestion\` (позиции получают \`auto: "lamp" | "mount"\`); авто‑позиции удаляемы; при удалении — предупреждение в сводке «без ламп/без платформ».  
3\. \`POINT\_TO\_MOUNT\_VENDOR\_CODE\`: заменить несуществующий \`0У-00007121\` на реальный SKU платформы GX53 из фида (найти по «Платформа … GX53»/«116»); если нет — убрать маппинг и логировать в \`validate-catalog\`.  
\*\*Приёмка:\*\* e2e: MR16 ZOOM ×4 → предложена платформа ×4 (не добавлена молча); удалить лампу → остаётся удалённой.

\#\#\#\# T‑013 · Нормализация цоколей (MR‑16 / GU10) · (S1‑05)  
\*\*Файлы:\*\* \`lib/feed2-products.ts\` (\`detectSocket\`, \`matchesPointSubtype\`), \`lib/catalog-ui-config.ts\`.  
\*\*Сделать:\*\* нормализовать текст (\`mr-16→mr16\`, \`gu 10→gu10\`, \`gu5,3→gu5.3\`); сокет \`GU10\` отдельно для светильников и ламп; \`SPOT\_FIXTURE\` без цоколя → секция «Прочее»; таб «MR16» переименовать «MR16 / GU5.3», добавить «GU10».  
\*\*Приёмка:\*\* тест покрытия: каждый товар с \`priceRub \> 0\` и \`kind ∈ {SPOT\_FIXTURE, TRACK\_FIXTURE, TRACK\_PROFILE, LAMP}\` достижим хотя бы в одной секции; поиск «GU10» в «Точечных» ≥ 25\.

\#\#\#\# T‑014 · Комплекты страницы света: полнота, оверрайды, ценовой якорь · (LP‑03)  
\*\*Файлы:\*\* \`app/uslugi/prodazha-trekovogo-osveshcheniya/\_components/LightKitShowcase.tsx\`, \`content/services.ts\` (только \`priceBadge\` этой страницы).  
\*\*Сделать:\*\*  
1\. \`getProducts()\` → через \`normalizeFeedCatalogProducts\` \+ \`applyVendorOverrides\`.  
2\. В каждый COLIBRI‑комплект добавить \`0У-00001343\` (ввод питания) ×1; в «гостиную» — прямые соединители по числу стыков (\`pieces − corners − 1\`, найти SKU «прямой коннектор» в фиде).  
3\. \`priceBadge\` этой страницы вычислять: \`от {fmt(min(kits.map(k \=\> k.withCeilingRub)))} ₽\` (передавать в \`ServiceHero\` пропсом \`priceBadgeOverride\`); строку «комплект от 15 100 ₽» удалить.  
4\. Тест: все SKU комплектов существуют, \`available \!== false\`, \`priceRub \> 0\`, содержат ввод питания.  
\*\*Приёмка:\*\* страница показывает вычисленный якорь; тест зелёный.

\#\#\#\# T‑015 · Поля формы и сообщения · (LF‑03)  
\*\*Файлы:\*\* \`components/home/action-form.tsx\`, \`components/ui/input.tsx\`.  
\*\*Сделать:\*\* \`phone\`: \`type="tel" inputMode="tel" autoComplete="tel"\`, маска ввода \`+7 (\_\_\_) \_\_\_-\_\_-\_\_\` (без зависимости, простая функция форматирования); \`name\`: \`autoComplete="name"\`; \`address\`: \`autoComplete="address-level2"\`; тексты ошибок из раздела 6.4; сообщение о конфигурации → «Форма временно недоступна — позвоните {phone} или напишите в Telegram»; honeypot — скрытый \`\<input name="botcheck" tabIndex={-1} autoComplete="off" className="hidden"\>\`.  
\*\*Приёмка:\*\* axe: 0 нарушений на форме; ручная проверка на iOS — цифровая клавиатура.

\---

\#\#\# ФАЗА 1 — ЦЕЛОСТНОСТЬ ВОРОНКИ (1 неделя). Цель: все входы ведут себя как обещано, лид полный, суммы из одного источника

\#\#\#\# T‑020 · \`content/pricing.ts\` — единый прайс · (MK‑07, SV‑02, S1‑10, UX‑04)  
\*\*Сделать:\*\* создать по 2.3; \`homepage.price.calculator\` собирать из \`pricing\` (структуру \`ceilingTypes/cornices/tracks…\` сохранить как производную для обратной совместимости); \`lib/lighting-formulas.ts\` — константы 25/10 из \`pricing\`; \`lib/price-utils.ts\` — убрать дефолт 15 у \`getDiscountedPrice\`; \`ServiceCompareSection\` — цены из \`pricing\`; функция \`formatFrom(value, unit) → "от 950 ₽ / м.п."\`.  
\*\*Приёмка:\*\* grep литералов \`25|10|15\` рядом с \`discount\` вне \`content/pricing.ts\` → 0; snapshot‑тест \`homepage.price.calculator\` не изменился по значениям.

\#\#\#\# T‑021 · Пресеты страниц/кейсов в V2 · (UX‑02, SV‑02, SV‑05)  
\*\*Файлы:\*\* \`lib/calculator/presets.ts\` (новый), \`use-ceiling-calculator-engine.ts\`, \`PriceCalculatorQuizV2.tsx\`, \`wizard-step0-calculator.tsx\`, \`components/calculator-modal/page-context.tsx\` (новый), \`app/uslugi/\_components/ServicePageLayoutV2.tsx\`, \`mobile-sticky-cta.tsx\`, \`home-header.tsx\`, \`components/home/proof-card.tsx\`.  
\*\*Сделать:\*\*  
1\. \`presetToRoom(preset) → { room: Partial\<RoomConfig\>, scenario }\`: маппинг \*\*всех\*\* полей \`ServiceCalculatorPreset\` (\`ceilingType→shadowEnabled/floatingEnabled\`, \`shadowLengthDefault/floatingLengthDefault\` (дефолт \`round(4·√area)\`), \`lightLinesEnabled/LengthDefault\`, \`corniceType/LengthDefault\`, \`corniceLighting\*\`, \`trackType/LengthDefault\`, \`lightsEnabled/Count\`, \`calculationScopeDefault\`, \`roomLabelDefault\`).  
2\. Движок: \`initFromPreset(preset)\` при открытии сессии — создаёт комнату с этими значениями, помечает \`prefilled\[param\] \= true\` (квиз показывает экран с уже выбранным значением и подписью «Стартовое значение со страницы — измените под свой объект»).  
3\. \`CalculatorPageContextProvider\` в \`ServicePageLayoutV2\` с \`{ preset: service.price.calculatorPreset, scenario, sourceSlug: service.slug }\`; \`MobileStickyCta\`, \`HomeHeader\`, \`CalculatorTeaserButton\`, hero‑кнопка — берут из контекста, \`source \= "\<slug\>:\<placement\>"\`.  
4\. Кейсы главной: \`proof.items\[\].actionPreset\` → тот же \`initFromPreset\`, плашка «Стартовые параметры по кейсу «…»».  
5\. Для \`svetoprozrachnye-potolki\`: пока в прайсе нет типа полотна — \`calculatorPreset.disabled \= true\`, тизер скрыт, вместо него текст «Светопрозрачные полотна считаю по проекту — от 4 000 ₽/м²» и кнопка на форму.  
\*\*Приёмка:\*\* vitest по каждому slug: \`tenevoy-profil → shadowEnabled true, area 22\`; \`svetovye-linii → lightLinesLength 4\`; \`paryashchie → floatingEnabled\`. e2e: стики‑бар на \`/uslugi/paryashchie-potolki\` открывает квиз с парящим профилем.

\#\#\#\# T‑022 · Сценарий, scope и полный состав в snapshot; \`LeadSnapshotV2\` · (UX‑03, MK‑03, S2‑04, EN‑05 часть)  
\*\*Файлы:\*\* \`lib/calculator/types.ts\`, \`use-ceiling-calculator-engine.ts\`, \`room-snapshot.ts\`, \`price-calculator-context.tsx\`, \`wizard-step2-summary.tsx\`, \`wizard-step0-calculator.tsx\`.  
\*\*Сделать:\*\*  
1\. Тип \`LeadSnapshotV2 { scenario, scope, rooms: RoomSnapshot\[\] (полный состав \+ totalRub), lighting: LightingLeadBlock, totals: { ceilingRaw, minimumApplied, installExtra, lightingRegular, lightingEffective, discountPct, grand }, source, entry }\`.  
2\. Движок при каждом изменении пишет \`solutionScenario\`, \`calculationScope\`, \`roomBreakdown\` \= полный \`RoomSnapshot\` каждой комнаты (все длины/количества/суммы).  
3\. Сводочные CTA (\`resolveStep0SummaryActions\`) считать от \`engine.solutionScenario\`.  
4\. Шаг 2: карточки помещений рендерят чипы из полного \`roomBreakdown\`; строка «Полотно» — по комнатам; блок «Помещения в расчёте» без дублирующего «Общий ориентир».  
5\. \`ceilingTypeLabel\` комнаты: «Простой / Теневой / Парящий / Теневой \+ Парящий».  
\*\*Приёмка:\*\* vitest: 2 комнаты → \`roomBreakdown\[1\].lightsCount \=== 6\`; e2e: на главной выбрать «Современный» → сводка показывает «Подобрать свет −25 % →».

\#\#\#\# T‑023 · Ремаунт сессии и черновик · (UX‑09, S2‑06)  
\*\*Файлы:\*\* \`calculator-modal-context.tsx\`, \`calculator-modal.tsx\`, \`wizard-step0-calculator.tsx\`, \`wizard-step2-summary.tsx\`.  
\*\*Сделать:\*\*  
1\. \`sessionId\` в контексте; \`openCalculator\` инкрементирует; \`\<WizardStep0Calculator key={sessionId}\>\`, \`\<WizardStep1Lighting key={sessionId}\>\`, \`\<WizardStep2Summary key={sessionId}\>\`; Шаг 2 монтируется только при \`currentStep \=== 2\`.  
2\. Черновик (\`rooms, scenario, cart\`) — в \`sessionStorage\` под ключом \`potolkovo:calc-draft:v2\`; при открытии с черновиком — экран «Продолжить прошлый расчёт (48 м², 72 000 ₽)? \[Продолжить\] \[Начать заново\]».  
3\. \`lead.submittedAt\` в контексте; после отправки confirm при закрытии не показывается; \`showResult\` живёт в контексте и сбрасывается \`openCalculator\`.  
4\. Текст confirm при наличии данных: см. T‑026 (rescue).  
\*\*Приёмка:\*\* e2e: отправить заявку → закрыть (без confirm) → открыть → форма доступна; открыть с другой страницы услуги → сценарий страницы применён.

\#\#\#\# T‑024 · Lighting‑first: pendingPrefill и защита корзины · (UX‑10, S1‑12 часть)  
\*\*Файлы:\*\* \`use-ceiling-calculator-engine.ts\`, \`wizard-step0-calculator.tsx\`, \`PriceCalculatorQuizV2.tsx\`, \`wizard-step1-lighting.tsx\`.  
\*\*Сделать:\*\* \`pendingLightingPrefill\` хранится в движке; применяется при \`addRoom/chooseCalcMode\` к активной комнате (если \`\!touched\`); экраны \`track\`/\`lights\` показывают «Из вашего набора: 10 м.п. трека COLIBRI, 6 спотов — учтено» и предвыбранные значения; эффект «Clear orphaned track products» не чистит корзину, если позиции пришли из lighting‑first (\`origin: "page"\`), а показывает предупреждение «Вы указали «без трека», но в наборе 10 м профиля — оставить?».  
\*\*Приёмка:\*\* vitest: lighting‑first → выбор комнаты → \`room.trackLength \=== 10\`, \`trackType \=== "built-in"\`; e2e: корзина не пустеет.

\#\#\#\# T‑025 · Аналитика по экранам квиза и Шага 1 · (MK‑05, S1‑13, LF‑05)  
\*\*Файлы:\*\* \`lib/analytics.ts\`, все экраны квиза, \`wizard-step1-lighting.tsx\`, \`action-form.tsx\`, \`calculator-modal.tsx\`.  
\*\*Сделать:\*\* реализовать схему Приложения В; вызовы: \`quiz\_screen\_view\` при каждом push/pop, \`quiz\_param\_confirm\`, \`quiz\_back\`, \`quiz\_summary\`, \`lighting\_step\_view\`, \`lighting\_system\_selected\`, \`lighting\_skip\`, \`lighting\_kit\_complete\`, \`lighting\_conflict\`, \`lighting\_search\` (дебаунс 800 мс), \`calculator\_close {step, screen, hasData}\`, \`lead\_submit {…}\`, \`lead\_rescue\_shown/accepted\`; параметр визита \`ym(…, "params", { calc\_total })\` при каждом \`quiz\_summary\`/\`lead\_submit\`.  
\*\*Приёмка:\*\* unit‑тест на обёртку \`ymReachGoal\` (мок \`window.ym\`) — все события вызываются с обязательными полями; в \`README\` — таблица целей для настройки в Метрике.

\#\#\#\# T‑026 · Rescue‑оффер и микро‑конверсии · (MK‑02, S2‑07)  
\*\*Файлы:\*\* \`calculator-modal.tsx\` (\`requestClose\`), \`components/ui/confirm-dialog.tsx\` (расширить до формы с полем), \`SummaryScreen.tsx\`, \`wizard-step2-summary.tsx\`, \`mobile-sticky-cta.tsx\`.  
\*\*Сделать:\*\*  
1\. Confirm при закрытии с данными: заголовок «Сохранить расчёт и получить его на телефон?», поле телефона, кнопки «Отправить» (→ \`/api/lead\` с \`lead\_kind: "rescue"\`) и «Просто закрыть». После отправленной заявки — не показывать.  
2\. После сводки Шага 0: блок «Получить этот расчёт в Telegram» → \`t.me/potolkovo\_msk?text=\` с компактным расчётом и \`leadId\` (после T‑027 лид создаётся со статусом \`draft\`).  
3\. Шаг 2: мессенджеры — \*\*после\*\* формы, с \`text=\` (Приложение Г); WhatsApp удалить, если владелец не подтвердит аккаунт (TODO в PR).  
4\. Стики‑бар после первой сводки: \`\[Рассчитать\] \[Telegram\] \[Позвонить\]\`.  
\*\*Приёмка:\*\* e2e: закрыть модалку с данными → диалог с полем → отправить → запрос \`lead\_kind=rescue\`.

\#\#\#\# T‑027 · \`/api/lead\`: БД, Telegram, Web3Forms‑дубль, ретраи · (MK‑04, LF‑02, S1‑14)  
\*\*Файлы:\*\* \`app/api/lead/route.ts\`, \`app/api/lead/retry/route.ts\`, \`lib/lead/schema.ts\` (zod), \`lib/lead/format-lead.ts\`, \`lib/lead/deliver-telegram.ts\`, \`lib/lead/deliver-web3forms.ts\`, \`src/db/schema.ts\` (или \`db/schema.ts\` проекта), \`lib/env.ts\`, \`.env.example\`, \`README.md\`.  
\*\*Сделать:\*\*  
1\. Схема БД (Приложение Б); миграция через \`drizzle-kit push\`.  
2\. zod‑схема payload (Приложение Б); нормализация телефона на сервере (\`lib/normalize-phone.ts\`); rate‑limit 5/10 мин/IP (in‑memory Map \+ проверка по БД \`created\_at \> now()-10min AND phone \= ?\` для дедупа).  
3\. \`format-lead.ts\`: тема \`Заявка · {intent} · \~{grand} ₽ · {name} · {phone}\`; тело — блоки «Контакт / Источник и атрибуция / Потолок по комнатам (узел · метры · ₽) / Монтаж света / Свет: таблица \`Артикул · Название · Кол‑во · Цена · Скидка\`, отдельно «Добавлено автоматически» / Итого». Один формат для Telegram (MarkdownV2/HTML) и письма (plain).  
4\. Telegram: \`TELEGRAM\_BOT\_TOKEN\`, \`TELEGRAM\_CHAT\_ID\`; при ошибке — запись в \`lead\_deliveries\` со статусом \`failed\`, ретрай из \`/api/lead/retry\` (защищён \`CRON\_SECRET\`).  
5\. Web3Forms — как дубль, ключ \*\*серверный\*\* \`WEB3FORMS\_ACCESS\_KEY\`; убрать \`NEXT\_PUBLIC\_WEB3FORMS\_ACCESS\_KEY\` из клиента, \`lib/data.ts\`, \`.env.example\` (оставить placeholder).  
6\. Ответ \`{ ok: true, leadId, callbackWindow: "сегодня до 21:00" | "завтра с 9:00" }\` — по \`contacts.workingHoursLabel\` и времени сервера (Europe/Moscow).  
7\. \`ActionForm\` → \`fetch("/api/lead")\`; при \`\!ok\` — «Не получилось отправить — позвоните {phone} или напишите в Telegram» \+ кнопки.  
8\. \`LightingItem\` расширить: \`vendorCode, system, kind, unit, auto\`.  
9\. Удалить \`actions/submit-lead.ts\`, \`actions/submit-lead-state.ts\`, \`lib/lead-provider.ts\`, \`TrackSaleActionForm.tsx\`.  
\*\*Приёмка:\*\* vitest на \`format-lead\` (snapshot‑тест текста для фикстуры «2 комнаты \+ свет»); интеграционный тест route (мок Telegram/Web3Forms): 201 \+ запись в БД; 6‑й запрос за 10 мин → 429; e2e: письмо содержит \`0У-\` для каждой позиции.

\#\#\#\# T‑028 · Копирайт Шага 2 и экран успеха по интенту · (S2‑05, S2‑06, S2‑08)  
\*\*Файлы:\*\* \`lib/calculator-flow.ts\` (\`resolveStep2Copy(intent)\`), \`wizard-step2-summary.tsx\`, \`action-form.tsx\`, \`calculator-modal.tsx\`.  
\*\*Сделать:\*\* таблица копирайта раздела 6.3; ProgressBar: «Потолок —», если Шаг 0 не пройден; для \`lighting\_only\` — поля «Получение: самовывоз / доставка» и «Когда удобно» (радио); экран успеха: «Заявка №{leadId} принята. Перезвоню {callbackWindow}. {phone} · \[Написать в Telegram\]»; одна сумма в hero \+ раскрытая таблица разбивки; удалить мобильную карточку‑дубль и «Общий ориентир по объекту»; в форме вместо «14 пунктов» — «К заявке приложу этот расчёт».  
\*\*Приёмка:\*\* e2e \`lighting\_only\`: заголовок формы «Получить счёт на комплект», нет «Монтаж за 1 день».

\#\#\#\# T‑029 · Вынести JSON фида из клиентского бандла · (EN‑02, S2‑09, S1‑20 часть, EN‑08)  
\*\*Файлы:\*\* \`app/providers.tsx\`, \`wizard-step0-calculator.tsx\`, \`wizard-step1-lighting.tsx\`, \`wizard-step2-summary.tsx\`, \`lighting-footer-progress.tsx\`, \`CatalogSection.tsx\`, \`LightKitShowcase.tsx\`, \`lib/home-proof-pricing.ts\`, новый \`lib/lighting/catalog-index.ts\`, \`scripts/build-catalog-index.mjs\`.  
\*\*Сделать:\*\*  
1\. \`scripts/build-catalog-index.mjs\` (в \`prebuild\`): из \`eks-feed2-snapshot.json\` формирует \`data/catalog-index.json\` (только \`productId, vendorCode, name, priceRub, available, system, kind, unit, pieceLengthMeters, socket, coverImage\` — цель ≤ 120 КБ) и \`data/catalog-prefill.json\` (\`sku → {kind, system, lengthMm}\` ≤ 20 КБ).  
2\. \`catalog-index.ts\`: \`getCatalogIndex(): Promise\<CatalogIndex\>\` через \`import("@/data/catalog-index.json")\`; мемоизация; серверные компоненты (\`LightKitShowcase\`, \`home-proof-pricing\`) читают полный фид на сервере.  
3\. \`CalculatorModal\` грузится \`import()\` внутри \`openCalculator\` (не при монтировании); кнопка‑инициатор в состоянии \`pending\` до готовности; \`ErrorBoundary\` вокруг модалки с текстом «Не получилось загрузить калькулятор — напишите в Telegram»; \`app/error.tsx\`, \`app/not-found.tsx\`.  
4\. Бюджет: \`next build\` → First Load JS главной ≤ 300 КБ; проверка в CI скриптом по \`.next/build-manifest.json\`/\`analyze\`.  
\*\*Приёмка:\*\* отчёт размера бандла в PR; grep \`eks-feed2-snapshot.json\` в \`components/\` → 0\.

\#\#\#\# T‑030 · Редьюсер‑движок и селекторы (первый этап) · (EN‑05, UX‑08, S2‑03, S1‑08)  
\*\*Файлы:\*\* \`lib/calculator/\*\` по 2.1, \`calculator-modal-context.tsx\`, \`PriceCalculatorQuizV2.tsx\`, \`calculator-modal.tsx\`, \`price-strip.tsx\`, \`lighting-footer-progress.tsx\`.  
\*\*Сделать:\*\*  
1\. Реализовать \`reducer.ts\` \+ \`selectors.ts\`; переписать \`PriceCalculatorQuizV2\` на \`useCalculator()\`; переходы — через \`fsm.ts\` (\`getNextScreen/getBackFallback\`), убрать if‑каскады; удалить 4 setter‑колбэка (\`onStep0FooterActionChange\` и т.п.) — модалка читает \`selectFooterAction/selectBackAction/selectProgress/selectSummaryReady\` из стора.  
2\. Один индикатор прогресса: 3 макро‑шага в шапке (\`nav\` \+ \`aria-current\`), внутри Шага 0 — тонкая полоска «вопрос N из M», где \`M \= maxParamsForScenario(scenario)\` фиксирован; удалить точки на мобильном.  
3\. \`selectRequirements(state)\` → \`{ track, trackFixtures (ориентир‑диапазон), points, lamps, accessories }\` — из него читают мастер Шага 1, футерный прогресс и Шаг 2; \`lighting-footer-progress.tsx\` не парсит фид сам.  
4\. \`selectTotals(state)\` — единственный источник для PriceStrip, сводки, Шага 2, стики‑бара, письма (\`grandTotal\` как поле удаляется окончательно).  
\*\*Приёмка:\*\* grep \`useEffect\\(\` с \`set\[A-Z\]\\w+\\(\` внутри в \`components/calculator-modal/\*\*\` → 0 (кроме навигационных/фокуса); vitest на reducer (Приложение Д список); все прежние e2e зелёные.

\#\#\#\# T‑031 · Единая корзина света для страницы и модалки · (LP‑02, S1‑22, S1‑12)  
\*\*Файлы:\*\* \`lib/lighting/use-lighting-cart.ts\`, \`components/lighting/LightingCatalog.tsx\` (новый общий UI), \`CatalogSectionClient.tsx\` → тонкая обёртка, \`wizard-step1-lighting.tsx\` → использует \`LightingCatalog\`, \`LightKitCtaButton.tsx\`.  
\*\*Сделать:\*\*  
1\. \`useLightingCart\` читает/пишет \`state.lighting.cart\` стора 2.1 (общий провайдер уже на уровне \`app/providers.tsx\`); \`snapshot.lighting\` больше не пишется эффектами — это \`selectLightingLead(state)\`.  
2\. Конфликт систем: \`conflicts(cart, product)\` → \`showConfirmDialog("Заменить систему CLARUS на COLIBRI? Будут убраны N позиций на X ₽")\`; отказ не меняет корзину. \`clearIncompatibleSystem\` — одна реализация в \`kit-rules.ts\`.  
3\. Комплект с карточки \`LightKitShowcase\` → \`applyKit(items)\` в ту же корзину; счётчики страницы и модалки — из одного селектора.  
4\. Мини‑корзина (drawer) на странице: список, ±, удалить, «Оформить».  
\*\*Приёмка:\*\* e2e: комплект → закрыть → «+» в каталоге страницы → счётчики равны, комплект на месте; CLARUS \+ тап COLIBRI → confirm, отказ не меняет корзину.

\#\#\#\# T‑032 · Рекомендации и автосборка профиля · (S1‑06)  
\*\*Файлы:\*\* \`lib/lighting/kit-rules.ts\` (\`profilesForMeters\` — перенос \`calcProfilesForTrackLength\` из \`lib/lighting-kits.ts\`), экраны \`trackProfile\`/\`trackFixtures\`.  
\*\*Сделать:\*\* карточка «Собрать автоматически: 3 м × 3 \+ 1 м × 1 \= 37 000 ₽ · с потолком 27 750 ₽» одним тапом; ниже — ручная корректировка; на экране светильников — «Ориентир для 10 м: 8–12 светильников» (по \`pricing.trackSpotsPerMeter\`, диапазон ±20 %) и кнопка «+8 таких».  
\*\*Приёмка:\*\* vitest \`profilesForMeters(10, "COLIBRI\_220") → \[{3m×3},{1m×1}\]\`; e2e: тап → прогресс 10/10 м.

\---

\#\#\# ФАЗА 2 — КОНВЕРСИЯ И ОФФЕР (1–2 недели). Цель: ясный оффер, один primary, полный комплект, страницы продают

\#\#\#\# T‑040 · Hero главной, H1/оффер, иерархия CTA, калькулятор в 1 клик · (MK‑01, UX‑15, UX‑16, UX‑17, MK‑06 часть)  
\*\*Файлы:\*\* \`content/homepage.ts → hero\`, \`components/home/home-hero.tsx\`, \`home-header.tsx\`, \`mobile-sticky-cta.tsx\`, \`proof-card.tsx\`, \`calculator-teaser.tsx\`.  
\*\*Сделать:\*\* тексты раздела 6.2; hero \= H1 \+ 1 подзаголовок \+ primary «Рассчитать за 2 минуты» (\`openCalculator({source:"home:hero"})\` напрямую) \+ текстовая ссылка «Записаться на замер» \+ строка фактов «5.0 на Avito · N отзывов · договор» \+ фото мастера (мобильный — в первом экране); удрать скидочные карточки, дублирующую строку отзывов, лишние чипы, 2 из 3 градиентов; хедер primary → калькулятор, рядом телефон; карточки работ «Хочу так же» → калькулятор с пресетом кейса; тизер остаётся в секции цены как органический вход.  
\*\*Приёмка:\*\* Lighthouse mobile hero: ≤ 1 primary CTA в viewport; e2e: клик hero → модалка открыта без промежуточного скролла.

\#\#\#\# T‑041 · Экраны квиза: язык клиента, слайдер, периметр, минус экран режима · (UX‑11, UX‑12, UX‑13, UX‑05, UX‑14)  
\*\*Файлы:\*\* \`quiz-v2/screens/ScenarioScreen.tsx\`, \`CalcModeScreen.tsx\` (удалить), \`ParamScreen.tsx\`, \`quiz-v2/ui.tsx\` (\`RangeField\`), \`content/homepage.ts\` (\`areaDefault\`), \`lib/perimeter-auto.ts\`.  
\*\*Сделать:\*\*  
1\. \`ScenarioScreen\`: карточки с картинкой и ценой раздела 6.1 \+ ссылка «Не знаю — помогите выбрать» (2 вопроса: «Хочется без плинтуса/с подсветкой?» и «Планируете треки или линии?» → сценарий).  
2\. Удалить \`CalcModeScreen\`; на экране площади переключатель «Считаю: комнату / весь объект» (дефолт — комната); «+ добавить помещение» на сводке.  
3\. \`RangeField\`: \`\<input type="range"\>\` \+ степпер 44 px \+ поле; управляемый компонент (без эффекта); быстрые значения \`10/12/15/18/20/25/30/40\`; \`areaDefault\` комната 18, объект 60\.  
4\. Периметр по умолчанию \`round(4·√area)\`; для теневого/парящего — переключатель «по всему периметру / частично» с полем метров.  
5\. Одна пара кнопок — в футере; из карточек убрать; вторичная ссылка «Пропустить» — в карточке.  
6\. Доступность: фокус на \`h3\` при смене экрана, \`aria-live="polite"\` на сумме, \`aria-label\` у степперов, подписи ≥ \`slate-500\`, \`✕\` → svg‑иконка с \`aria-label\`.  
7\. Шаги \`chandeliers/lights\`: префикс «Монтаж:» и подпись «Сами светильники подберём на следующем шаге со скидкой».  
\*\*Приёмка:\*\* e2e‑прогон квиза на 390 px без горизонтального скролла и без второго primary; axe 0 critical.

\#\#\#\# T‑042 · \`completeKit\`: питание, соединители, БП по мощности, ART‑разделение · (S1‑07, S1‑16 часть)  
\*\*Файлы:\*\* \`lib/lighting/kit-rules.ts\`, экраны мастера Шага 1, \`LightKitShowcase.tsx\`.  
\*\*Сделать:\*\* \`completeKit(cart, required) → { mandatory\[\], recommended\[\] }\` с обоснованием: \`feed \= 1 на трассу\`, \`straight \= pieces − corners − 1\`, \`psu \= ceil(ΣW × 1.2 / 200)\` (мощность из названия \`(\\d+)\\s\*W\`), лампы 1:1 по цоколю, платформы для ZOOM; блок «Комплектующие» с «Добавить всё»; для ART разделить «Шинопровод» и «Закладной профиль 8255» с пояснением; блокировать «К итогу», пока для CLARUS нет БП (или явная строка «БП подберём при звонке» с чекбоксом).  
\*\*Приёмка:\*\* vitest: CLARUS 12×18 W → psu 2; COLIBRI 4 отрезка, 1 угол → straight 2, feed 1; e2e: без БП «К итогу» показывает предупреждение.

\#\#\#\# T‑043 · Секции «Люстры» и «Подсветка карниза» на Шаге 1 · (S1‑16)  
\*\*Файлы:\*\* \`lib/catalog-ui-config.ts\` (\`CATALOG\_SECTIONS\`), \`LightingCatalog.tsx\`, \`lib/lighting/normalize.ts\` (классификация пультов).  
\*\*Сделать:\*\* секции включаются по ответам Шага 0 (\`chandeliersEnabled\`, \`corniceLightingEnabled\`); в мастере — экраны после точечных; пульты вынести из \`LED\_STRIP/PSU\` в \`CONTROL\`.  
\*\*Приёмка:\*\* e2e: квиз с 2 люстрами → на Шаге 1 есть экран «Люстры» с 16 позициями.

\#\#\#\# T‑044 · Одна ценовая подпись, баннер режима, карточки систем · (S1‑10, S1‑17, LP‑05, MK‑07)  
\*\*Файлы:\*\* \`LightingCatalog.tsx\` (\`ProductCard\`, \`SystemCard\`), \`CatalogSectionClient.tsx\`, \`TrackSaleSystemGuideSection.tsx\`.  
\*\*Сделать:\*\* баннер над сеткой «Цены со скидкой −25 % при заказе потолка» / «−10 % только свет»; карточка — одна цена \+ зачёркнутая базовая; карточки систем с фото узла, «от X ₽/м с светильниками» (считать из фида: самый дешёвый профиль 1 м \+ 1 светильник), 3 отличия (COLIBRI — встроенный 220 V, проще; CLARUS — 48 V магнитный, ультратонкий, нужен БП; ART — накладной, если потолок готов); вычитать копирайт (убрать «Точка», «Показываем все подходящие лампы…», «Кликните вне фото», эмодзи).  
\*\*Приёмка:\*\* на карточке ≤ 2 чисел; скриншот‑тест карточки системы.

\#\#\#\# T‑045 · Страница света: один бар корзины, интент, контент «как купить», FAQ, условия · (LP‑04, LP‑06, LF‑04 часть, UX‑19)  
\*\*Файлы:\*\* \`ServiceHero.tsx\` (ветка страницы света), \`CatalogSectionClient.tsx\`, \`TrackSaleOrderingSection.tsx\`, \`TrackSaleFaqSection.tsx\`, новый \`TrackSaleTermsSection.tsx\`, \`content/services.ts\` (тексты этой страницы по 6.5), \`page.tsx\`.  
\*\*Сделать:\*\*  
1\. Hero: primary «Собрать комплект» → \`\#price\`, secondary «Открыть в калькуляторе» → \`openCalculator(lighting-first)\`; удалить два «штампа −10 %/−25 %», оставить одну строку «−10 % на свет · −25 % при заказе потолка».  
2\. Один липкий бар «Корзина · N поз. · X ₽ \[Посмотреть\] \[Оформить\]»; «Оформить» → экран интента в модалке («Только оборудование −10 %» / «С потолком −25 %») → далее Шаг 2 или Шаг 0\.  
3\. Плашка над каталогом: «Цены и наличие по прайсу поставщика EKS Market на {updatedAt}; уточню перед счётом».  
4\. \`TrackSaleOrderingSection\`: два процесса — «Купить оборудование» (заявка → проверка наличия и счёт → оплата → самовывоз/доставка) и «С установкой» (замер → …); FAQ 8 вопросов (6.5); \`TrackSaleTermsSection\`: продавец, оплата, доставка, гарантия производителя, возврат.  
5\. Рендерить \`service.about\` и \`service.useCases\` этой страницы.  
\*\*Приёмка:\*\* на странице ≤ 3 разных primary‑формулировок; e2e мобильный checkout (T‑007) зелёный после рефакторинга.

\#\#\#\# T‑046 · Страницы услуг: контент, отзывы, FAQ, hero‑диета, честные примеры · (SV‑03, SV‑04, UX‑19, MK‑06, MK‑09 часть)  
\*\*Файлы:\*\* \`app/uslugi/\_components/ServiceHero.tsx\`, новые \`ServiceAboutSection.tsx\`, \`ServiceUseCasesSection.tsx\`, \`ServiceFaqSection.tsx\`, \`ServicePriceSection.tsx\`, \`ServiceRelatedServices.tsx\`, все \`app/uslugi/\*/page.tsx\`, \`content/services.ts\` (добавить \`faq: {q,a}\[\]\` для каждой услуги — тексты 6.6), \`components/home/home-header.tsx\`.  
\*\*Сделать:\*\*  
1\. Hero: H1 (без «в Москве и МО», это в title), подзаголовок, ценовой якорь крупно (\`formatFrom(pricing)\`), primary «Рассчитать с этим узлом» (калькулятор с пресетом), secondary «Записаться на замер» (\`\#action\`), 3 факта; убрать supportingText, строку телефона, бейдж региона (регион — в title/футере), бейдж «Услуга»; картинка ≤ 150 КБ (T‑061).  
2\. Секция цены: 1 абзац \+ якорь крупно \+ тизер; \`introNote\` — только внутри калькулятора.  
3\. Рендерить \`about\` (2 абзаца) и \`useCases\` (4 карточки) и \`benefits\` → FAQ‑аккордеон с \`FAQPage\` JSON‑LD; \`AvitoReviewsSection\` (3 карточки) на всех услугах; \`ServiceCompareSection\` — на теневом, парящем и простых.  
4\. Для \`individualnye-proekty\` и \`svetoprozrachnye-potolki\`: вместо трёх одинаковых фото — 1 фото \+ блок «Покажу примеры на замере: узлы, схемы, материалы» \+ ссылка на работы главной; \`ServiceProofImage.priceLabel\` — через \`buildProofBudgetBreakdown\` с раскрытием состава.  
5\. \`ServiceRelatedServices\`: карточка \= название \+ \`formatFrom\` \+ 1 строка описания из \`content\` (поле \`shortDescription\` добавить в \`service-links.ts\`).  
6\. Хедер на страницах услуг: пункт «О мастере» → \`/\#trust\` (главная), не локальный \`\#trust\`.  
\*\*Приёмка:\*\* 9 страниц содержат \`FAQPage\` JSON‑LD и блок отзывов; Lighthouse SEO ≥ 95; нет страниц с 4 одинаковыми \`\<img src\>\`.

\#\#\#\# T‑047 · Срочность/удобство и реквизиты · (MK‑08, LF‑04)  
\*\*Файлы:\*\* \`action-form.tsx\`, \`content/contacts.ts\` (\`legalName, inn, ogrnip\`), \`home-footer.tsx\`, \`app/privacy/page.tsx\`, \`content/legal.ts\`, \`content/availability.ts\` (новый, ручной календарь).  
\*\*Сделать:\*\* поле «Когда удобно» (сегодня до 21:00 / завтра утром / напишите в Telegram); чекбокс согласия; реквизиты в футере и политике; раздел «Cookies и аналитика (Яндекс.Метрика, вебвизор)» и абзац о передаче данных сервису доставки форм; «Свободные даты замера: чт, сб» из \`availability.ts\` в форме и на Шаге 2\. Данные реквизитов — placeholder \`TODO\_OWNER\` с проверкой в CI, что не пусто перед релизом (владелец заполняет).  
\*\*Приёмка:\*\* форма содержит согласие и «Когда удобно»; \`/privacy\` содержит разделы 8 «Cookies» и 9 «Реквизиты».

\---

\#\#\# ФАЗА 3 — ТЕХДОЛГ И КАЧЕСТВО (2–3 недели)

\#\#\#\# T‑060 · Удалить мёртвый/легаси код · (EN‑03, LP‑07, S1‑21, SV‑07)  
\*\*Удалить:\*\* \`components/home/price-calculator-client.tsx\` (V1, 4 417 строк) и флаг \`?quiz=v1\`; \`app/components/AiCeilingAdvisor.tsx\`, \`AiAdvisorTeaser.tsx\`, \`app/api/ceiling-advisor\`, \`lib/llm.ts\`, \`lib/prompts.ts\`; \`app/uslugi/\_components/ServicePageLayout.tsx\`; \`TrackSaleIntentSwitch/Context\`, \`TrackSaleActionSection\`, \`TrackSaleCatalogSection\`, \`TrackSaleDiscountSection\`, \`LightCustomSection\`; \`lib/lighting-kits.ts\` (режим \`kit\`, захардкоженные цены), \`calcRequiredWorksFromLighting/isPointFixtureSku\` из \`lib/lighting-formulas.ts\`, \`LightingMode \= "kit"\`, \`getKitDisplayName/kitId/kitName\`; \`homepage.promise.steps\` (дубль \`processSteps\`); \`lib/calculator-snapshot-guard.ts\` (не используется) или подключить; \`lib/mock.ts\` если не используется.  
\*\*Приёмка:\*\* \`npx knip\` или \`ts-prune\` → 0 неиспользуемых экспортов в \`lib/\` и \`components/\`; бандл главной ≤ 300 КБ подтверждён.

\#\#\#\# T‑061 · Пайплайн изображений · (UX‑21, EN‑07, S1‑15)  
\*\*Файлы:\*\* \`scripts/build-images.mjs\` (sharp), \`next.config.ts\`, \`components/ui/picture.tsx\` (новый), \`components/feed2/ProductImage.tsx\`, \`app/layout.tsx\`.  
\*\*Сделать:\*\* генерировать WebP/AVIF в ширинах 480/960/1440 для \`public/\*.jpeg\` в \`public/optimized/\`; \`\<Picture\>\` со \`srcset/sizes\` и \`blurDataURL\`; hero ≤ 150 КБ, кейсы ≤ 80 КБ; каталог: при сборке скачать \`coverImage\` → 256/512 WebP в \`public/catalog/{productId}.webp\`, при 404 — фото линейки (\`system\`) как фолбэк; \`width/height/decoding="async"\`; убрать \`JetBrains Mono\` (логотип — Inter с tracking); Метрика: \`webvisor\` только на главной и странице света; hero — один градиент.  
\*\*Приёмка:\*\* LCP mobile \< 2,5 с (Lighthouse CI, throttled 4G); 0 битых фото (скрипт проверки).

\#\#\#\# T‑062 · Единый \`lib/env.ts\` и конфиги · (EN‑06)  
\*\*Сделать:\*\* zod‑валидация env при старте (\`TELEGRAM\_\*\`, \`WEB3FORMS\_ACCESS\_KEY\`, \`DATABASE\_URL\`, \`CATALOG\_LIVE\_FEED2\_STRICT\` default \`0\`, \`CRON\_SECRET\`); синхронизировать \`.env.example\` (без реальных ключей); почистить \`amvera.yaml\` от шаблонных комментариев.

\#\#\#\# T‑063 · SEO: хаб \`/uslugi\`, Offer в схеме, \`lastModified\`, каннибализация · (MK‑09, SV‑07, LP‑08)  
\*\*Файлы:\*\* \`app/uslugi/page.tsx\` (новый), \`lib/seo-schema.ts\`, \`app/sitemap.ts\`, \`content/services.ts\` (\`updatedAt\` для каждой услуги, title/H1 двух трековых страниц по 6.7), \`page.tsx\` страницы света.  
\*\*Сделать:\*\* хаб с карточками и \`formatFrom\`; \`Service.offers \= { "@type": "Offer", priceCurrency: "RUB", priceSpecification: { "@type": "UnitPriceSpecification", minPrice, unitText } }\`; \`ItemList\` \+ \`Product/Offer\` для 3 комплектов и топ‑12 товаров страницы света; \`lastModified\` из \`content\`; развести title/H1 «монтаж» vs «купить».

\#\#\#\# T‑064 · Дизайн‑токены и кнопки · (UX‑20, S1‑18, LP‑09)  
\*\*Файлы:\*\* \`app/globals.css\` (\`@theme\`: \`--radius-sm/md/lg\`, \`--color-accent\` как primary), \`components/ui/button.tsx\` (3 размера 40/48/56, 3 варианта primary/secondary/ghost), точечные замены \`rounded-\*\`/\`text-\[..px\]\` в \`components/calculator-modal/\*\*\` и \`app/uslugi/\*\*\`.  
\*\*Сделать:\*\* primary CTA и выбранное состояние — акцент \`\#2563eb\`; slate — текст/бордеры; табы каталога \`role="tablist"/tab\`, зум фото — \`\<button\>\`, степперы 44 px, \`aria-live\` на суммах, \`prefers-reduced-motion\` для \`animate-fade-in\`.

\#\#\#\# T‑065 · Глобальный поиск по каталогу · (S1‑19)  
\*\*Сделать:\*\* поиск по всем секциям с группировкой результатов, запрос сохраняется при смене секции, fade‑край у горизонтальных чипов, подсказка «Найдено в разделе «Треки»: 3».

\---

\#\#\# ФАЗА 4 — CI И РЕГРЕСС (параллельно с фазами 1–3, финализируется последней)

\#\#\#\# T‑090 · Тестовая инфраструктура и CI · (EN‑04)  
\*\*Сделать:\*\*  
1\. \`vitest\` (\`npm run test\`), \`@playwright/test\` (\`npm run test:e2e\`, проект \`chromium\` desktop 1280 \+ mobile 390); \`tsconfig.json\` — \`exclude: \["scripts/\*\*/\*.test.ts", "e2e/\*\*"\]\` или отдельный \`tsconfig.e2e.json\`; типизировать движок (\`V2RoomConfig\` вместо \`any\`), убрать \`setState\` в эффекте \`RangeField\`.  
2\. \`.github/workflows/ci.yml\`: \`lint → tsc → test → validate-catalog → build → e2e (на build) → bundle-budget → gitleaks\` на PR и push в \`quizv2\`.  
3\. Скрипт \`scripts/check-bundle-budget.mjs\` (главная ≤ 300 КБ First Load JS).  
\*\*Приёмка:\*\* зелёный CI на PR.

\#\#\#\# T‑091 · Набор регрессионных тестов (обязательный минимум)  
\*\*vitest (\`lib/\*\*\`):\*\* Приложение Д.  
\*\*Playwright smoke (\`e2e/\*\*\`):\*\*  
1\. Главная → hero «Рассчитать» → квиз стандартный → 18 м² → 6 точек → сводка → «К итогу» → форма → успех (перехват \`/api/lead\`, проверка payload).  
2\. Главная → «Современный» → теневой 17 м.п. → «Подобрать свет −25 %» → Шаг 1 открыт на \`system\` → COLIBRI → «Собрать автоматически» 10 м → комплектующие «Добавить всё» → «К итогу» → сумма сходится.  
3\. \`/uslugi/tenevoy-profil\` → hero primary → квиз с теневым профилем и 22 м² предзаполнены → сводка.  
4\. \`/uslugi/skrytye-karnizy\` → форма без калькулятора → успех, \`source=skrytye-karnizy\`.  
5\. Страница света 390 px → «+» товар → бар корзины → «Оформить» → «Только оборудование» → Шаг 2 с копирайтом buy‑only → успех.  
6\. Страница света → комплект «Для кухни» → «С потолком» → квиз → комната → трек предзаполнен 3 м → Шаг 1 не спрашивает трек заново.  
7\. 2 комнаты × 6 точек → Шаг 1 требует 12 → Шаг 2 \`extra \= 0\`.  
8\. Закрыть модалку с данными → rescue‑диалог → отправить телефон → \`lead\_kind=rescue\`.  
9\. Отправить → закрыть без confirm → открыть → форма доступна; черновик предлагается.  
10\. \`/\#price\` → hash сохранён; \`/uslugi\` хаб отдаёт 200 и содержит 9 карточек.

\---

\#\# 4\. Контракты данных

\#\#\# 4.1. \`RoomConfig\` (без изменений полей V2 \+ новые)  
\`\`\`ts  
type RoomConfig \= V2RoomConfig & {  
  shadowPerimeterMode: "full" | "partial";  
  floatingPerimeterMode: "full" | "partial";  
};  
\`\`\`  
\#\#\# 4.2. \`LightingCartItem\`  
\`\`\`ts  
type LightingCartItem \= { productId: string; vendorCode: string; name: string; qty: number; priceRub: number;  
  system: "COLIBRI\_220"|"CLARUS\_48"|"TRACK\_220"|"OTHER"; kind: ProductKind; unit: "pcs"|"m";  
  auto?: "lamp"|"mount"|"psu"|"feed"|"connector"; origin: "modal"|"page"|"kit" };  
\`\`\`  
\#\#\# 4.3. \`Totals\` (селектор)  
\`\`\`ts  
type Totals \= { ceilingRaw: number; minimumApplied: boolean; ceiling: number; installIncluded: { points: number; trackMeters: number; rub: number };  
  installExtra: { points: number; trackMeters: number; rub: number }; lightingRegular: number; lightingDiscountPct: 0|10|25;  
  lightingEffective: number; grand: number };  
\`\`\`  
Инвариант (тест): \`grand \=== ceiling \+ installExtra.rub \+ lightingEffective\`.

\---

\#\# 5\. Правила и формулы (единые)

\- Периметр по умолчанию: \`round(4 · √area)\`; частичный — ввод пользователя, ≤ полного × 1.2.  
\- Минимальный заказ: \`ceiling \= max(Σrooms, 18 000)\`; в UI одна сумма \+ пояснение.  
\- Скидка на свет: 25 % если Шаг 0 подтверждён (есть комната с \`area \> 0\` и \`ceiling \> 0\`) \*\*и\*\* пользователь не убрал потолок после; 10 % — \`entryMode lighting-first\` без потолка; иначе 0 %. Сброс eligibility при удалении всех комнат.  
\- Досчёт монтажа: только сверх Σ по комнатам; уменьшение количества на Шаге 1 → предложение «Обновить количество на потолке?» (запись обратно \`updateRoom\`).  
\- Требования света: \`points \= Σ lightsCount\`, \`trackMeters \= Σ trackLength (trackType ≠ none)\`, \`trackFixtures \= ориентир \[floor(m×0.8), ceil(m×1.2)\]\` — не блокирует.  
\- Комплектность: \`feed ≥ 1\` на трассу; \`straight \= max(0, pieces − corners − 1)\`; \`psu \= ceil(ΣW × 1.2 / P\_psu)\`; лампы 1:1 для светильников без лампы; платформы 1:1 для ZOOM.  
\- Конфликт систем — только через confirm; ничего не удаляется молча.

\---

\#\# 6\. Контент и копирайт (готовые тексты)

\#\#\# 6.1. Квиз  
\- Экран сценария: \*\*«Какой потолок вам нужен?»\*\*  
  1\. «Ровный белый потолок без изысков» — «от 1 000 ₽/м²» — фото матового полотна  
  2\. «Дизайнерский: без плинтуса, с подсветкой, треками или линиями» — «от 1 750 ₽/м²» — фото теневого узла  
  3\. «Умный свет и сложная геометрия» — «обсудим лично, ориентир посчитаем» — фото трека CLARUS  
  Ссылка: «Не знаю — помогите выбрать».  
\- Минимальный заказ: «Минимальный заказ — 18 000 ₽. В него уже входит выезд, замер, полотно и монтаж небольшой комнаты».  
\- Предзаполнение: «Стартовые параметры со страницы: {список}. Измените под свой объект».  
\- Lighting‑first: «Из вашего набора: {m} м.п. трека {system}, {n} светильников — учтено в монтаже».  
\- Шаги света на Шаге 0: «Монтаж точечных светильников», «Монтаж люстр» \+ «Сами светильники подберём на следующем шаге со скидкой».

\#\#\# 6.2. Главная (hero)  
\- H1: \*\*«Теневые и парящие потолки под ключ — делаю сам, смета фиксируется до монтажа»\*\*  
\- Подзаголовок: «От 1 000 ₽/м² · ориентир за 2 минуты в калькуляторе · 5.0 на Avito»  
\- Primary: «Рассчитать за 2 минуты» · Secondary (ссылка): «Записаться на замер»  
\- Факты: «5.0 на Avito · {N} отзывов · договор и гарантия 2 года»  
\- Подпись к фото: «Владимир. 1 объект \= 1 мастер, без бригад‑подрядчиков»

\#\#\# 6.3. Шаг 2 по интенту  
| Интент | Заголовок формы | Кнопка | Чипы | «Что дальше» |  
|---|---|---|---|---|  
| \`ceiling\_only\` / \`lighting\_with\_ceiling\` | «Записаться на бесплатный замер» | «Записаться на замер» | Договор · Гарантия 2 года · Монтаж за 1 день · Уборка после | 1\. Перезвоню {callbackWindow} 2\. Бесплатный замер, фиксирую смету 3\. Договор, монтаж за 1 день |  
| \`lighting\_only\` | «Получить счёт на комплект» | «Получить счёт» | Проверю совместимость · Наличие и цена перед счётом · Гарантия производителя | 1\. Перезвоню {callbackWindow} 2\. Проверю наличие и пришлю счёт 3\. Самовывоз или доставка |  
| \`advanced\` | «Обсудить проект» | «Обсудить проект» | Схема света · Смета до монтажа · Личное ведение | 1\. Перезвоню {callbackWindow} 2\. Обсудим сценарии света 3\. Замер и смета |  
| \`direct\` (page‑форма) | заголовок секции | «Записаться на замер» | как для потолка | — |

Экран успеха: «Заявка №{leadId} принята. Перезвоню {callbackWindow}. Если удобнее написать — Telegram». Ошибка: «Не получилось отправить заявку. Позвоните {phone} или напишите в Telegram — отвечу быстро».

\#\#\# 6.4. Ошибки формы  
\- Имя: «Как к вам обращаться?» · Телефон: «Проверьте номер — нужно 10 цифр после \+7» · Адрес: «Слишком длинно — достаточно района или метро».

\#\#\# 6.5. Страница света  
\- H1: «Трековое освещение COLIBRI, CLARUS и ART — купить отдельно или с натяжным потолком»  
\- Подзаголовок: «Соберу совместимый комплект: профиль, светильники, питание, лампы. −10 % на свет, −25 % при заказе потолка»  
\- FAQ (8): как действует скидка; актуальны ли цены и наличие; как оплатить; как получить (самовывоз/доставка, сроки); гарантия на оборудование; можно ли вернуть; чем отличаются COLIBRI/CLARUS/ART; нужен ли блок питания.  
\- Условия: продавец (реквизиты), оплата по счёту после подтверждения наличия, доставка по Москве/МО или самовывоз, гарантия производителя 1–2 года по позиции, возврат согласно ЗоЗПП для дистанционной торговли.

\#\#\# 6.6. FAQ услуг (по 5 на страницу, шаблон)  
«Сколько стоит {узел} за м.п. и что входит», «Подходит ли под мои стены/высоту», «Сколько занимает монтаж», «Можно ли совместить с {смежный узел}», «Как фиксируется смета». Ответы — из \`about\`/\`benefits\` текущего контента, без новых обещаний.

\#\#\# 6.7. Разведение трековых страниц  
\- \`/uslugi/trekovoe-osveshchenie\`: title «Монтаж трекового освещения в натяжной потолок — Москва и МО», H1 «Встроенный трек в натяжном потолке: профиль под гарпун, монтаж за 1 день».  
\- \`/uslugi/prodazha-trekovogo-osveshcheniya\`: title «Купить трековое освещение COLIBRI, CLARUS, ART в Москве — подбор комплекта», H1 по 6.5.

\---

\#\# 7\. Definition of Done (проект)

\- Все задачи фаз 0–4 закрыты, CI зелёный, \`knip\` без мусора.  
\- Ручной чек‑лист (заполняется в PR последней фазы):  
  \- \[ \] 4 точки входа (hero главной, карточка кейса, страница услуги, страница света) ведут в калькулятор с корректным пресетом/сценарием  
  \- \[ \] Суммы на PriceStrip, сводке, Шаге 1, Шаге 2, стики‑баре и в письме совпадают (одна фикстура — один результат)  
  \- \[ \] Лид приходит в Telegram ≤ 5 с и на почту; содержит артикулы, комнаты, сценарий, источник‑страницу, итог  
  \- \[ \] Формы главной и услуг работают без калькулятора  
  \- \[ \] Мобильный checkout со страницы света работает; один нижний бар  
  \- \[ \] Ни одной отладочной подписи, enum в UI, «мёртвой» кнопки  
  \- \[ \] Lighthouse mobile главной: Performance ≥ 80, LCP \< 2,5 с, JS ≤ 300 КБ до открытия калькулятора  
  \- \[ \] Метрика: цели из Приложения В настроены (список в README)  
  \- \[ \] Реквизиты, cookies, условия продажи опубликованы (или PR помечен «ждёт владельца» с перечнем)

\---

\#\# Приложение А. Соответствие находок задачам

| Находка | Задача |  
|---|---|  
| UX‑01 | T‑003 · UX‑02 | T‑021 · UX‑03 | T‑022 · UX‑04 | T‑004, T‑020 · UX‑05 | T‑041 · UX‑06 | T‑005 · UX‑07 | T‑005 · UX‑08 | T‑030 · UX‑09 | T‑023 · UX‑10 | T‑024 · UX‑11 | T‑041 · UX‑12 | T‑041 · UX‑13 | T‑041 · UX‑14 | T‑041, T‑064 · UX‑15 | T‑040 · UX‑16 | T‑040 · UX‑17 | T‑040 · UX‑18 | T‑006 · UX‑19 | T‑045, T‑046 · UX‑20 | T‑064 · UX‑21 | T‑061 |  
| MK‑01 | T‑040 · MK‑02 | T‑026 · MK‑03 | T‑022, T‑027 · MK‑04 | T‑027 · MK‑05 | T‑025 · MK‑06 | T‑040, T‑046 · MK‑07 | T‑020, T‑044 · MK‑08 | T‑047 · MK‑09 | T‑063, T‑046 |  
| EN‑01 | T‑001 · EN‑02 | T‑029 · EN‑03 | T‑060 · EN‑04 | T‑090 · EN‑05 | T‑030, T‑022 · EN‑06 | T‑062 · EN‑07 | T‑061 · EN‑08 | T‑029 |  
| S1‑01 | T‑010 · S1‑02 | T‑009 · S1‑03 | T‑011 · S1‑04 | T‑012 · S1‑05 | T‑013 · S1‑06 | T‑032 · S1‑07 | T‑042 · S1‑08 | T‑030 · S1‑09 | T‑041 · S1‑10 | T‑044 · S1‑11 | T‑009 · S1‑12 | T‑031, T‑024 · S1‑13 | T‑025 · S1‑14 | T‑027 · S1‑15 | T‑061 · S1‑16 | T‑043 · S1‑17 | T‑044 · S1‑18 | T‑064 · S1‑19 | T‑065 · S1‑20 | T‑029, T‑030, T‑031 · S1‑21 | T‑060 · S1‑22 | T‑031 |  
| S2‑01 | T‑002 · S2‑02 | T‑009 · S2‑03 | T‑008, T‑030 · S2‑04 | T‑022 · S2‑05 | T‑028 · S2‑06 | T‑023, T‑028 · S2‑07 | T‑026 · S2‑08 | T‑028 · S2‑09 | T‑029 |  
| LF‑01 | T‑002 · LF‑02 | T‑027 · LF‑03 | T‑015 · LF‑04 | T‑047, T‑045 · LF‑05 | T‑025 |  
| LP‑01 | T‑007 · LP‑02 | T‑031 · LP‑03 | T‑014, T‑042 · LP‑04 | T‑045 · LP‑05 | T‑044, T‑061 · LP‑06 | T‑045 · LP‑07 | T‑060 · LP‑08 | T‑063 · LP‑09 | T‑064 |  
| SV‑01 | T‑002, T‑021 · SV‑02 | T‑020, T‑021 · SV‑03 | T‑046 · SV‑04 | T‑046, T‑061 · SV‑05 | T‑021 · SV‑06 | T‑002 · SV‑07 | T‑001, T‑060, T‑063 |

\#\# Приложение Б. БД и payload лида

\`\`\`sql  
create table leads (  
  id            bigserial primary key,  
  public\_code   text not null unique,              \-- короткий код для Telegram‑ссылок, напр. "K7F3Q"  
  created\_at    timestamptz not null default now(),  
  status        text not null default 'new',       \-- new | draft | rescue | contacted | closed  
  lead\_kind     text not null,                     \-- direct | calculator | lighting-only | rescue  
  order\_intent  text not null,                     \-- ceiling\_only | lighting\_with\_ceiling | lighting\_only | advanced  
  name          text, phone text not null, address text, preferred\_time text,  
  source        text not null, placement text not null, page\_path text, service\_slug text,  
  attribution   jsonb not null default '{}',       \-- utm\_\*, yclid, gclid, first\_landing, first\_referrer  
  snapshot      jsonb,                             \-- LeadSnapshotV2  
  totals        jsonb,                             \-- Totals  
  grand\_total   integer,  
  ip\_hash text, user\_agent text  
);  
create index leads\_phone\_created\_idx on leads (phone, created\_at desc);

create table lead\_deliveries (  
  id bigserial primary key,  
  lead\_id bigint not null references leads(id) on delete cascade,  
  channel text not null,          \-- telegram | web3forms  
  status text not null,           \-- pending | sent | failed  
  attempts int not null default 0,  
  last\_error text, sent\_at timestamptz, created\_at timestamptz not null default now()  
);  
\`\`\`

\`\`\`ts  
const LeadPayload \= z.object({  
  name: z.string().trim().min(1).max(80),  
  phone: z.string().transform(normalizePhone).refine(isValidPhone),  
  address: z.string().trim().max(160).optional(),  
  preferredTime: z.enum(\["today", "tomorrow\_morning", "telegram"\]).optional(),  
  consent: z.literal(true),  
  botcheck: z.literal("").optional(),  
  source: z.string().max(64), placement: z.enum(\["home","service-page","modal","rescue","sticky"\]),  
  pagePath: z.string().max(200), serviceSlug: z.string().max(64).optional(),  
  leadKind: z.enum(\["direct","calculator","lighting-only","rescue"\]),  
  orderIntent: z.enum(\["ceiling\_only","lighting\_with\_ceiling","lighting\_only","advanced"\]),  
  attribution: z.record(z.string().max(200)).default({}),  
  snapshot: LeadSnapshotV2Schema.optional(),  
  totals: TotalsSchema.optional(),  
});  
\`\`\`

\#\# Приложение В. Схема событий Метрики

| Событие | Параметры |  
|---|---|  
| \`calculator\_open\` | \`source\`, \`entry\_mode\`, \`has\_draft\` |  
| \`quiz\_screen\_view\` | \`screen\`, \`param\`, \`index\`, \`total\`, \`scenario\` |  
| \`quiz\_param\_confirm\` | \`param\`, \`value\`, \`room\_index\` |  
| \`quiz\_back\` | \`from\` |  
| \`quiz\_summary\` | \`total\`, \`rooms\`, \`scenario\`, \`minimum\_applied\` |  
| \`lighting\_step\_view\` | \`wstep\`, \`required\_track\_m\`, \`required\_points\` |  
| \`lighting\_system\_selected\` | \`system\` |  
| \`lighting\_skip\` | \`from\` |  
| \`lighting\_kit\_complete\` | \`items\`, \`total\`, \`auto\_items\`, \`system\` |  
| \`lighting\_conflict\` | \`from\`, \`to\`, \`removed\_total\`, \`confirmed\` |  
| \`lighting\_search\` | \`q\`, \`section\`, \`results\` |  
| \`lighting\_cart\_changed\` | \`items\`, \`total\` (дебаунс) |  
| \`wizard\_step\_view\` | \`step\`, \`source\` |  
| \`calculator\_close\` | \`step\`, \`screen\`, \`has\_data\`, \`lead\_sent\` |  
| \`lead\_rescue\_shown\` / \`lead\_rescue\_accepted\` | \`total\` |  
| \`form\_opened\` | \`placement\`, \`source\` |  
| \`lead\_submit\` | \`placement\`, \`lead\_kind\`, \`order\_intent\`, \`grand\_total\`, \`rooms\`, \`lighting\_items\`, \`source\`, \`page\_path\`, \`lead\_id\` |  
| \`lead\_error\` | \`kind\` (validation/network/server/ratelimit), \`placement\` |  
| \`messenger\_click\` | \`messenger\`, \`placement\`, \`with\_context\` |  
| Параметры визита | \`calc\_total\`, \`calc\_scenario\`, \`lead\_total\` |

\#\# Приложение Г. Deep‑link в Telegram

\`https://t.me/potolkovo\_msk?text=\` \+ \`encodeURIComponent("Здравствуйте\! Расчёт №K7F3Q с сайта: 2 комнаты, 48 м², теневой 17 м.п., трек COLIBRI 10 м, свет 21 008 ₽, итого \~72 000 ₽. Хочу уточнить.")\` — длина ≤ 300 символов; если \`leadId\` нет — без номера.

\#\# Приложение Д. Обязательные vitest

\`pricing.calcRoom\` (все узлы, теневой+парящий, подсветка с БП) · \`calcTotals\` (минимальный заказ, multi‑room, \`installExtra\` 0/положительный, инвариант grand) · \`presetToRoom\` (9 slug) · \`fsm\` (next/back/progress фиксированный M, переключение сценария из экрана ceiling) · \`reducer\` (open/reset session, addRoom, updateRoom, applyPrefill с touched, confirm/prefilled, submit lead) · \`selectRequirements\` (Σ по комнатам, trackMountType) · \`kit-rules.completeKit\` (feed/straight/psu/lamps/mounts) · \`kit-rules.conflicts\` · \`profilesForMeters\` · \`normalize.detectSocket\` (MR‑16/GU10/GX53) · \`product-length-meters\` (кириллица «мм», габариты A\*B\*C) · покрытие каталога (все товары достижимы) · \`validate-catalog\` (whitelist ⊂ фид) · \`format-lead\` (snapshot текста) · \`resolveLightingDiscountMode\` · \`resolveStep2Copy\` · \`analytics\` обёртки.

