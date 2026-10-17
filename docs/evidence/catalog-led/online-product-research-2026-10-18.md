# EKS · исследование открытых источников по LED-ассортименту

**Дата проверки:** 18.10.2026 (Москва). **Статус:** открытые карточки/листинг; не паспортные испытания и не подтверждение условий продажи. Источник полного реестра: [`online-product-evidence-2026-10-18.json`](online-product-evidence-2026-10-18.json). Сверка с архивным XML EKS от 14.10.2026: [`eks-feed.xml`](../catalog-led-audit/eks-feed.xml) и [`led-strip-profiles.json`](led-strip-profiles.json).

## Итог и ограничения проверки

- В [живом разделе LED EKS](https://eksmarket.ru/catalog/svetodiodnaya-lenta/) и на [его второй странице](https://eksmarket.ru/catalog/svetodiodnaya-lenta/filter/clear/apply/?PAGEN_1=2&SIZEN_1=36) перечислены **72 из 72** ранее зафиксированных SKU: 36 лент, 19 БП, 8 контроллеров, 6 пультов, 3 комплекта. Для всех 72 совпали SKU, ссылка, написание названия (после нормализации пробелов) и отображаемая сумма в рублях с локальным профилем, составленным по XML EKS от 14.10; это не доказывает, что суммы не изменятся позже.
- **14** карточек контроллеров и пультов проверены в HTML: блок «Характеристики» содержит только штрихкод и «Термостойкость: Нет», ссылок на PDF/документы в товарной части нет. Ещё **7** карточек лент/БП/комплектов открыты отдельно через `fetch_page`: `УУ-00007636`, `УУ-00007639`, `УУ-00007668`, `УУ-00007670`, `УУ-00007671`, `УУ-00007681`, `УУ-00007839`. У лент встречается некорректно заполненный «УИД» с фрагментом описания, но не паспортные данные. Для **51** остальных доступен листинг; при попытке массовой детализации карточки 58 SKU ответили HTTP 503, семь из них позже удалось открыть через инструмент страниц. Отсутствие документа у этих 51 не доказано. **Паспортов конкретных EKS LED SKU в проверенных карточках/точечном веб-поиске не найдено**; не превращать это в утверждение, что паспортов не существует вообще.
- Видимые цены **не снабжены явной единицей** «за метр / катушку / штуку»: совпадение суммы на карточке и в фиде не разрешает `priceUnit`. «5 м» в названии ленты — длина катушки; «25шт», «80шт», «200шт» в названиях БП/контроллеров **не равны** автоматически `packQty` заказа или `MOQ`. Сопоставление с собственной витриной показывает расхождение цен за м — см. [`supplier-request.md`, §2](supplier-request.md); без ответа EKS это не коммерческий факт.
- Напряжение, мощность, ССТ, число диодов и тип в таблице ниже — **сведения из названия** (уровень `title_only`). «6W» / «22W» без паспорта нельзя переименовать в «Вт/м» как подтверждённый факт; расчёт `wattsPerReel` / `ampsPerReel` из профиля остаётся модельной гипотезой. Цифра на странице не подтверждает IP, CRI, световой поток, шаг реза, охлаждение БП или RF-пары. Ни один SKU не повышен до `datasheet_verified`.

### Показательные карточки

| Артикул | Что открыто у EKS | Что не подтвердилось |
|---|---|---|
| [УУ-00007639](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-64-dioda-6w-2700k-katushka-5-m-chz_1/) | СТАНДАРТ 140, 24V, 64 диода, 6W, 2700К, 5 м; 970 ₽ | Единица 970 ₽, Вт/м, ширина, резка, IP, CRI |
| [УУ-00007636](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-240-diodov-22w-2700k-katushka-5-m-chz_1/) | ПРО 160, 24V, 240 диодов, 22W, 2700К, 5 м; 2 890 ₽ | Паспортная Вт/м и монтажные ограничения |
| [УУ-00007668](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-cct-24v-120-diodov-10-8w-2700-6500k-katushka-5-m-chz_1/) | CCT, 24V, 120 диодов, 10,8W, 2700–6500К, 5 м; 2 140 ₽ | Потребление на тёплом/холодном канале и режимы одновременной работы |
| [УУ-00007670](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-rgbw-24v-60-dioda-14-4w-katushka-5-m-chz_1/) | RGBW, 24V, 60 диодов, 14,4W, 5 м; 3 500 ₽ | Нагрузка белого канала и суммарная мощность по режимам |
| [УУ-00007671](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-mini-24v-72w-80sht-chz_1/) | БП МИНИ 24V 72W, «80шт» в названии; 860 ₽ | Выходной ток/тип CV, derating, защита, размер продаваемой упаковки |
| [УУ-00007681](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-360w-25sht-chz_1/) | БП ПРО 24V 360W, «25шт» в названии; 4 220 ₽ | Derating в закрытой полости, условия охлаждения и MOQ |
| [УУ-00007839](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-s-kontrolerom-dlya-svetodiodnoy-lenty-cct-1-kanal-dc12-24v-eks6a-2-50sht-chz_1/) | Комплект CCT «1 канал» DC12–24V EKS6A*2, «50шт»; 1 806 ₽ | Значение «1 канал» (RF-зона или силовой канал), нагрузка, pairing, размер продажной упаковки |

**WB5 — особенно важно не подменять модель.** [Карточка EKS `0У-00006564`](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-wifi-tuya-5v1-wb5-15a-12-24v-200sht/) показывает WiFi/Tuya, 5в1, 12–24В, 15А в названии, 2 500 ₽. На [фотографии наклейки EKS](https://eksmarket.ru/upload/iblock/9cd/kz1vnfnfhkisikl1fhyw2u0nrtbjb081.png) читается **6 A/канал и суммарно максимум 15 A** (статус `label_observed`, а не паспорт). В найденном [1](https://www.superlightingled.com/PDF/SPEC/WB5.pdf) PDF стороннего WB5 указано **3 A/канал** и иной стек управления (Bluetooth/RF). Совпадение надписи «WB5» **не устанавливает идентичность изделия EKS**: применять сторонний PDF к EKS, включая схему сопряжения и защиту, нельзя. Для всех WiFi-контроллеров сохраняется согласованная формулировка «подтверждено владельцем на его комплекте»; это не интернет-доказательство и не паспорт каждого SKU. Слова владельца «5в1 работает со всеми лентами» относятся к режимам, но не снимают ограничения 6 A/канал и 15 A суммарно с наклейки или необходимость паспортной проверки.

**Общая статья EKS** [«Как подобрать блок питания…»](https://eksmarket.ru/blog/kak-podobrat-blok-pitaniya-dlya-svetodiodnoy-lenty/) советует учитывать напряжение, мощность и дополнительные нагрузки; она не даёт паспортных коэффициентов derating конкретных 19 БП. Если показывать `P_req = P_led × 1,30` как методическую предосторожность калькулятора, не выдавать её за подтверждённый EKS паспортный запас.

## Открытые вопросы поставщику / последствия для продукта

1. По **каждой** ленте: паспортная мощность Вт/м по режимам, шаг резки, ширина, IP, CRI/лм, максимальная длина питания, теплоотвод/профиль; у CCT/RGBW — ток по каждому каналу.
2. По каждому БП: CV/CC, реальный выходной ток, диапазон входа, защита, IP, температура, допустимая закрытая установка и derating при ней.
3. По контроллерам/пультам/наборам: пределы **на канал и суммарно**, ограничение входного разъёма, схема клемм, совместимые RF-модели по SKU, число зон отдельно от силовых каналов, алгоритм pairing и поведение при потере WiFi/питания; не заменять данными похожих устройств.
4. По всем 72 позициям: `priceUnit` («за 1 м», «за катушку 5 м», «за 1 шт.»), продаваемый `packQty`, кратность заказа и `MOQ`. Количество штук в конце названия может относиться к транспортному коробу; только EKS может подтвердить назначение.
5. До получения официальных ответов/паспортов **не размечать LED BOM как verified**, сохранять `needs_review` на неясной электрике и цене; не выводить цену за метр из показанной суммы как установленный факт. Полный первоначальный список вопросов — [`supplier-request.md`](supplier-request.md).

## Реестр всех артикулов

Каждый артикул ниже — ссылка на текущую карточку в официальном разделе. **₽ = сумма в публичном списке, НЕ подтверждённая единица цены.** Статусы: `HTML` — просмотрены HTML-карточка и блок характеристик; `текст` — карточка открыта через инструмент страниц; `список` — SKU/ссылка/название/сумма подтверждены листингом, подробную карточку после HTTP 503 не проверяли. Во всех случаях инженерный уровень остаётся не выше `title_only` (кроме отдельного фото этикетки WB5/C01RF со статусом `label_observed`).

### Светодиодные ленты · 36

| Артикул | Название EKS | Видимая сумма, ₽ | Проверка |
|---|---|---:|---|
| [УУ-00007624](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-112-diodov-10w-2700k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 112 диодов 10W 2700К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007625](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-112-diodov-10w-4200k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 112 диодов 10W 4200К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007626](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-112-diodov-10w-6500k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 112 диодов 10W 6500К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007627](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-128-diodov-12w-2700k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 128 диодов 12W 2700К катушка 5 м ЧЗ | 1 600 | список |
| [УУ-00007628](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-128-diodov-12w-4200k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 128 диодов 12W 4200К катушка 5 м ЧЗ | 1 600 | список |
| [УУ-00007629](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-128-diodov-12w-6500k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 128 диодов 12W 6500К катушка 5 м ЧЗ | 1 600 | список |
| [УУ-00007630](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-176-diodov-16w-2700k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 176 диодов 16W 2700К катушка 5 м ЧЗ | 2 140 | список |
| [УУ-00007631](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-176-diodov-16w-4200k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 176 диодов 16W 4200К катушка 5 м ЧЗ | 2 140 | список |
| [УУ-00007632](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-176-diodov-16w-6500k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 176 диодов 16W 6500К катушка 5 м ЧЗ | 2 140 | список |
| [УУ-00007633](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-192-diodov-18w-2700k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 192 диодов 18W 2700К катушка 5 м ЧЗ | 2 470 | список |
| [УУ-00007634](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-192-diodov-18w-4200k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 192 диодов 18W 4200К катушка 5 м ЧЗ | 2 470 | список |
| [УУ-00007635](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-192-diodov-18w-6500k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 192 диодов 18W 6500К катушка 5 м ЧЗ | 2 470 | список |
| [УУ-00007636](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-240-diodov-22w-2700k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 240 диодов 22W 2700К катушка 5 м ЧЗ | 2 890 | текст |
| [УУ-00007637](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-240-diodov-22w-4200k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 240 диодов 22W 4200К катушка 5 м ЧЗ | 2 890 | список |
| [УУ-00007638](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-pro-160-24v-240-diodov-22w-6500k-katushka-5-m-chz_1/) | Светодиодная лента ПРО 160 24V 240 диодов 22W 6500К катушка 5 м ЧЗ | 2 890 | список |
| [УУ-00007639](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-64-dioda-6w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V  64 диода 6W 2700К катушка 5 м ЧЗ | 970 | текст |
| [УУ-00007640](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-64-dioda-6w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V  64 диода 6W 4200К катушка 5 м ЧЗ | 970 | список |
| [УУ-00007643](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-64-dioda-6w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V  64 диода 6W 6500К катушка 5 м ЧЗ | 970 | список |
| [УУ-00007645](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-112-diodov-10w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 2700К катушка 5 м ЧЗ | 1 230 | список |
| [УУ-00007646](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-112-diodov-10w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 4200К катушка 5 м ЧЗ | 1 230 | список |
| [УУ-00007648](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-112-diodov-10w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 112 диодов 10W 6500К катушка 5 м ЧЗ | 1 230 | список |
| [УУ-00007650](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-128-diodov-12w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 128 диодов 12W 2700К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007652](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-128-diodov-12w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 128 диодов 12W 4200К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007655](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-128-diodov-12w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 128 диодов 12W 6500К катушка 5 м ЧЗ | 1 400 | список |
| [УУ-00007656](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-176-diodov-16w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 176 диодов 16W 2700К катушка 5 м ЧЗ | 1 880 | список |
| [УУ-00007658](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-176-diodov-16w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 176 диодов 16W 4200К катушка 5 м ЧЗ | 1 880 | список |
| [УУ-00007660](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-176-diodov-16w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 176 диодов 16W 6500К катушка 5 м ЧЗ | 1 880 | список |
| [УУ-00007662](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-192-dioda-18w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 192 диода 18W 2700К катушка 5 м ЧЗ | 2 040 | список |
| [УУ-00007663](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-192-dioda-18w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 192 диода 18W 4200К катушка 5 м ЧЗ | 2 040 | список |
| [УУ-00007664](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-192-dioda-18w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 192 диода 18W 6500К катушка 5 м ЧЗ | 2 040 | список |
| [УУ-00007665](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-240-diodov-22w-2700k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 240 диодов 22W 2700К катушка 5 м ЧЗ | 2 360 | список |
| [УУ-00007666](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-240-diodov-22w-4200k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 240 диодов 22W 4200К катушка 5 м ЧЗ | 2 360 | список |
| [УУ-00007667](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-standart-140-24v-240-diodov-22w-6500k-katushka-5-m-chz_1/) | Светодиодная лента СТАНДАРТ 140 24V 240 диодов 22W 6500К катушка 5 м ЧЗ | 2 360 | список |
| [УУ-00007668](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-cct-24v-120-diodov-10-8w-2700-6500k-katushka-5-m-chz_1/) | Светодиодная лента CCT 24V 120 диодов 10.8W 2700-6500K катушка 5 м ЧЗ | 2 140 | текст |
| [УУ-00007669](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-rgb-24v-60-dioda-14-4w-katushka-5-m-chz_1/) | Светодиодная лента RGB 24V 60 диода 14,4W катушка 5 м ЧЗ | 1 930 | список |
| [УУ-00007670](https://eksmarket.ru/catalog/svetodiodnaya-lenta/svetodiodnaya-lenta-rgbw-24v-60-dioda-14-4w-katushka-5-m-chz_1/) | Светодиодная лента RGBW 24V 60 диода 14,4W катушка 5 м ЧЗ | 3 500 | текст |

### Блоки питания · 19

| Артикул | Название EKS | Видимая сумма, ₽ | Проверка |
|---|---|---:|---|
| [УУ-00007671](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-mini-24v-72w-80sht-chz_1/) | Блок питания МИНИ 24V  72W 80шт ЧЗ | 860 | текст |
| [УУ-00007672](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-mini-24v-100w-80sht-chz_1/) | Блок питания МИНИ 24V 100W 80шт ЧЗ | 970 | список |
| [УУ-00007673](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-mini-24v-150w-60sht-chz_1/) | Блок питания МИНИ 24V 150W 60шт ЧЗ | 1 550 | список |
| [УУ-00007674](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-mini-24v-200w-60sht-chz_1/) | Блок питания МИНИ 24V 200W 60шт ЧЗ | 1 620 | список |
| [УУ-00007675](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-60w-48sht-chz_1/) | Блок питания ПРО 24V  60W 48шт ЧЗ | 1 140 | список |
| [УУ-00007676](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-100w-36sht-chz_1/) | Блок питания ПРО 24V 100W 36шт ЧЗ | 1 420 | список |
| [УУ-00007677](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-150w-36sht-chz_1/) | Блок питания ПРО 24V 150W 36шт ЧЗ | 1 910 | список |
| [УУ-00007678](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-200w-36sht-chz_1/) | Блок питания ПРО 24V 200W 36шт ЧЗ | 2 444 | список |
| [УУ-00007679](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-250w-25sht-chz_1/) | Блок питания ПРО 24V 250W 25шт ЧЗ | 2 886 | список |
| [УУ-00007680](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-300w-25sht-chz_1/) | Блок питания ПРО 24V 300W 25шт ЧЗ | 3 330 | список |
| [УУ-00007681](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-360w-25sht-chz_1/) | Блок питания ПРО 24V 360W 25шт ЧЗ | 4 220 | текст |
| [УУ-00007682](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-400w-25sht-chz_1/) | Блок питания ПРО 24V 400W 25шт ЧЗ | 4 552 | список |
| [УУ-00007683](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-pro-24v-500w-30sht-chz_1/) | Блок питания ПРО 24V 500W 30шт ЧЗ | 5 660 | список |
| [УУ-00007684](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-60w-120sht-chz_1/) | Блок питания СТАНДАРТ 24V  60W 120шт ЧЗ | 1 000 | список |
| [УУ-00007685](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-100w-120sht-chz_1/) | Блок питания СТАНДАРТ 24V 100W 120шт ЧЗ | 1 366 | список |
| [УУ-00007686](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-150w-80sht-chz_1/) | Блок питания СТАНДАРТ 24V 150W 80шт ЧЗ | 1 766 | список |
| [УУ-00007687](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-200w-80sht-chz_1/) | Блок питания СТАНДАРТ 24V 200W 80шт ЧЗ | 2 088 | список |
| [УУ-00007688](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-250w-45sht-chz_1/) | Блок питания СТАНДАРТ 24V 250W 45шт ЧЗ | 2 730 | список |
| [УУ-00007689](https://eksmarket.ru/catalog/svetodiodnaya-lenta/blok-pitaniya-standart-24v-300w-45sht-chz_1/) | Блок питания СТАНДАРТ 24V 300W 45шт ЧЗ | 2 842 | список |

### Контроллеры · 8

| Артикул | Название EKS | Видимая сумма, ₽ | Проверка |
|---|---|---:|---|
| [0У-00006557](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-monokhrom-c01rf-12a-12-24v-200sht/) | Контроллер для светодиодной ленты монохром C01RF 12A, 12-24В, 200шт | 920 | HTML |
| [0У-00006558](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-wifi-tuya-monokhrom-c01-15a-12-24v-200sht/) | Контроллер для светодиодной ленты WIFI TUYA монохром C01 15A, 12-24В, 200шт | 2 230 | HTML |
| [0У-00006559](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-cct-c02rf-12a-12-24v-200sht/) | Контроллер для светодиодной ленты CCT C02RF 12A, 12-24В, 200шт | 920 | HTML |
| [0У-00006560](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-wifi-tuya-cct-c02-15a-12-24v-200sht/) | Контроллер для светодиодной ленты WIFI TUYA CCT C02 15A,12-24В, 200шт | 2 230 | HTML |
| [0У-00006561](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-rgb-c03rf-12a-12-24v-200sht/) | Контроллер для светодиодной ленты RGB C03RF 12A, 12-24В, 200шт | 920 | HTML |
| [0У-00006562](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-wifi-tuya-rgb-c03-15a-12-24v-200sht/) | Контроллер для светодиодной ленты WIFI TUYA RGB C03 15A,12-24В, 200шт | 2 230 | HTML |
| [0У-00006563](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-5v1-lm051-15a-12-24v-200sht/) | Контроллер для светодиодной ленты 5в1 LM051 15A, 12-24В, 200шт | 1 660 | HTML |
| [0У-00006564](https://eksmarket.ru/catalog/svetodiodnaya-lenta/kontroller-dlya-svetodiodnoy-lenty-wifi-tuya-5v1-wb5-15a-12-24v-200sht/) | Контроллер для светодиодной ленты WIFI TUYA 5в1 WB5 15A,12-24В, 200шт | 2 500 | HTML |

### Пульты · 6

| Артикул | Название EKS | Видимая сумма, ₽ | Проверка |
|---|---|---:|---|
| [0У-00006551](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-monokhrom-4-kanala-rc01rf-belyy-12-24v-100sht/) | Пульт для светодиодной ленты монохром 4 канала RC01RF белый, 12-24В, 100шт | 1 640 | HTML |
| [0У-00006552](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-monokhrom-4-kanala-rc01rf-chernyy-12-24v-100sht/) | Пульт для светодиодной ленты монохром 4 канала RC01RF черный, 12-24В, 100шт | 1 640 | HTML |
| [0У-00006553](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-cct-4-kanala-rc02rf-belyy-12-24v-100sht/) | Пульт для светодиодной ленты CCT 4 канала RC02RF белый, 12-24В, 100шт | 1 650 | HTML |
| [0У-00006554](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-cct-4-kanala-rc02rf-chernyy-12-24v-100sht/) | Пульт для светодиодной ленты CCT 4 канала RC02RF черный, 12-24В, 100шт | 1 650 | HTML |
| [0У-00006555](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-rgb-4-kanala-rc03rf-belyy-12-24v-100sht/) | Пульт для светодиодной ленты RGB 4 канала RC03RF белый, 12-24В, 100шт | 1 650 | HTML |
| [0У-00006556](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-dlya-svetodiodnoy-lenty-rgb-4-kanala-rc03rf-chernyy-12-24v-100sht/) | Пульт для светодиодной ленты RGB 4 канала RC03RF черный, 12-24В, 100шт | 1 650 | HTML |

### Комплекты · 3

| Артикул | Название EKS | Видимая сумма, ₽ | Проверка |
|---|---|---:|---|
| [УУ-00007839](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-s-kontrolerom-dlya-svetodiodnoy-lenty-cct-1-kanal-dc12-24v-eks6a-2-50sht-chz_1/) | Пульт с контролером для светодиодной ленты CCT 1 канал DC12-24В EKS6A*2, 50шт ЧЗ | 1 806 | текст |
| [УУ-00007840](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-s-kontrolerom-dlya-svetodiodnoy-lenty-rgb-1-kanal-dc12-24v-eks6a-3-50sht-chz_1/) | Пульт с контролером для светодиодной ленты RGB 1 канал DC12-24В EKS6A*3, 50шт ЧЗ | 1 806 | список |
| [УУ-00007841](https://eksmarket.ru/catalog/svetodiodnaya-lenta/pult-s-kontrolerom-dlya-svetodiodnoy-lenty-monokhrom-1-kanal-dc12-24v-eks6a-2-50sht-chz_1/) | Пульт с контролером для светодиодной ленты монохром 1 канал DC12-24В EKS6A*2, 50шт ЧЗ | 1 798 | список |

---

Связанные ограничения: [`supplier-request.md`](supplier-request.md), [`led-strip-profiles.md`](led-strip-profiles.md). Эти материалы сохраняют статус `title_only`/`label_observed`; поиск не менял паспортные данные или формулы в коде.
