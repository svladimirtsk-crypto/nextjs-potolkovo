import { homepage } from "@/content/homepage";

const scenarios = homepage.price.scenarios;

export function PriceScenarios() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((scenario) => {
        const isHighlighted = "highlight" in scenario && Boolean(scenario.highlight);
        const note = "note" in scenario ? scenario.note : undefined;

        return (
          <article
            key={scenario.slug}
            className={[
              "rounded-3xl border bg-white p-6",
              isHighlighted ? "border-slate-950 shadow-sm" : "border-slate-200",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">{scenario.serviceType}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  {scenario.title}
                </h3>
              </div>

              {isHighlighted ? (
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
                  Популярно
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-sm text-slate-600">{scenario.roomType}</p>
              <p className="font-mono text-sm text-slate-500">{scenario.areaLabel}</p>
              <p className="text-3xl font-bold tracking-tight text-slate-950">
                {scenario.priceLabel}
              </p>
            </div>

            {scenario.includesLabel ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {scenario.includesLabel}
              </p>
            ) : null}

            {note ? (
              <p className="mt-3 text-sm leading-6 text-slate-500">{note}</p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
