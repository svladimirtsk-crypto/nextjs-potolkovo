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
 * N-050 · Состояние Шага 0, которое нужно модалке для отрисовки футера.
 *
 * Квиз владеет своим экраном, а кнопки «Назад» и «Подтвердить» рисует модалка:
 * они живут в её раскладке, а не внутри шага. Раньше связь между ними шла
 * через четыре сеттер-колбэка (`onStep0FooterActionChange` и соседние),
 * которые квиз вызывал из `useEffect` на каждом изменении экрана — то есть
 * состояние синхронизировалось эффектом, что ТЗ прямо запрещает.
 *
 * Теперь квиз кладёт готовый результат селекторов сюда одним объектом, а
 * модалка его читает. Это по-прежнему запись из компонента, но не размазанная
 * по четырём подпискам: один вызов в одном месте.
 */
export type Step0PublishedState = {
  progress: { done: number; total: number } | null;
  isSummaryReady: boolean;
  footerAction: { label: string; disabled?: boolean; onClick: () => void } | null;
  backAction: { visible: boolean; onClick?: () => void };
};

export const EMPTY_STEP0_STATE: Step0PublishedState = {
  progress: null,
  isSummaryReady: false,
  footerAction: null,
  backAction: { visible: false },
};

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
  step0: Step0PublishedState;
  setStep0: Dispatch<SetStateAction<Step0PublishedState>>;
};

const CalculatorStoreContext = createContext<CalculatorStoreValue | null>(null);

export function CalculatorStoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CalculatorLeadSnapshot | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [step0, setStep0] = useState<Step0PublishedState>(EMPTY_STEP0_STATE);

  const value = useMemo(
    () => ({ snapshot, setSnapshot, hasInteracted, setHasInteracted, step0, setStep0 }),
    [snapshot, hasInteracted, step0]
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
