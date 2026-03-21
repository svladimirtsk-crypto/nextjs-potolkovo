// file: lib/ceiling-rules.ts

import type {
  RoomType,
  Priority,
  LightingNeed,
  Concern,
  BudgetLevel,
  ComputedContext,
  TechContext,
} from "./types";

// ============================================================
// ROOM LABELS
// ============================================================
const ROOM_LABELS: Record<RoomType, string> = {
  kitchen: "Кухня",
  bedroom: "Спальня",
  living: "Гостиная",
  bathroom: "Ванная комната",
  corridor: "Коридор / прихожая",
  children: "Детская",
  office: "Кабинет",
  commercial: "Коммерческое помещение",
};

// ============================================================
// TEXTURE RECOMMENDATIONS
// ============================================================
const TEXTURE_BY_ROOM: Record<RoomType, string> = {
  kitchen: "Матовый или сатиновый (не собирает блики, практичен)",
  bedroom: "Матовый (спокойный, без бликов)",
  living: "Сатиновый или матовый (универсальный, благородный вид)",
  bathroom: "Матовый (влагостойкое полотно)",
  corridor: "Сатиновый (лёгкий блеск визуально расширяет)",
  children: "Матовый (нейтральный, не отвлекает)",
  office: "Матовый (деловой стиль, без бликов)",
  commercial: "Матовый (универсальный, нейтральный)",
};

// ============================================================
// PROFILE RECOMMENDATIONS
// ============================================================
function getRecommendedProfile(
  priority: Priority,
  concern: Concern,
  _budget: BudgetLevel
): string {
  if (concern === "low-ceiling") {
    return "Обычный профиль (минимальная потеря высоты 3–4 см)";
  }
  if (priority === "modern" || priority === "design") {
    return "Теневой профиль (чистые линии, без плинтуса)";
  }
  if (priority === "hidden-light") {
    return "Парящий профиль (скрытая LED-подсветка по периметру)";
  }
  if (priority === "practical" || priority === "min-height-loss") {
    return "Обычный профиль с маскировочной лентой";
  }
  return "Теневой или обычный профиль (зависит от задачи)";
}

// ============================================================
// LIGHTING RECOMMENDATIONS
// ============================================================
function getRecommendedLighting(
  lightingNeed: LightingNeed,
  concern: Concern,
  ceilingHeight: number
): string {
  if (lightingNeed === "tracks") {
    if (ceilingHeight < 260) {
      return "Встроенный магнитный трек (минимальная потеря высоты, направленный свет)";
    }
    return "Встроенный магнитный трек (направленный свет, гибкая конфигурация)";
  }

  if (lightingNeed === "light-lines") {
    return "Световые линии (встроенные LED-линии, замена люстрам)";
  }

  if (lightingNeed === "perimeter") {
    return "Контурная подсветка (LED по периметру, мягкий свет)";
  }

  if (lightingNeed === "cornice-niche") {
    return "Ниша под карниз + подсветка (шторы от потолка)";
  }

  if (concern === "low-light") {
    return "Комбинация: точечные + световые линии или трек";
  }

  if (lightingNeed === "unsure") {
    if (ceilingHeight >= 270) {
      return "Рекомендуем трековое освещение или световые линии";
    }
    return "Рекомендуем точечные светильники + контурную подсветку";
  }

  return "Точечные светильники (классическое решение)";
}

// ============================================================
// HEIGHT LOSS
// ============================================================
function getHeightLoss(
  lightingNeed: LightingNeed,
  concern: Concern
): string {
  if (concern === "low-ceiling") {
    if (lightingNeed === "standard" || lightingNeed === "unsure") {
      return "3–4 см (минимальная)";
    }
    if (lightingNeed === "tracks") {
      return "5–6 см";
    }
    if (lightingNeed === "light-lines") {
      return "5–7 см";
    }
    return "4–6 см";
  }

  if (lightingNeed === "standard") return "4–5 см";
  if (lightingNeed === "tracks") return "6–8 см";
  if (lightingNeed === "light-lines") return "6–10 см";
  if (lightingNeed === "perimeter") return "5–7 см";
  if (lightingNeed === "cornice-niche") {
    return "5–7 см (+ ниша ~10–15 см глубиной)";
  }

  return "4–7 см (зависит от типа освещения)";
}

// ============================================================
// WET ROOM CHECK
// ============================================================
function isWetRoom(roomType: RoomType, concern: Concern): boolean {
  return roomType === "bathroom" || concern === "wet-room";
}

// ============================================================
// COMPATIBILITY NOTES
// ============================================================
function getCompatibilityNotes(
  roomType: RoomType,
  lightingNeed: LightingNeed,
  concern: Concern,
  ceilingHeight: number
): string[] {
  const notes: string[] = [];

  if (isWetRoom(roomType, concern)) {
    notes.push("Для влажных помещений используется специальное влагостойкое полотно");
    notes.push("Все электрические соединения должны быть защищены от влаги");
  }

  if (ceilingHeight < 250) {
    notes.push("При высоте менее 250 см рекомендуется минимальный профиль для сохранения высоты");

    if (lightingNeed === "light-lines") {
      notes.push("Световые линии при низком потолке возможны, но нужен точный расчёт высоты");
    }

    if (lightingNeed === "tracks") {
      notes.push("Встроенный трек при низком потолке возможен — используется тонкий магнитный профиль");
    }
  }

  if (lightingNeed === "tracks" && roomType === "bathroom") {
    notes.push("Трековое освещение в ванной возможно при правильной защите от влаги (IP44+)");
  }

  if (lightingNeed === "light-lines" && roomType === "bathroom") {
    notes.push("Световые линии в ванной возможны, но нужна герметичная LED-лента");
  }

  if (concern === "complex-geometry") {
    notes.push("Сложная геометрия требует индивидуального расчёта каркаса и раскроя полотна");
  }

  return notes;
}

// ============================================================
// WARNINGS
// ============================================================
function getWarnings(
  roomType: RoomType,
  concern: Concern,
  ceilingHeight: number
): string[] {
  const warnings: string[] = [];

  if (ceilingHeight < 240) {
    warnings.push("Высота потолка менее 240 см — критически важно минимизировать потерю высоты");
  }

  if (roomType === "bathroom" && concern !== "wet-room") {
    warnings.push("В ванной обязательно использовать влагостойкие материалы");
  }

  return warnings;
}

// ============================================================
// BUDGET RANGES
// ============================================================
interface BudgetRange {
  label: string;
  pricePerSqm: string;
  multiplier: number;
  description: string;
}

function getBudgetRanges(
  lightingNeed: LightingNeed,
  roomType: RoomType
): { basic: BudgetRange; optimal: BudgetRange; premium: BudgetRange } {
  const isWet = roomType === "bathroom";

  if (lightingNeed === "standard" || lightingNeed === "unsure") {
    return {
      basic: {
        label: "Практичный",
        pricePerSqm: isWet ? "от 1 200 ₽/м²" : "от 1 000 ₽/м²",
        multiplier: isWet ? 1200 : 1000,
        description: "Матовый потолок + точечные светильники",
      },
      optimal: {
        label: "Оптимальный",
        pricePerSqm: "от 2 000 ₽/м²",
        multiplier: 2000,
        description: "Теневой профиль + точечные + контурная подсветка",
      },
      premium: {
        label: "Эффектный",
        pricePerSqm: "от 3 500 ₽/м²",
        multiplier: 3500,
        description: "Теневой профиль + трековое освещение + ниша под карниз",
      },
    };
  }

  if (lightingNeed === "tracks") {
    return {
      basic: {
        label: "Практичный",
        pricePerSqm: "от 2 000 ₽/м²",
        multiplier: 2000,
        description: "Обычный профиль + встроенный трек",
      },
      optimal: {
        label: "Оптимальный",
        pricePerSqm: "от 3 000 ₽/м²",
        multiplier: 3000,
        description: "Теневой профиль + магнитный трек",
      },
      premium: {
        label: "Эффектный",
        pricePerSqm: "от 4 500 ₽/м²",
        multiplier: 4500,
        description: "Теневой профиль + трек + контурная подсветка + ниша",
      },
    };
  }

  if (lightingNeed === "light-lines") {
    return {
      basic: {
        label: "Практичный",
        pricePerSqm: "от 2 500 ₽/м²",
        multiplier: 2500,
        description: "Матовый потолок + 1–2 световые линии",
      },
      optimal: {
        label: "Оптимальный",
        pricePerSqm: "от 3 500 ₽/м²",
        multiplier: 3500,
        description: "Теневой профиль + световые линии по расчёту",
      },
      premium: {
        label: "Эффектный",
        pricePerSqm: "от 5 000 ₽/м²",
        multiplier: 5000,
        description: "Теневой + световые линии + контурная подсветка",
      },
    };
  }

  if (lightingNeed === "perimeter") {
    return {
      basic: {
        label: "Практичный",
        pricePerSqm: "от 1 800 ₽/м²",
        multiplier: 1800,
        description: "Парящий профиль с LED-лентой",
      },
      optimal: {
        label: "Оптимальный",
        pricePerSqm: "от 2 500 ₽/м²",
        multiplier: 2500,
        description: "Парящий профиль + точечные + регулировка яркости",
      },
      premium: {
        label: "Эффектный",
        pricePerSqm: "от 4 000 ₽/м²",
        multiplier: 4000,
        description: "Парящий + RGB + трековое освещение",
      },
    };
  }

  if (lightingNeed === "cornice-niche") {
    return {
      basic: {
        label: "Практичный",
        pricePerSqm: "от 1 500 ₽/м²",
        multiplier: 1500,
        description: "Обычный потолок + ниша под карниз",
      },
      optimal: {
        label: "Оптимальный",
        pricePerSqm: "от 2 500 ₽/м²",
        multiplier: 2500,
        description: "Теневой профиль + ниша + точечные",
      },
      premium: {
        label: "Эффектный",
        pricePerSqm: "от 4 000 ₽/м²",
        multiplier: 4000,
        description: "Теневой + ниша с подсветкой + трек или линии",
      },
    };
  }

  return {
    basic: {
      label: "Практичный",
      pricePerSqm: "от 1 000 ₽/м²",
      multiplier: 1000,
      description: "Базовый матовый потолок с простым освещением",
    },
    optimal: {
      label: "Оптимальный",
      pricePerSqm: "от 2 500 ₽/м²",
      multiplier: 2500,
      description: "Теневой профиль + современное освещение",
    },
    premium: {
      label: "Эффектный",
      pricePerSqm: "от 4 500 ₽/м²",
      multiplier: 4500,
      description: "Полный комплекс: профиль + свет + ниши",
    },
  };
}

// ============================================================
// ESTIMATED TOTALS
// ============================================================
function estimateTotal(area: number, multiplier: number): string {
  const min = Math.round((area * multiplier) / 1000) * 1000;
  return `ориентировочно от ${min.toLocaleString("ru-RU")} ₽`;
}

// ============================================================
// MAIN FUNCTION
// ============================================================
export function computeContext(
  roomType: RoomType,
  area: number,
  ceilingHeight: number,
  priority: Priority,
  lightingNeed: LightingNeed,
  concern: Concern,
  budget: BudgetLevel
): ComputedContext {
  const profile = getRecommendedProfile(priority, concern, budget);
  const lighting = getRecommendedLighting(lightingNeed, concern, ceilingHeight);
  const heightLoss = getHeightLoss(lightingNeed, concern);
  const wet = isWetRoom(roomType, concern);
  const budgets = getBudgetRanges(lightingNeed, roomType);
  const compat = getCompatibilityNotes(roomType, lightingNeed, concern, ceilingHeight);
  const warns = getWarnings(roomType, concern, ceilingHeight);

  return {
    roomLabel: ROOM_LABELS[roomType],
    recommendedTexture: TEXTURE_BY_ROOM[roomType],
    recommendedProfile: profile,
    recommendedLighting: lighting,
    heightLossRange: heightLoss,
    isWetRoom: wet,
    budgetRanges: {
      basic: {
        label: budgets.basic.label,
        pricePerSqm: budgets.basic.pricePerSqm,
        description: budgets.basic.description,
      },
      optimal: {
        label: budgets.optimal.label,
        pricePerSqm: budgets.optimal.pricePerSqm,
        description: budgets.optimal.description,
      },
      premium: {
        label: budgets.premium.label,
        pricePerSqm: budgets.premium.pricePerSqm,
        description: budgets.premium.description,
      },
    },
    compatibilityNotes: compat,
    warnings: warns,
    estimatedTotalBasic: estimateTotal(area, budgets.basic.multiplier),
    estimatedTotalOptimal: estimateTotal(area, budgets.optimal.multiplier),
    estimatedTotalPremium: estimateTotal(area, budgets.premium.multiplier),
  };
}

// ============================================================
// TECH QUESTION CONTEXT
// ============================================================
function includesAny(text: string, variants: string[]): boolean {
  return variants.some((variant) => text.includes(variant));
}

export function computeTechContext(
  question: string,
  roomType?: RoomType,
  ceilingHeight?: number
): TechContext {
  const lower = question.toLowerCase();
  const notes: string[] = [];
  let wet = roomType === "bathroom";

  if (wet) {
    notes.push("Для ванной нужны влагостойкое полотно и защищённые соединения");
  }

  if (includesAny(lower, ["ванн", "влаг", "сыр", "сануз", "душ"])) {
    wet = true;
    if (!notes.some((n) => n.toLowerCase().includes("влаг"))) {
      notes.push("Для влажных помещений нужны влагостойкие материалы и герметичная электрика");
    }
  }

  let heightNote: string | undefined;
  if (typeof ceilingHeight === "number") {
    if (ceilingHeight < 250) {
      heightNote = `Высота ${ceilingHeight} см — лучше выбирать решения с минимальной потерей высоты`;
    } else if (ceilingHeight < 270) {
      heightNote = `Высота ${ceilingHeight} см — подходят стандартные решения, но встроенный свет нужно считать по модели`;
    } else {
      heightNote = `Высота ${ceilingHeight} см — доступны почти все решения, включая треки, линии и ниши`;
    }
  }

  if (includesAny(lower, ["трек", "магнитн", "спот"])) {
    notes.push("Для встроенного трека обычно нужна закладная и опускание примерно 5–8 см");
  }

  if (includesAny(lower, ["светов", "линии", "линейн"])) {
    notes.push("Световые линии требуют расчёта мощности, охлаждения профиля и доступа к блоку питания");
  }

  if (includesAny(lower, ["карниз", "штор", "ниша"])) {
    notes.push("Нишу под карниз лучше закладывать заранее: важны глубина, отступ и количество рядов штор");
  }

  if (includesAny(lower, ["тенев"])) {
    notes.push("Теневой профиль даёт чистое примыкание без плинтуса, обычно с потерей высоты 3–5 см");
  }

  if (includesAny(lower, ["парящ"])) {
    notes.push("Парящий профиль требует места под LED-ленту и блок питания, обычно 5–7 см по высоте");
  }

  if (includesAny(lower, ["люстр", "крюк"])) {
    notes.push("Под люстру нужна закладная или крюк с правильной привязкой к чистовому уровню потолка");
  }

  if (includesAny(lower, ["труб", "обход", "короб", "вентиляц"])) {
    notes.push("Обход труб, коробов и вентиляции влияет на чистоту примыкания и стоимость монтажа");
  }

  if (includesAny(lower, ["блок питания", "драйвер", "диммер"])) {
    notes.push("Блоки питания и драйверы нужно размещать так, чтобы к ним был доступ для обслуживания");
  }

  return {
    roomLabel: roomType ? ROOM_LABELS[roomType] : undefined,
    heightNote,
    isWetRoom: wet,
    generalNotes: notes,
  };
}

export { ROOM_LABELS };
