"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import type { CalculatorLeadSnapshot } from "@/lib/calculator/snapshot-types";

/**
 * N-050 · Стор снапшота калькулятора.
 *
 * Раньше жил в `components/home/price-calculator-context.tsx` — то есть
 * глобальное состояние всего калькулятора лежало в папке компонентов главной
 * страницы, хотя его читают модалка, страница каталога света и формы заявок.
 * Вместе со стором в том файле были ещё 246 строк форматирования; они уехали
 * в `lib/calculator/summary-lines.ts`, а здесь остался только сам стор.
 *
 * Хранит две вещи: последний снапшот расчёта и флаг «пользователь трогал
 * калькулятор» (без него формы не показывают сводку по пустому расчёту).
 */

type CalculatorStoreValue = {
  snapshot: CalculatorLeadSnapshot | null;
  setSnapshot: Dispatch<SetStateAction<CalculatorLeadSnapshot | null>>;
  hasInteracted: boolean;
  setHasInteracted: Dispatch<SetStateAction<boolean>>;
};

const CalculatorStoreContext = createContext<CalculatorStoreValue | null>(null);

export function CalculatorStoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CalculatorLeadSnapshot | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  const value = useMemo(
    () => ({ snapshot, setSnapshot, hasInteracted, setHasInteracted }),
    [snapshot, hasInteracted]
  );

  return (
    <CalculatorStoreContext.Provider value={value}>{children}</CalculatorStoreContext.Provider>
  );
}

export function useCalculatorStore() {
  const context = useContext(CalculatorStoreContext);
  if (!context) {
    throw new Error("useCalculatorStore must be used inside CalculatorStoreProvider.");
  }
  return context;
}
