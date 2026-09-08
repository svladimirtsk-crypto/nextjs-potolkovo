/**
 * N-060 · Проверяемые факты для текстов услуг (F-38).
 *
 * Пункт 3 ТЗ требует минимум два конкретных числа на услугу: клиент верит
 * «зазор 6–8 мм» и не верит «современно и аккуратно». Но выдуманное число
 * хуже общей фразы — его проверят на замере.
 *
 * Поэтому все числа собраны здесь, в одном месте, и разделены на два вида:
 *   `confirmed` — берутся из прайса или из фида, проверяются тестом;
 *   `pending`   — типовые для рынка, владелец подтверждает или правит.
 *
 * Пока факт в `pending`, он всё равно попадает в тексты: пустое место на
 * странице хуже приблизительной правды. Но список `PENDING_OWNER_REVIEW`
 * ниже — готовый чек-лист, что именно проверить перед публикацией.
 */
import { pricing } from "@/content/pricing";

/** Число, которое можно назвать клиенту. */
export type ServiceFact = {
  /** Как факт звучит в тексте. */
  text: string;
  /** Откуда он взялся — это и есть основание ему верить. */
  source: "pricing" | "owner-pending";
};

const fromPricing = (text: string): ServiceFact => ({ text, source: "pricing" });
const pending = (text: string): ServiceFact => ({ text, source: "owner-pending" });

/**
 * Факты по услугам.
 *
 * Ключ — слаг страницы. Порядок внутри массива соответствует порядку
 * упоминания в тексте.
 */
export const serviceFacts: Record<string, ServiceFact[]> = {
  "tenevoy-profil": [
    pending("зазор 6–8 мм"),
    fromPricing(`от ${pricing.ceiling.shadowProfilePerM} ₽ за погонный метр профиля`),
    pending("монтаж за один день при площади до 30 м²"),
    pending("гарантия 2 года"),
  ],

  "paryashchie-potolki": [
    fromPricing(`от ${pricing.ceiling.floatingProfilePerM} ₽ за погонный метр профиля`),
    pending("светящийся контур шириной 10–15 мм"),
    pending("монтаж за один день при площади до 30 м²"),
    pending("гарантия 2 года"),
  ],

  "svetovye-linii": [
    fromPricing("от 3 500 ₽ за погонный метр линии"),
    pending("ширина линии 35–75 мм в зависимости от профиля"),
    pending("гарантия 2 года"),
  ],

  "trekovoe-osveshchenie": [
    fromPricing("от 2 500 ₽ за погонный метр встроенного трека"),
    fromPricing("от 1 500 ₽ за погонный метр накладного"),
    pending("запас по высоте под встроенный профиль — от 50 мм"),
    pending("гарантия 2 года"),
  ],

  "skrytye-karnizy": [
    fromPricing("от 1 000 ₽ за погонный метр накладного карниза"),
    fromPricing("ниша под карниз — от 1 800 ₽, встроенный вариант — от 4 500 ₽"),
    pending("глубина ниши 150–200 мм под две шторы"),
    pending("гарантия 2 года"),
  ],

  "prostye-potolki": [
    fromPricing("от 1 000 ₽ за м²"),
    fromPricing(`минимальный заказ ${pricing.minimumOrderRub.toLocaleString("ru-RU")} ₽`),
    pending("монтаж за один день при площади до 30 м²"),
    pending("гарантия 2 года"),
  ],

  "individualnye-proekty": [
    pending("срок от двух дней: сначала каркас и крепления, затем полотно"),
    pending("гарантия 2 года"),
  ],

  "prodazha-trekovogo-osveshcheniya": [
    fromPricing(
      `скидка ${pricing.lightingDiscount.lightingOnlyPct} % на оборудование и ${pricing.lightingDiscount.withCeilingPct} % при заказе с потолком`
    ),
    pending("доставка по Москве и МО в течение 1–3 дней"),
  ],

  "svetoprozrachnye-potolki": [
    fromPricing("от 4 000 ₽ за м²"),
    pending("равномерное свечение без пятен при высоте камеры от 150 мм"),
    pending("гарантия 2 года"),
  ],
};

/**
 * Чек-лист владельцу: числа, которые я взял как типовые для рынка.
 * Каждое нужно либо подтвердить, либо заменить своим.
 */
export const PENDING_OWNER_REVIEW = Object.entries(serviceFacts).flatMap(([slug, facts]) =>
  facts.filter((fact) => fact.source === "owner-pending").map((fact) => `${slug}: ${fact.text}`)
);
