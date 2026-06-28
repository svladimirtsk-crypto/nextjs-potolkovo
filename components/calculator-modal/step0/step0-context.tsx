"use client";

import { createContext, useContext, type ReactNode } from "react";

import type {
  CalculatorLeadSnapshot,
  CalculatorRoomBreakdown,
} from "@/components/home/price-calculator-context";
import type { SolutionScenario, WizardStep } from "@/lib/calculator-modal-types";

/**
 * Step0Context — провайдер для квиз-флоу Step 0.
 *
 * Цель: предоставить дочерним компонентам секций (Step0SectionScenario,
 * Step0SectionArea, Step0SectionSummary, и т.д.) удобный API для чтения
 * состояния и вызова actions, не прокидывая 30+ props через каждый уровень.
 *
 * Это первый шаг миграции из PriceCalculatorClient (~3960 строк, всё в одном
 * файле) к модульной архитектуре. На данный момент провайдер только
 * собирает значения из PriceCalculatorClient и передаёт их вниз; позже
 * useState'ы переедут внутрь провайдера.
 */

export type Step0RoomSummary = {
  id: string;
  label: string;
  area: number;
  totalRub: number;
  ceilingTypeLabel: string;
  shadowLength: number | null;
  floatingLength: number | null;
  lightLinesLength: number | null;
  corniceLabel: string | null;
  corniceLength: number | null;
  corniceLightingLength: number | null;
  trackLabel: string | null;
  trackLength: number | null;
  lightsCount: number | null;
  chandeliersCount: number | null;
};

export type Step0ContextValue = {
  // === Сценарий ===
  solutionScenario: SolutionScenario;

  // === Состояние расчёта ===
  calculationScope: "room" | "object" | null;
  isSummaryReady: boolean;

  // === Computed значения ===
  effectiveSnapshot: CalculatorLeadSnapshot | null;
  effectiveRooms: Step0RoomSummary[];

  // === Свет ===
  hasLighting: boolean;

  // === Actions ===
  /** Переход на следующий шаг (Step 1 или Step 2 в зависимости от сценария). */
  onPrimaryCtaClick: () => void;
  /** Открыть последний compactStep для редактирования (используется с Back). */
  onBeginEditLastStep?: () => void;
  /** Открыть диалог добавления помещения (только для room-scope). */
  onPromptAddRoom?: () => void;
  /** Текущее действие footer-кнопки Step 0; источник истины для модалки. */
  footerAction?: { label: string; onClick: () => void; disabled?: boolean } | null;
  /** Действие «Назад» в footer Step 0; источник истины для модалки. */
  backAction?: { visible: boolean; onClick?: () => void };
};

const Step0Context = createContext<Step0ContextValue | null>(null);

export function Step0Provider({
  value,
  children,
}: {
  value: Step0ContextValue;
  children: ReactNode;
}) {
  return <Step0Context.Provider value={value}>{children}</Step0Context.Provider>;
}

export function useStep0Context(): Step0ContextValue {
  const ctx = useContext(Step0Context);
  if (!ctx) {
    throw new Error("useStep0Context must be used inside Step0Provider");
  }
  return ctx;
}

/**
 * Хелпер для маппинга roomBreakdown из snapshot в Step0RoomSummary[].
 * Используется в PriceCalculatorClient при сборке value для провайдера.
 */
export function summarizeRooms(
  rooms: CalculatorRoomBreakdown[] | undefined
): Step0RoomSummary[] {
  if (!rooms) return [];
  return rooms.map((room) => ({
    id: room.id,
    label: room.label,
    area: room.area,
    totalRub: room.totalRub,
    ceilingTypeLabel: room.ceilingTypeLabel,
    shadowLength: room.shadowLength ?? null,
    floatingLength: room.floatingLength ?? null,
    lightLinesLength: room.lightLinesLength ?? null,
    corniceLabel: room.corniceLabel ?? null,
    corniceLength: room.corniceLength ?? null,
    corniceLightingLength: room.corniceLightingLength ?? null,
    trackLabel: room.trackLabel ?? null,
    trackLength: room.trackLength ?? null,
    lightsCount: room.lightsCount ?? null,
    chandeliersCount: room.chandeliersCount ?? null,
  }));
}

export type { WizardStep };
