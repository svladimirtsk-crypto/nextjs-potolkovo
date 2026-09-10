/**
 * N-031 · Три ценовых примера для секции «Быстрый ориентир по цене» (F-29).
 *
 * Раньше секция показывала три карточки «1. Потолок / 2. Освещение / 3. Итог» —
 * пересказ шагов, которые человек и так увидит внутри модалки. Вопрос перед
 * калькулятором всегда один: «сколько это стоит примерно у таких же, как я».
 * Поэтому карточки отвечают суммой на типовую комнату.
 *
 * Суммы не записаны литералами: каждая считается тем же `calcRoomsTotal`, что
 * и калькулятор. Разойтись с ним они не могут по построению — если поменяется
 * прайс, изменятся и примеры.
 */
import type { ServiceCalculatorPreset } from "@/content/services";
import { calcRoomsTotal, type V2RoomConfig } from "@/lib/calculator/room-snapshot";
import { defaultPerimeterMeters } from "@/lib/calculator/presets";
import { pricing } from "@/content/pricing";
import { formatAnchorRub } from "@/lib/home-price-anchor";

export type HomePriceExample = {
  id: string;
  /** «Спальня 12 м²» — узнаваемая комната, а не абстрактная площадь. */
  title: string;
  /** Состав человеческим языком: за что именно эта сумма. */
  composition: string;
  priceLabel: string;
  /** Приписка вроде «минимальный заказ» — когда цифра требует пояснения. */
  note?: string;
  ctaLabel: string;
  /** Пресет для `openCalculator`: клик продолжает расчёт, а не начинает с нуля. */
  preset: ServiceCalculatorPreset;
};

type ExampleSpec = {
  id: string;
  title: string;
  composition: string;
  ctaLabel: string;
  room: Partial<V2RoomConfig>;
  preset: ServiceCalculatorPreset;
};

/** Комната со всеми выключенными опциями — основа для точечного включения. */
function bareRoom(id: string, area: number): V2RoomConfig {
  const perimeter = defaultPerimeterMeters(area);
  return {
    id,
    label: "Комната",
    area,
    ceilingType: "standard",
    shadowEnabled: false,
    shadowLength: perimeter,
    floatingEnabled: false,
    floatingLength: perimeter,
    lightLinesEnabled: false,
    lightLinesLength: 0,
    corniceType: "none",
    corniceLength: 0,
    corniceLightingEnabled: false,
    corniceLightingLength: 0,
    corniceLightingPowerSupplies: 0,
    trackType: "none",
    trackLength: 0,
    chandeliersEnabled: false,
    chandeliersCount: 0,
    lightsEnabled: false,
    lightsCount: 0,
  };
}

const SPECS: ExampleSpec[] = [
  {
    id: "bedroom-simple",
    title: "Спальня 12 м², простой потолок",
    composition: "Полотно, профиль по периметру, монтаж",
    ctaLabel: "Посчитать похожее",
    room: { area: 12 },
    preset: { ceilingType: "standard", areaDefault: 12, roomLabelDefault: "Спальня" },
  },
  {
    id: "kitchen-shadow",
    title: "Кухня-гостиная 24 м², теневой",
    composition: "Теневой профиль по периметру 20 м.п., полотно, монтаж",
    ctaLabel: "Посчитать похожее",
    room: { area: 24, ceilingType: "shadow", shadowEnabled: true, shadowLength: 20 },
    preset: {
      ceilingType: "shadow",
      areaDefault: 24,
      shadowLengthDefault: 20,
      roomLabelDefault: "Кухня-гостиная",
    },
  },
  {
    id: "living-floating-track",
    title: "Гостиная 30 м², парящий + трек",
    composition: "Парящий профиль 22 м.п., встроенный трек 6 м, полотно, монтаж",
    ctaLabel: "Посчитать похожее",
    room: {
      area: 30,
      ceilingType: "floating",
      floatingEnabled: true,
      floatingLength: 22,
      trackType: "built-in",
      trackLength: 6,
    },
    preset: {
      ceilingType: "floating",
      areaDefault: 30,
      floatingLengthDefault: 22,
      trackType: "built-in",
      trackLengthDefault: 6,
      roomLabelDefault: "Гостиная",
    },
  },
];

function buildExample(spec: ExampleSpec): HomePriceExample {
  const room: V2RoomConfig = { ...bareRoom(spec.id, spec.room.area ?? 18), ...spec.room };
  const total = calcRoomsTotal([room]);

  return {
    id: spec.id,
    title: spec.title,
    composition: spec.composition,
    priceLabel: formatAnchorRub(total.applied),
    // Если сработал минимум, цифра ниже реальной работы — это надо назвать.
    note: total.minimumApplied ? "минимальный заказ" : undefined,
    ctaLabel: spec.ctaLabel,
    preset: spec.preset,
  };
}

export const homePriceExamples: HomePriceExample[] = SPECS.map(buildExample);

/** Экспорт для тестов: пересчёт примера напрямую. */
export function calcExampleTotal(id: string): number {
  const spec = SPECS.find((item) => item.id === id);
  if (!spec) throw new Error(`Неизвестный пример: ${id}`);
  const room: V2RoomConfig = { ...bareRoom(spec.id, spec.room.area ?? 18), ...spec.room };
  return calcRoomsTotal([room]).applied;
}

export const homePriceExamplesMinimumRub = pricing.minimumOrderRub;
