// file: lib/mock.ts

import type {
  RoomSelectionOutput,
  TechQuestionOutput,
  ComputedContext,
} from "./types";

export function getMockRoomSelection(ctx: ComputedContext): RoomSelectionOutput {
  return {
    scenario: "room-selection",
    intent: "подбор потолка и освещения",
    quickSummary: `Для вашего помещения (${ctx.roomLabel}) рекомендуем натяжной потолок с ${ctx.recommendedProfile.toLowerCase().includes("теневой") ? "теневым профилем" : "классическим профилем"} и ${ctx.recommendedLighting.toLowerCase().includes("трек") ? "трековым освещением" : "современным освещением"}. Потеря высоты составит ${ctx.heightLossRange}.`,
    recommendedSolution: {
      ceilingType: "Натяжной потолок",
      texture: ctx.recommendedTexture,
      profile: ctx.recommendedProfile,
      lighting: ctx.recommendedLighting,
      heightLoss: ctx.heightLossRange,
    },
    whyItFits: [
      `Оптимальное решение для ${ctx.roomLabel.toLowerCase()} с учётом ваших приоритетов`,
      "Проверенная комбинация материалов и освещения для комфортного пространства",
      ctx.isWetRoom
        ? "Влагостойкие материалы обеспечат долговечность во влажной среде"
        : "Минимальная потеря высоты при максимальном визуальном эффекте",
    ],
    whatToConsider: [
      "Точная стоимость зависит от количества углов и сложности помещения",
      `Потеря высоты ${ctx.heightLossRange} — точно определяется на замере`,
      "Мощность и расположение светильников рассчитываются индивидуально",
    ],
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
      "Запишитесь на бесплатный замер — приеду, замерю и рассчитаю точную стоимость на месте. Без обязательств.",
  };
}

export function getMockTechQuestion(): TechQuestionOutput {
  return {
    scenario: "tech-question",
    intent: "технический вопрос по натяжному потолку",
    shortAnswer:
      "Да, это реализуемо. Конкретное решение зависит от параметров вашего помещения — высоты потолка, площади и типа конструкции. Рекомендую рассмотреть два варианта ниже.",
    recommendedOptions: [
      {
        name: "Стандартное решение",
        description:
          "Классический подход с минимальной потерей высоты. Подходит для большинства случаев и бюджетов.",
      },
      {
        name: "Продвинутое решение",
        description:
          "Более технологичный вариант с лучшим визуальным результатом. Требует чуть больше высоты и бюджета.",
      },
    ],
    whatToConsider: [
      "Точное решение определяется после осмотра помещения",
      "Потеря высоты зависит от выбранного типа конструкции и освещения",
      "Все материалы подбираются индивидуально под ваш случай",
    ],
    estimatedImpact: {
      heightLoss: "зависит от конструкции (обычно 4–8 см)",
      budgetNote: "точная стоимость рассчитывается после замера",
    },
    nextStep:
      "Чтобы дать точный ответ, нужно увидеть помещение. Запишитесь на бесплатный замер — всё расскажу и рассчитаю на месте.",
  };
}
