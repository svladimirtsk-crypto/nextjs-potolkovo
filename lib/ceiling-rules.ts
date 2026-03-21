// file: lib/ceiling-rules.ts

import type {
  RoomType,
  Priority,
  LightingNeed,
  Concern,
  BudgetLevel,
  ComputedContext,
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
  if (concern === "low-ceiling") return "Обычный профиль (минимальная потеря высоты 3–4 см)";
  if (priority === "modern" || priority === "design") return "Теневой профиль (чистые линии, без плинтуса)";
  if (priority === "hidden-light") return "Парящий профиль (скрытая LED-подсветка по периметру)";
  if (priority === "practical" || priority === "min-height-loss") return "Обычный профиль с маскировочной лентой";
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
    if (ceilingHeight < 260) return "Встроенный магнитный трек (минимальная потеря высоты, направленный свет)";
    return "Встроенный магнитный трек (направленный свет, гибкая конфигурация)";
  }
  if (lightingNeed === "light-lines") return "Световые линии (встроенные LED-линии, замена люстрам)";
  if (lightingNeed === "perimeter") return "Контурная подсветка (LED по периметру, мягкий свет)";
  if (lightingNeed === "cornice-niche") return "Ниша под карниз + подсветка (шторы от потолка)";
  if (concern === "low-light") return "Комбинация: точечные + световые линии или трек";
  if (lightingNeed === "unsure") {
    if (ceilingHeight >= 270) return "Рекомендуем трековое освещение или световые линии";
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
    if (lightingNeed === "standard" || lightingNeed === "unsure") return "3–4 см (минимальная)";
    if (lightingNeed === "tracks") return "5–6 см";
    if (lightingNeed === "light-lines") return "5–7 см";
    return "4–6 см";
  }
  if (lightingNeed === "standard") return "4–5 см";
  if (lightingNeed === "tracks") return "6–8 см";
  if (lightingNeed === "light-lines") return "6–10 см";
  if (lightingNeed === "perimeter") return "5–7 см";
  if (lightingNeed === "cornice-niche") return "5–7 см (+ ниша ~10–15 см глубиной)";
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
    notes.push("Световые линии в ванной — красивое решение, но нужна герметичная LED-лента");
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
  const w: string[] = [];
  if (ceilingHeight < 240) {
    w.push("Высота потолка менее 240 см — критически важно минимизировать потерю высоты");
  }
  if (roomType === "bathroom" && concern !== "wet-room") {
    w.push("Ванная комната — обязательно использовать влагостойкие материалы");
  }
  return w;
}

// ============================================================
// BUDGET RANGES (per sqm, approximate)
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

  // fallback
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
  const min = Math.round(area * multiplier / 1000) * 1000;
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
  _budget: BudgetLevel
): ComputedContext {
  const profile = getRecommendedProfile(priority, concern, _budget);
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
      basic: { label: budgets.basic.label, pricePerSqm: budgets.basic.pricePerSqm, description: budgets.basic.description },
      optimal: { label: budgets.optimal.label, pricePerSqm: budgets.optimal.pricePerSqm, description: budgets.optimal.description },
      premium: { label: budgets.premium.label, pricePerSqm: budgets.premium.pricePerSqm, description: budgets.premium.description },
    },
    compatibilityNotes: compat,
    warnings: warns,
    estimatedTotalBasic: estimateTotal(area, budgets.basic.multiplier),
    estimatedTotalOptimal: estimateTotal(area, budgets.optimal.multiplier),
    estimatedTotalPremium: estimateTotal(area, budgets.premium.multiplier),
  };
}

// ============================================================
// TECH QUESTION CONTEXT (lighter version)
// ============================================================
export interface TechContext {
  roomLabel?: string;
  heightNote?: string;
  isWetRoom: boolean;
  generalNotes: string[];
}

export function computeTechContext(
  question: string,
  roomType?: RoomType,
  ceilingHeight?: number
): TechContext {
  const lower = question.toLowerCase();
  const notes: string[] = [];
  let wet = false;

  if (roomType) {
    wet = roomType === "bathroom";
    if (wet) notes.push("Ванная — обязательно влагостойкое полотно и защищённые соединения");
  }
  if (lower.includes("ванн") || lower.includes("влаг") || lower.includes("сыр")) {
    wet = true;
    if (!notes.some((n) => n.includes("влаг"))) {
      notes.push("Для влажных помещений нужно влагостойкое полотно");
    }
  }

  let heightNote: string | undefined;
  if (ceilingHeight) {
    if (ceilingHeight < 250) {
      heightNote = `Высота ${ceilingHeight} см — рекомендуем решения с минимальной потерей высоты (3–5 см)`;
    } else if (ceilingHeight < 270) {
      heightNote = `Высота ${ceilingHeight} см — стандартная, подходят большинство решений`;
    } else {
      heightNote = `Высота ${ceilingHeight} см — отлично, доступны все варианты включая многоуровневые`;
    }
  }

  if (lower.includes("трек") || lower.includes("спот")) {
    notes.push("Встроенные магнитные треки: потеря высоты 5–8 см, зависит от модели");
  }
  if (lower.includes("свет") && lower.includes("лин")) {
    notes.push("Световые линии: потеря высоты 6–10 см, расчёт мощности по нормам");
  }
  if (lower.includes("карниз") || lower.includes("штор")) {
    notes.push("Ниша под карниз: глубина 10–15 см, ширина зависит от количества направляющих");
  }
  if (lower.includes("теневой") || lower.includes("теневого")) {
    notes.push("Теневой профиль: зазор 8 мм, без плинтуса, потеря высоты 3–5 см");
  }
  if (lower.includes("парящ")) {
    notes.push("Парящий профиль: LED-подсветка по периметру, потеря высоты 5–7 см");
  }

  return {
    roomLabel: roomType ? ROOM_LABELS[roomType] : undefined,
    heightNote,
    isWetRoom: wet,
    generalNotes: notes,
  };
}

// Export room labels for UI
export { ROOM_LABELS };
