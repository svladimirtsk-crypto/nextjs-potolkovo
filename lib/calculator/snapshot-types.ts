/**
 * N-050 · Форма снапшота калькулятора.
 *
 * Типы жили в `components/home/price-calculator-context.tsx` — клиентском
 * компоненте с `"use client"`. Из-за этого серверный код (`lib/lead/*`,
 * `lib/calculator/room-snapshot.ts`) и тесты импортировали React-модуль
 * ради одних лишь типов. Здесь только описание данных, без рантайма, поэтому
 * модуль безопасно тянуть с любой стороны границы сервер/клиент.
 */
import type {
  DerivedInputs,
  LightingDiscountMode,
  LightingSnapshot,
  SolutionScenario,
} from "@/lib/calculator-modal-types";

/** PT-010 · идентификаторы тарифов калькулятора: те же union'ы, что в `V2RoomConfig`. */
export type CalculatorCeilingTypeId = "standard" | "shadow" | "floating" | "shadow-floating";
export type CalculatorCorniceTypeId = "none" | "built-in" | "hidden-niche" | "surface";
export type CalculatorTrackTypeId = "none" | "built-in" | "surface";

export type CalculatorRoomBreakdown = {
  id: string;
  label: string;
  area: number;
  totalRub: number;
  ceilingTypeLabel: string;
  shadowLength?: number | null;
  floatingLength?: number | null;
  lightLinesLength?: number | null;
  corniceLabel?: string | null;
  corniceLength?: number | null;
  corniceLightingLength?: number | null;
  trackLabel?: string | null;
  trackLength?: number | null;
  lightsCount?: number | null;
  chandeliersCount?: number | null;

  /**
   * PT-010 · нормализованные параметры комнаты.
   *
   * До этой задачи комната приезжала на сервер только лейблами («Теневой»,
   * «Встроенный трек») и метражом: сервер не мог честно пересчитать сумму,
   * потому что лейбл — не тариф, а часть тарифов зависит ещё и от флагов
   * (`corniceLightingEnabled`, `chandeliersEnabled`, число блоков питания).
   * Поля ниже — точный обратимый образ `V2RoomConfig`: с ними сервер считает
   * тем же `calcRoomSnapshotV2`, что и клиент.
   *
   * Все поля необязательные: снапшоты старых клиентов (и сохранённые заявки)
   * их не содержат, сервер в таком случае восстанавливает конфиг по лейблам и
   * помечает пересчёт как приблизительный.
   */
  ceilingType?: CalculatorCeilingTypeId;
  shadowEnabled?: boolean;
  floatingEnabled?: boolean;
  lightLinesEnabled?: boolean;
  corniceType?: CalculatorCorniceTypeId;
  corniceLightingEnabled?: boolean;
  corniceLightingPowerSupplies?: number | null;
  trackType?: CalculatorTrackTypeId;
  chandeliersEnabled?: boolean;
  lightsEnabled?: boolean;
};

export type CalculatorLeadSnapshot = {
  area: number;
  calculationScope?: "room" | "object";
  roomBreakdown?: CalculatorRoomBreakdown[];
  solutionScenario?: SolutionScenario;

  ceilingTypeLabel: string;
  ceilingBaseRate: number;
  ceilingBaseTotal: number;

  ceilingExtraLabel: string | null;
  ceilingLength: number | null;
  ceilingExtraRatePerMeter: number | null;
  ceilingExtraTotal: number;

  shadowEnabled?: boolean;
  shadowLength?: number | null;
  shadowExtraTotal?: number;
  floatingEnabled?: boolean;
  floatingLength?: number | null;
  floatingExtraTotal?: number;

  lightLinesEnabled: boolean;
  lightLinesLabel: string | null;
  lightLinesLength: number | null;
  lightLinesRatePerMeter: number | null;
  lightLinesTotal: number;

  corniceLabel: string | null;
  corniceLength: number | null;
  corniceRatePerMeter: number | null;
  corniceTotal: number;
  corniceLightingEnabled?: boolean;
  corniceLightingLabel?: string | null;
  corniceLightingLength?: number | null;
  corniceLightingRatePerMeter?: number | null;
  corniceLightingPowerSupplies?: number | null;
  corniceLightingPowerSupplyRate?: number | null;
  corniceLightingTotal?: number;

  trackLabel: string | null;
  trackLength: number | null;
  trackRatePerMeter: number | null;
  trackTotal: number;

  // NEW: Установка люстр
  chandeliersEnabled?: boolean;
  chandeliersCount?: number | null;
  chandeliersRatePerUnit?: number;
  chandeliersTotal?: number;

  lightsEnabled: boolean;
  lightsCount: number | null;
  lightsRatePerUnit: number;
  lightsTotal: number;

  total: number;
  /** T-004: сумма до применения минимального заказа. */
  totalRawRub?: number;
  /** T-004: сработал минимальный заказ. */
  minimumOrderApplied?: boolean;
  /** @deprecated T-008: не использовать, считать через селекторы контекста модалки. */
  grandTotal?: number;
  /** T-008: досчёт монтажа света, если он есть. */
  extraInstallRub?: number;
  extraInstallLines?: string[];

  derivedInputs: DerivedInputs;

  lighting?: LightingSnapshot;
  leadSource?: string;

  _reconciled?: boolean;

  // аналитика по скидке на свет
  lightingDiscountApplied?: boolean;
  lightingDiscountPercentApplied?: number;
  lightingDiscountMode?: LightingDiscountMode;
  lightingDiscountAmountRub?: number;
};
