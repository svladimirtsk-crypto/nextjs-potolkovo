"use client";

import type { ServiceCalculatorPreset } from "@/content/services";
import { Button } from "@/components/ui/button";
import { useCalculatorModal } from "./calculator-modal-context";
import { useCalculatorPageContext } from "./page-context";

type CalculatorTeaserButtonProps = {
  preset?: ServiceCalculatorPreset;
  /** Если не задан — берётся из контекста страницы (T-021). */
  source?: string;
  label?: string;
};

function shouldOpenLightingFirst(label: string, source: string): boolean {
  const labelText = String(label ?? "").toLowerCase();
  const sourceText = String(source ?? "").toLowerCase();

  if (labelText.includes("открыть каталог")) return true;
  if (labelText.includes("каталог в калькуляторе")) return true;
  if (sourceText.includes("track-sale-custom")) return true;

  return false;
}

export function CalculatorTeaserButton({
  preset,
  source,
  label = "Рассчитать стоимость",
}: CalculatorTeaserButtonProps) {
  const { openCalculator } = useCalculatorModal();
  const page = useCalculatorPageContext();

  // T-021: пресет и источник по умолчанию — из контекста страницы
  const effectiveSource = source ?? page.sourceFor("teaser");
  const effectivePreset = preset ?? page.preset ?? undefined;

  if (page.presetDisabled && !preset) return null;

  return (
    <Button
      type="button"
      className="w-full justify-center py-6 text-base"
      onClick={() => {
        const safeSource = String(effectiveSource ?? "");
        const safeLabel = String(label ?? "");

        if (shouldOpenLightingFirst(safeLabel, safeSource)) {
          openCalculator({
            initialStep: 1,
            initialLightingTab: "catalog",
            initialLightingView: "browse",
            entryMode: "lighting-first",
            source: safeSource,
          });
          return;
        }

        /**
         * PT-008: пресет переносится целиком — его разрешает
         * `resolveEntryPreset` в обёртке Шага 0. Заглушку здесь не собираем:
         * при `presetOrigin: "default"` её подставляет контекст модалки.
         *
         * N-013 (F-10): подпись «подставил со страницы» уместна только когда
         * страница действительно что-то подставила.
         */
        openCalculator(
          page.optionsFor("teaser", {
            preset: effectivePreset,
            presetOrigin: effectivePreset ? "page" : "default",
            source: safeSource,
          })
        );
      }}
    >
      {label}
    </Button>
  );
}
