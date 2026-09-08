/**
 * N-032 · Входы в калькулятор со страницы услуги и аргументы кросс-селла
 * (F-36, F-37).
 *
 * Правило ТЗ v2 п. 0.4 разрешает менять `content/*.ts` только в N-002, N-030,
 * N-040 и N-060, поэтому ни `actionPreset`, ни `reason` не дописываются в
 * контент. Оба выводятся из того, что там уже есть: площадь примера лежит в
 * `areaLabel`, а выгода связки однозначно определяется парой услуг.
 */
import type { ServiceCalculatorPreset } from "@/content/services";

/** «18 м²», «24 м²» → 18, 24. null, если площадь не указана числом. */
export function parseAreaLabel(areaLabel: string): number | null {
  const match = areaLabel.replace(",", ".").match(/\d+(\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Пресет для кнопки «Хочу так же» на карточке примера.
 *
 * За основу берётся пресет самой страницы (он задаёт тип потолка и узлы),
 * а площадь подменяется на площадь конкретного примера — именно она делает
 * расчёт «таким же».
 */
export function proofItemPreset(
  pagePreset: ServiceCalculatorPreset,
  areaLabel: string
): ServiceCalculatorPreset {
  const area = parseAreaLabel(areaLabel);
  return area === null ? pagePreset : { ...pagePreset, areaDefault: area };
}

/**
 * Почему эти услуги берут вместе.
 *
 * Ключ — пара «страница → смежная услуга». Кросс-селл без аргумента это
 * просто список ссылок: клиент видит цену, но не понимает, зачем ему второе.
 */
const PAIR_REASONS: Record<string, string> = {
  "tenevoy-profil|trekovoe-osveshchenie":
    "Одна закладная под профиль и трек — свет не придётся вешать на стену",
  "tenevoy-profil|svetovye-linii":
    "Теневой шов и световая линия делаются в один заход по одному уровню",
  "tenevoy-profil|skrytye-karnizy":
    "Карниз прячется в тот же зазор — окно без короба и видимых креплений",
  "paryashchie-potolki|svetovye-linii":
    "Парящий контур и линия питаются от одного блока — меньше проводки",
  "paryashchie-potolki|trekovoe-osveshchenie":
    "Подсветка по периметру плюс направленный свет там, где он нужен",
  "paryashchie-potolki|skrytye-karnizy":
    "Светящийся контур и карниз образуют единую линию по периметру",
  "svetovye-linii|trekovoe-osveshchenie":
    "Линия даёт общий свет, трек — акценты: вместе закрывают всю комнату",
  "svetovye-linii|tenevoy-profil":
    "Линия в теневом потолке выглядит как прорезь — без видимых рамок",
  "trekovoe-osveshchenie|tenevoy-profil":
    "Трек утапливается в теневой профиль заподлицо с потолком",
  "trekovoe-osveshchenie|svetovye-linii":
    "Трек и линия на одном уровне — свет читается как единая система",
  "skrytye-karnizy|tenevoy-profil":
    "Ниша под карниз и теневой шов собираются одним профилем",
  "skrytye-karnizy|trekovoe-osveshchenie":
    "Карниз и трек уходят в один короб — окно и свет без лишних линий",
  "skrytye-karnizy|paryashchie-potolki":
    "Подсветка карниза и парящий контур дают мягкий свет по периметру",
  "prostye-potolki|tenevoy-profil":
    "Теневой шов вместо плинтуса — тот же потолок, но выглядит дороже",
  "prostye-potolki|trekovoe-osveshchenie":
    "Самый дешёвый способ получить хороший свет — простой потолок плюс трек",
  "prostye-potolki|svetovye-linii":
    "Ровное полотно — лучший фон для световой линии",

  "tenevoy-profil|paryashchie-potolki":
    "Теневой по периметру и парящий контур над зоной — один монтаж, один выезд",
  "tenevoy-profil|prostye-potolki":
    "Теневой в гостиной, простой в спальнях — экономия без потери вида в главной комнате",
  "paryashchie-potolki|tenevoy-profil":
    "Парящий контур над зоной и теневой шов по остальному периметру",
  "svetovye-linii|paryashchie-potolki":
    "Линия и светящийся контур собираются из одного профиля и одной ленты",
  "trekovoe-osveshchenie|skrytye-karnizy":
    "Трек и карниз прячутся в общую нишу — с пола не видно ни того, ни другого",
  "trekovoe-osveshchenie|prostye-potolki":
    "Простой потолок плюс трек — самый дешёвый способ получить хороший свет",
  "skrytye-karnizy|svetovye-linii":
    "Подсветка карниза и линия работают от одного блока питания",
  "skrytye-karnizy|prostye-potolki":
    "Ниша под карниз делается в обычном потолке без удорожания полотна",
  "prostye-potolki|paryashchie-potolki":
    "Парящий контур превращает простой потолок в акцент — без смены полотна",
  "prostye-potolki|skrytye-karnizy":
    "Скрытый карниз добавляет к простому потолку главное — чистое окно",
  "individualnye-proekty|tenevoy-profil":
    "В сложных проектах теневой шов заменяет плинтус на любой геометрии",
  "individualnye-proekty|paryashchie-potolki":
    "Парящие контуры хорошо ложатся на многоуровневые формы",
  "individualnye-proekty|svetovye-linii":
    "Линии задают рисунок потолка, когда обычной люстры недостаточно",
  "individualnye-proekty|trekovoe-osveshchenie":
    "Трек даёт свободу света там, где расстановку мебели ещё не решили",
  "prodazha-trekovogo-osveshcheniya|svetovye-linii":
    "Линия для общего света, трек для акцентов — одна система на комнату",
  "prodazha-trekovogo-osveshcheniya|trekovoe-osveshchenie":
    "Оборудование со скидкой плюс монтаж под ключ — одна ответственность",
  "prodazha-trekovogo-osveshcheniya|prostye-potolki":
    "Закажете потолок вместе со светом — оборудование идёт со скидкой 25 %",
  "svetoprozrachnye-potolki|paryashchie-potolki":
    "Светопрозрачная вставка и парящий контур дают ровный рассеянный свет",
  "svetoprozrachnye-potolki|svetovye-linii":
    "Линии дешевле светопрозрачного полотна, а эффект свечения похожий",
  "svetoprozrachnye-potolki|prostye-potolki":
    "Светящаяся вставка в зоне и простой потолок вокруг — разумный бюджет",
};

/**
 * Аргумент связки. null — общего довода нет, и лучше промолчать,
 * чем подставить универсальную фразу: она обесценит остальные.
 */
export function relatedServiceReason(
  fromSlug: string,
  toSlug: string
): string | null {
  return PAIR_REASONS[`${fromSlug}|${toSlug}`] ?? null;
}

/**
 * N-060 · Название услуги в винительном падеже для кнопки расчёта (F-34).
 *
 * Primary звучал «Рассчитать с этим узлом» — слово из словаря монтажника,
 * которое клиенту ничего не говорит. Теперь кнопка называет то, ради чего
 * человек пришёл: «Рассчитать теневой потолок».
 *
 * Падежи заданы явно: автоматически склонять русские словосочетания —
 * отдельная задача, а список услуг закрытый и меняется раз в год.
 */
const CTA_OBJECT: Record<string, string> = {
  "tenevoy-profil": "теневой потолок",
  "paryashchie-potolki": "парящий потолок",
  "svetovye-linii": "световые линии",
  "trekovoe-osveshchenie": "трек в потолке",
  "skrytye-karnizy": "скрытый карниз",
  "prostye-potolki": "простой потолок",
  "individualnye-proekty": "проект",
  "svetoprozrachnye-potolki": "светопрозрачный потолок",
  "prodazha-trekovogo-osveshcheniya": "комплект света",
};

/**
 * Подпись главной кнопки страницы услуги.
 *
 * Для незнакомого слага — нейтральное «Рассчитать стоимость»: лучше общая
 * формулировка, чем кнопка с пустым местом посередине.
 */
export function serviceCtaLabel(slug: string): string {
  const object = CTA_OBJECT[slug];
  return object ? `Рассчитать ${object}` : "Рассчитать стоимость";
}
