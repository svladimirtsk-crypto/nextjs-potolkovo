"use client";

import { useTrackSaleIntent, type IntentMode } from "./TrackSaleIntentContext";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const modeConfig: Record<
  IntentMode,
  {
    hint: string;
    ctaLabel: string;
    ctaSubtext?: string;
  }
> = {
  install: {
    hint:
      "Замер, подбор трекового освещения и монтаж натяжного потолка. Скидка −15% на всё оборудование.",
    ctaLabel: "На бесплатный замер",
    ctaSubtext: "и скидка −15% на свет",
  },
  buy: {
    hint:
      "Подберём комплект трекового освещения под ваш проект. Проверим наличие и подготовим счёт.",
    ctaLabel: "Проверить наличие / получить счёт",
  },
};

export function TrackSaleIntentSwitch() {
  const { mode, setMode } = useTrackSaleIntent();
  const config = modeConfig[mode];

  return (
    <section className="bg-white py-6 sm:py-8 border-b border-slate-100">
      <Container>
        {/* Segmented control */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-2xl bg-slate-100 p-1 gap-1">
            <SegmentButton
              active={mode === "install"}
              onClick={() => setMode("install")}
              label="С установкой в потолок"
            />
            <SegmentButton
              active={mode === "buy"}
              onClick={() => setMode("buy")}
              label="Только купить свет"
            />
          </div>
        </div>

        {/* Mode-dependent text + CTA */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm leading-6 text-slate-600">{config.hint}</p>

          <div className="mt-5">
            <Button href="#action" className="justify-center py-6 text-base">
              {config.ctaLabel}
            </Button>

            {config.ctaSubtext ? (
              <p className="mt-2 text-xs text-slate-500">
                {config.ctaSubtext}
              </p>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 sm:px-5 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}
