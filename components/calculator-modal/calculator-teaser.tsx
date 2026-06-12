import type { ServiceCalculatorPreset } from "@/content/services";
import { Heading } from "@/components/ui/heading";
import { CalculatorTeaserButton } from "./calculator-teaser-button";

type CalculatorTeaserProps = {
  preset?: ServiceCalculatorPreset;
  source: string;
  heading?: string;
  buttonLabel?: string;
};

const BULLETS = [
  "Тип потолка, профиль и площадь",
  "Карнизы, световые линии и трековое освещение",
  "Каталог светильников со скидкой до −15%",
  "Итоговая стоимость за 2 минуты",
];

function resolveButtonLabel(explicitLabel: string | undefined, heading: string): string | undefined {
  if (explicitLabel) return explicitLabel;
  const headingText = String(heading ?? "").toLowerCase();
  if (headingText.includes("каталог")) return "Открыть каталог в калькуляторе";
  return undefined;
}

export function CalculatorTeaser({
  preset,
  source,
  heading = "Рассчитайте стоимость",
  buttonLabel,
}: CalculatorTeaserProps) {
  const resolvedLabel = resolveButtonLabel(buttonLabel, heading);

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <Heading
        title={heading}
        description="Выберите параметры — калькулятор покажет стоимость с учётом освещения, монтажа и скидок."
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
        <CalculatorTeaserButton
          preset={preset}
          source={String(source ?? "")}
          label={resolvedLabel}
        />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Ориентир по цене → точная смета после бесплатного замера
      </p>
    </div>
  );
}
