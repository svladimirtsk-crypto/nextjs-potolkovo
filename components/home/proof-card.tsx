import Image from "next/image";

import { homeAssets } from "@/content/home-assets";
import { Button } from "@/components/ui/button";

type ProofItem = (typeof import("@/content/homepage").homepage.proof.items)[number];

type ProofCardProps = {
  item: ProofItem;
  defaultCtaLabel: string;
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

export function ProofCard({ item, defaultCtaLabel }: ProofCardProps) {
  const asset = homeAssets.find((entry) => entry.assetKey === item.imageAssetKey);

  if (!asset) {
    return null;
  }

  const price = splitPriceLabel(item.priceLabel);

  return (
    <article className="snap-start w-[86vw] max-w-[23rem] flex-none overflow-hidden rounded-3xl bg-white shadow-[0_14px_36px_rgba(2,6,23,0.18)] ring-1 ring-slate-200/70 sm:w-[21.5rem] lg:w-[23rem]">
      <div className="relative aspect-[5/4] overflow-hidden">
        <Image
          src={asset.src}
          alt={item.alt}
          fill
          sizes="(max-width: 640px) 86vw, (max-width: 1024px) 21.5rem, 23rem"
          className="object-cover"
        />
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500">{item.serviceType}</p>

          <h3 className="text-xl font-semibold tracking-tight text-slate-950">
            {item.title}
          </h3>

          <p className="text-sm leading-6 text-slate-600">{item.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            {item.roomType}
          </span>

          {item.areaLabel ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {item.areaLabel}
            </span>
          ) : null}

          {item.timelineLabel ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
              {item.timelineLabel}
            </span>
          ) : null}
        </div>

        {item.priceLabel ? (
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Ориентир по бюджету
            </p>

            <div className="mt-2 flex items-end gap-2">
              <p className="text-3xl font-bold tracking-tight text-slate-950">
                {price.main}
              </p>

              {price.suffix ? (
                <span className="pb-1 text-sm font-medium text-slate-500">
                  {price.suffix}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button
          href={`#${item.actionTargetId ?? "action"}`}
          className="w-full justify-center"
        >
          {item.ctaLabel ?? defaultCtaLabel}
        </Button>
      </div>
    </article>
  );
}
