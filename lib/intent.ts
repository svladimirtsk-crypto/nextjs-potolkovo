// file: lib/intent.ts

import type { SourceIntent } from "./types";

const LIGHTING_KEYWORDS = [
  "свет", "светильник", "трек", "трековый", "линия", "световая",
  "подсветка", "led", "лед", "люстра", "спот", "магнитн",
  "освещен", "лампа", "диод",
];

const PRICE_KEYWORDS = [
  "цена", "стоимость", "сколько стоит", "бюджет", "дорого",
  "дёшево", "дешево", "недорого", "расчёт", "расчет", "калькулятор",
];

const LOW_HEIGHT_KEYWORDS = [
  "низкий потолок", "сколько опускается", "высота", "потеря высоты",
  "опустится", "занижение", "минимальн", "хрущевка", "хрущёвка",
  "240", "245", "250", "малая высота",
];

const TECHNICAL_KEYWORDS = [
  "карниз", "труба", "обход", "профиль", "теневой", "парящ",
  "ванна", "кухня", "влаг", "монтаж", "конструкция", "ниша",
  "багет", "гарпун", "штапик", "перепад", "уровень", "короб",
];

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function detectIntent(
  utmTerm?: string,
  utmContent?: string,
  utmCampaign?: string,
  explicitIntent?: string
): SourceIntent {
  if (
    explicitIntent &&
    ["lighting", "price", "low-height", "technical", "general"].includes(
      explicitIntent
    )
  ) {
    return explicitIntent as SourceIntent;
  }

  const combined = [utmTerm, utmContent, utmCampaign]
    .filter(Boolean)
    .join(" ");

  if (!combined) return "general";

  if (matchesAny(combined, LIGHTING_KEYWORDS)) return "lighting";
  if (matchesAny(combined, PRICE_KEYWORDS)) return "price";
  if (matchesAny(combined, LOW_HEIGHT_KEYWORDS)) return "low-height";
  if (matchesAny(combined, TECHNICAL_KEYWORDS)) return "technical";

  return "general";
}

export function getIntentLabel(intent: SourceIntent): string {
  const labels: Record<SourceIntent, string> = {
    lighting: "освещение и свет",
    price: "стоимость и бюджет",
    "low-height": "низкий потолок и высота",
    technical: "технический вопрос",
    general: "натяжные потолки",
  };
  return labels[intent];
}
