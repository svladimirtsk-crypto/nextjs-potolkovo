import Image from "next/image";

import { homeAssets } from "@/content/home-assets";

type ProofItem = (typeof import("@/content/homepage").homepage.proof.items)[number];

type ProofCardProps = {
  item: ProofItem;
  mode: "mobile" | "desktop";
  onOpen: () => void;
};

function splitPriceLabel(priceLabel?: string) {
  if (!priceLabel) {
    return { main: "", suffix: "" };
  }

  const slashIndex = priceLabel.indexOf("/");

  if (slashIndex === -1) {
    return { main: priceLabel, suffix: "" };
  }

  return {
    main: priceLabel.slice(0, slashIndex).trim(),
    suffix: priceLabel.slice(slashIndex).trim(),
  };
}

export function ProofCard({ item, mode, onOpen }: ProofCardProps) {
  const isMobile = mode === "mobile";
  const price = splitPriceLabel(item.priceLabel);

  const asset = homeAssets.find((entry) => entry.assetKey === item.imageAssetKey);

  if (!asset) {
    return null;
  }

  return (
    <article
      className={[
        "overflow-hidden border border-slate-200 bg-white text-slate-950 shadow-[0_8px_24px_rgba(2,6,23,0.12)]",
        isMobile
          ? "snap-start w-[78vw] max-w-[18.5rem] flex-none rounded-[1.5rem]"
          : "h-full rounded-[1.5rem]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col text-left"
        aria-label={`Открыть кейс: ${item.title}`}
      >
        <div className="relative aspect-[5/4] overflow-hidden">
          <Image
            src={asset.src}
            alt={item.alt}
            fill
            sizes={
              isMobile
                ? "(max-width: 768px) 78vw, 18.5rem"
                : "(max-width: 1280px) 33vw, 380px"
            }
            className="object-cover"
          />
        </div>

        <div className={["flex flex-1 flex-col", isMobile ? "p-4" : "p-5"].join(" ")}>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                {item.serviceType}
              </p>

              <h3
                className={[
                  "font-semibold tracking-tight text-slate-950",
                  isMobile ? "text-lg leading-6" : "text-xl leading-7",
                ].join(" ")}
              >
                {item.title}
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                {item.roomType}
              </span>

              {item.areaLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {item.areaLabel}
                </span>
              ) : null}

              {item.timelineLabel ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {item.timelineLabel}
                </span>
              ) : null}
            </div>

            {item.priceLabel ? (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Ориентир по бюджету
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <p
                    className={
                      isMobile
                        ? "text-2xl font-bold tracking-tight"
                        : "text-3xl font-bold tracking-tight"
                    }
                  >
                    {price.main}
                  </p>

                  {price.suffix ? (
                    <span className="pb-0.5 text-sm font-medium text-slate-500">
                      {price.suffix}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-auto pt-4">
            <div className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-4 text-sm font-semibold text-white">
              Подробнее
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}
