import type { LightingItem, LightingSnapshot } from "@/lib/calculator-modal-types";
import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";
import {
  LIGHTING_ONLY_DISCOUNT_PERCENT,
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
  calcLightingDiscountAmount,
} from "@/lib/lighting-formulas";

/**
 * PT-018 (B-F104, T-324) · Снимок заявки для каталога на странице трекового света.
 *
 * Каталог страницы `/uslugi/prodazha-trekovogo-osveshcheniya` пишет комплект в
 * общий снимок заявки: без этого «Рассчитать с потолком» открывал бы Шаг 0
 * пустым, а заявка уходила бы без позиций света.
 *
 * Раньше тело жило внутри `useEffect(() => setSnapshot(prev => …))` в
 * `CatalogSectionClient.tsx` — та же запрещённая ТЗ v2 (п. 0.7) синхронизация
 * состояния эффектом, что и в `lib/calculator/rooms-snapshot.ts`. Логика была
 * непроверяема: чтобы увидеть поля скидки, требовалось смонтировать страницу,
 * положить товар в корзину и дождаться кадра.
 *
 * Здесь она описана как чистая функция `(prev, input) => next | prev`. Возврат
 * ровно того же объекта означает «изменений нет»: React пропускает такой
 * `setState`, лишнего рендера не происходит.
 */

/**
 * Заготовка снимка для сценария «сначала свет»: потолок ещё не рассчитан, все
 * его поля нулевые, но структура полная — Шаг 2 и заявка читают её как есть.
 */
export function createLightingOnlySnapshot(): CalculatorLeadSnapshot {
  return {
    area: 0,
    ceilingTypeLabel: "Потолок пока не рассчитан",
    ceilingBaseRate: 0,
    ceilingBaseTotal: 0,
    ceilingExtraLabel: null,
    ceilingLength: null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal: 0,
    lightLinesEnabled: false,
    lightLinesLabel: null,
    lightLinesLength: null,
    lightLinesRatePerMeter: null,
    lightLinesTotal: 0,
    corniceLabel: null,
    corniceLength: null,
    corniceRatePerMeter: null,
    corniceTotal: 0,
    trackLabel: null,
    trackLength: null,
    trackRatePerMeter: null,
    trackTotal: 0,
    lightsEnabled: false,
    lightsCount: null,
    lightsRatePerUnit: 0,
    lightsTotal: 0,
    total: 0,
    derivedInputs: {
      pointSpotsQty: 0,
      trackMountType: "none",
      trackLengthMeters: 0,
      recommendedTrackSpotsQty: 0,
    },
  };
}

/**
 * Комплект из позиций корзины как блок «свет» снимка.
 * `null` при пустой корзине — снимать блок, а не оставлять нули.
 *
 * Скидка считается дважды и обе суммы живут в снимке: `discountedTotalRub` —
 * «только свет» (−LIGHTING_ONLY_DISCOUNT_PERCENT), `withCeilingDiscountedTotalRub` —
 * «свет с потолком». Какую из них показать, решает экран, а не каталог.
 */
export function buildLightingSnapshotFromItems(items: LightingItem[]): LightingSnapshot | null {
  if (items.length === 0) return null;

  const totalRub = items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
  const discountedTotalRub = applyLightingOnlyDiscount(totalRub);
  const withCeilingDiscountedTotalRub = applyLightingWithCeilingDiscount(totalRub);

  return {
    mode: "catalog",
    items,
    totalRub,
    discountedTotalRub,
    standaloneDiscountedTotalRub: discountedTotalRub,
    withCeilingDiscountedTotalRub,
    discountMode: "lighting-only",
    discountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
    discountAmountRub: calcLightingDiscountAmount(totalRub, discountedTotalRub),
    userCustomizedLighting: true,
  };
}

export type CatalogSnapshotInput = {
  /** Блок «свет» из `buildLightingSnapshotFromItems`; `null` — корзина пуста. */
  lighting: LightingSnapshot | null;
  /** Сумма выбранных позиций без скидки — нужна только как запасной вариант. */
  selectedTotal: number;
  /** Та же сумма со скидкой «только свет». */
  lightingOnlySelectedTotal: number;
};

/**
 * Обновление общего снимка заявкой из каталога страницы.
 *
 * Два правила, которые легко потерять при правке:
 * - пустая корзина снимает блок «свет» и его скидку, но НЕ трогает снимок,
 *   если блока там и не было (иначе каждый рендер страницы писал бы в стор);
 * - `leadSource` ставится только если его ещё нет: источник, с которым человек
 *   пришёл (UTM, страница услуги), важнее источника «каталог на странице света».
 */
export function nextCatalogSnapshot(
  prev: CalculatorLeadSnapshot | null,
  input: CatalogSnapshotInput
): CalculatorLeadSnapshot | null {
  const { lighting, selectedTotal, lightingOnlySelectedTotal } = input;

  if (!lighting) {
    if (!prev?.lighting) return prev;
    return {
      ...prev,
      lighting: undefined,
      lightingDiscountApplied: false,
      lightingDiscountPercentApplied: 0,
      lightingDiscountMode: "none",
      lightingDiscountAmountRub: 0,
    };
  }

  const base = prev ?? createLightingOnlySnapshot();
  return {
    ...base,
    leadSource: base.leadSource ?? "track-sale-page-catalog",
    lighting,
    lightingDiscountApplied: true,
    lightingDiscountPercentApplied: LIGHTING_ONLY_DISCOUNT_PERCENT,
    lightingDiscountMode: "lighting-only",
    lightingDiscountAmountRub:
      lighting.discountAmountRub ?? Math.max(0, selectedTotal - lightingOnlySelectedTotal),
  };
}
