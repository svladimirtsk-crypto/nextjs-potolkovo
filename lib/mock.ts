// file: lib/mock.ts
//
// Mock-ответы, имитирующие экспертную консультацию.
// Используются при MOCK_AI=true или при ошибке API.

import type {
  RoomSelectionOutput,
  TechQuestionOutput,
  ComputedContext,
} from "./types";


export function getMockRoomSelection(ctx: ComputedContext): RoomSelectionOutput {
  const isTrack = ctx.recommendedLighting.toLowerCase().includes("трек");
  const isLines = ctx.recommendedLighting.toLowerCase().includes("линии") || ctx.recommendedLighting.toLowerCase().includes("линейн");
  const isShadow = ctx.recommendedProfile.toLowerCase().includes("теневой");

  // Формируем экспертный summary в зависимости от решения
  let summary: string;
  if (ctx.isWetRoom) {
    summary = `Для ${ctx.roomLabel.toLowerCase()} рекомендую влагостойкое матовое полотно — оно не боится конденсата и перепадов температуры. ${isShadow ? "Теневой профиль здесь отлично работает: нет плинтуса, который собирает влагу и желтеет." : "Профиль с маскировочной лентой — практичный вариант для влажной среды."} Потеря высоты составит ${ctx.heightLossRange}${isTrack ? ", трековое освещение возможно при использовании светильников с защитой IP44" : ""}.`;
  } else if (isTrack) {
    summary = `Для вашего помещения (${ctx.roomLabel.toLowerCase()}) хорошо подойдёт связка: ${isShadow ? "теневой профиль" : "стандартный профиль"} с встроенным магнитным треком. Трек даёт направленный свет, который можно перестраивать без инструментов — удобно, если переставите мебель. Потеря высоты: ${ctx.heightLossRange}.`;
  } else if (isLines) {
    summary = `Световые линии — сильное решение для ${ctx.roomLabel.toLowerCase()}. Они полностью заменяют точечники и люстру, дают равномерный свет без теней. ${isShadow ? "В сочетании с теневым профилем получится чистый современный потолок без лишних элементов." : ""} Потеря высоты: ${ctx.heightLossRange} — важно учесть при расчёте.`;
  } else {
    summary = `Для ${ctx.roomLabel.toLowerCase()} рекомендую ${ctx.recommendedTexture.split("(")[0].trim().toLowerCase()} полотно с ${isShadow ? "теневым профилем — чистые линии без плинтуса" : "классическим профилем — надёжно и экономично"}. ${ctx.recommendedLighting.split("(")[0].trim()} обеспечат комфортное освещение. Потеря высоты: ${ctx.heightLossRange}.`;
  }

  // Причины, привязанные к контексту
  const whyItFits: string[] = [];
  if (isShadow) whyItFits.push("Теневой профиль убирает плинтус — стены выглядят выше, а потолок чище. Особенно заметно при неровных стенах.");
  if (isTrack) whyItFits.push("Магнитный трек позволяет менять направление и количество спотов без демонтажа потолка.");
  if (isLines) whyItFits.push("Световые линии заменяют все точечные светильники — один источник, равномерный свет, проще в обслуживании.");
  if (ctx.isWetRoom) whyItFits.push("Влагостойкое полотно не провисает от конденсата и легко протирается.");
  whyItFits.push(`Потеря высоты ${ctx.heightLossRange} — оптимальный баланс между функционалом и сохранением объёма помещения.`);
  if (whyItFits.length < 3) whyItFits.push("Выбранная комбинация проверена на десятках объектов в Москве и МО.");

  // Нюансы
  const whatToConsider: string[] = [
    "Точная стоимость зависит от количества углов, труб и сложности геометрии — всё считается на замере.",
  ];
  if (ctx.compatibilityNotes.length > 0) {
    whatToConsider.push(ctx.compatibilityNotes[0]);
  }
  if (ctx.warnings.length > 0) {
    whatToConsider.push(ctx.warnings[0]);
  }
  whatToConsider.push("Расположение и мощность светильников рассчитываю индивидуально — чтобы света хватало для жизни, а не только для красоты.");

  return {
    scenario: "room-selection",
    intent: "подбор потолка и освещения",
    quickSummary: summary,
    recommendedSolution: {
      ceilingType: "Натяжной потолок",
      texture: ctx.recommendedTexture,
      profile: ctx.recommendedProfile,
      lighting: ctx.recommendedLighting,
      heightLoss: ctx.heightLossRange,
    },
    whyItFits,
    whatToConsider,
    priceOptions: [
      {
        name: ctx.budgetRanges.basic.label,
        priceFrom: ctx.estimatedTotalBasic,
        description: ctx.budgetRanges.basic.description,
      },
      {
        name: ctx.budgetRanges.optimal.label,
        priceFrom: ctx.estimatedTotalOptimal,
        description: ctx.budgetRanges.optimal.description,
      },
      {
        name: ctx.budgetRanges.premium.label,
        priceFrom: ctx.estimatedTotalPremium,
        description: ctx.budgetRanges.premium.description,
      },
    ],
    nextStep:
      "Запишитесь на бесплатный замер — приеду, замерю помещение и рассчитаю точную стоимость с учётом всех нюансов. На месте покажу образцы полотен и профилей.",
  };
}

import type { TechQuestionInput, TechContext, TechQuestionOutput } from "./types";

export function getMockTechQuestion(): TechQuestionOutput {
  return {
    scenario: "tech-question",
    intent: "технический вопрос по натяжному потолку",
    shortAnswer:
      "Да, это реализуемо. Конкретное решение зависит от высоты потолка, типа конструкции и выбранного освещения. Ниже — два рабочих варианта, которые я чаще всего применяю на практике.",
    recommendedOptions: [
      {
        name: "Стандартное решение с минимальной потерей высоты",
        description:
          "Обычный гарпунный профиль (потеря 3–4 см) с точечными светильниками GX53 толщиной 25 мм. Подходит для помещений с высотой от 240 см. Монтаж за 1 день, бюджетно и практично.",
      },
      {
        name: "Современное решение с трековым или линейным светом",
        description:
          "Теневой профиль + встроенный магнитный трек или световые линии. Потеря высоты 6–8 см, но визуально потолок кажется выше за счёт чистых линий без плинтуса. Требует высоты от 260 см для комфортного результата.",
      },
    ],
    whatToConsider: [
      "Точная потеря высоты определяется на замере: зависит от перепада плиты, разводки проводки и типа светильников.",
      "Для встроенных треков нужна закладная из фанеры — это стандартная процедура, входит в стоимость монтажа.",
      "Если в помещении есть трубы отопления или короба вентиляции, обход рассчитывается отдельно.",
    ],
    estimatedImpact: {
      heightLoss: "от 3 до 8 см — зависит от выбранной конструкции и типа освещения",
      budgetNote: "точная стоимость рассчитывается после замера с учётом всех особенностей помещения",
    },
    nextStep:
      "Чтобы дать точный ответ, мне нужно увидеть помещение. Запишитесь на бесплатный замер — приеду, осмотрю, расскажу варианты и посчитаю на месте.",
  };
}
