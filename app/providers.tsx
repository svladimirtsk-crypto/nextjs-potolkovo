"use client";

import { type ReactNode, useEffect } from "react";

import { CalculatorStoreProvider } from "@/lib/calculator/store";
import { CalculatorModalProvider } from "@/components/calculator-modal/calculator-modal-context";
import { ConfirmDialogPortal } from "@/components/ui/confirm-dialog";
import { CalculatorModalGate } from "@/components/calculator-modal/calculator-modal-gate";
import { captureAttributionOnce } from "@/lib/attribution-capture";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    /**
     * PT-012 · Захват атрибуции первого касания — через единую обёртку.
     *
     * Раньше здесь стоял прямой доступ к `sessionStorage` без `try/catch`, и на
     * заблокированном хранилище (приватный режим Safari, корпоративная
     * политика, iframe с запрещёнными сторонними cookie) исключение улетало из
     * `useEffect` — то есть падало всё дерево страницы, а не только атрибуция.
     * Список ключей и нормализация значений общие с сервером: `lib/attribution`.
     */
    captureAttributionOnce();
  }, []);

  return (
    <CalculatorStoreProvider>
      <CalculatorModalProvider>
        {children}
        <CalculatorModalGate />
        <ConfirmDialogPortal />
      </CalculatorModalProvider>
    </CalculatorStoreProvider>
  );
}
