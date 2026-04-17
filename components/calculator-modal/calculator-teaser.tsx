import type { ServiceCalculatorPreset } from "@/content/services";
import { Heading } from "@/components/ui/heading";
import { CalculatorTeaserButton } from "./calculator-teaser-button";

type CalculatorTeaserProps = {
  preset?: ServiceCalculatorPreset;
  source: string;
  heading?: string;
};

const BULLETS = [
  "Тип потолка и профиль",
  "Площадь помещения",
  "Карнизы и световые линии",
  "Точечные светильники и трековое освещение",
];

export function CalculatorTeaser({
  preset,
  source,
  heading = "Рассчитайте стоимость",
}: CalculatorTeaserProps) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <Heading
        title={heading}
        description="Учтём все параметры — от типа потолка до освещения."
      />

      <ul className="mt-6 space-y-2.5">
        {BULLETS.map((bullet) => (
          <li
            key={bullet}
            className="flex items-start gap-2.5 text-sm text-slate-600"
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-950" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <CalculatorTeaserButton preset={preset} source={source} />
      </div>

      {/* ← ИЗМЕНЕНО: убрано "фиксируется", формулировка унифицирована */}
      <p className="mt-4 text-sm text-slate-500">
        Точную стоимость определим на бесплатном замере
      </p>
    </div>
  );
}
