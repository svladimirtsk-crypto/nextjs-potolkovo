import { homepage } from "@/content/homepage";

const scenarios = homepage.price.scenarios;

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length ? value : undefined;
}

function splitPriceLabel(priceLabel: string) {
  const slashIndex = priceLabel.indexOf("/");

  if (slashIndex === -1) {
    return {
      main: priceLabel,
      suffix: "",
    };
  }

  return {
    main: priceLabel.slice(0, slashIndex).trim(),
    suffix: priceLabel.slice(slashIndex).trim(),
  };
}

export function PriceScenarios() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {scenarios.map((scenario) => {
        const isHighlighted =
          "highlight" in scenario && Boolean((scenario as { highlight?: boolean }).highlight);

        const note = getOptionalString(
          "note" in scenario ? (scenario as { note?: unknown }).note : undefined
        );

        const price = splitPriceLabel(scenario.priceLabel);

        return (
          <article
            key={scenario.slug}
            className={[
              "flex min-h-full flex-col rounded-3xl border p-6 sm:p-7",
              isHighlighted
                ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-950",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="space-y-3">
              <p
                className={[
                  "text-sm",
                  isHighlighted ? "text-white/70" : "text-slate-500",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {scenario.serviceType}
              </p>

              <h3 className="text-xl font-semibold tracking-tight">
                {scenario.title}
              </h3>

              <p
                className={[
                  "text-sm",
                  isHighlighted ? "text-white/70" : "text-slate-600",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {scenario.roomType}
              </p>
            </div>

            <div className="mt-8">
              <p
                className={[
                  "font-mono text-xs uppercase tracking-[0.18em]",
                  isHighlighted ? "text-white/50" : "text-slate-400",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {scenario.areaLabel}
              </p>

              <div className="mt-3 flex items-end gap-2">
                <p className="text-4xl font-bold tracking-tight sm:text-5xl">
                  {price.main}
                </p>

                {price.suffix ? (
                  <span
                    className={[
                      "pb-1 text-sm font-medium",
                      isHighlighted ? "text-white/60" : "text-slate-500",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {price.suffix}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {scenario.includesLabel ? (
                <p
                  className={[
                    "text-sm leading-6",
                    isHighlighted ? "text-white/78" : "text-slate-600",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {scenario.includesLabel}
                </p>
              ) : null}

              {note ? (
                <p
                  className={[
                    "text-sm leading-6",
                    isHighlighted ? "text-white/60" : "text-slate-500",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {note}
                </p>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
