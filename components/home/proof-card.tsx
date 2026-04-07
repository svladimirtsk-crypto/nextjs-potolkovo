import Image from "next/image";

import { homeAssets } from "@/content/home-assets";

type ProofItem = (typeof import("@/content/homepage").homepage.proof.items)[number];

type ProofCardProps = {
  item: ProofItem;
  defaultCtaLabel: string;
};

export function ProofCard({ item, defaultCtaLabel }: ProofCardProps) {
  const asset = homeAssets.find((entry) => entry.assetKey === item.imageAssetKey);

  if (!asset) {
    return null;
  }

  return (
    <article className="group relative w-[88vw] max-w-[26rem] flex-none overflow-hidden rounded-3xl border border-white/10 bg-slate-900 sm:w-[24rem] lg:w-[26rem]">
      <div className="relative aspect-[4/5] overflow-hidden">
        <Image
          src={asset.src}
          alt={item.alt}
          fill
          sizes="(max-width: 640px) 88vw, (max-width: 1024px) 24rem, 26rem"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <p className="text-sm font-medium text-white/70">{item.serviceType}</p>

        <h3 className="mt-2 text-xl font-semibold tracking-tight text-white">
          {item.title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-white/75">{item.summary}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.roomType ? (
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
              {item.roomType}
            </span>
          ) : null}

          {item.areaLabel ? (
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
              {item.areaLabel}
            </span>
          ) : null}

          {item.timelineLabel ? (
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/85">
              {item.timelineLabel}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            {item.priceLabel ? (
              <p className="text-lg font-semibold text-white">{item.priceLabel}</p>
            ) : null}
          </div>

          <a
            href={`#${item.actionTargetId ?? "action"}`}
            className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          >
            {item.ctaLabel ?? defaultCtaLabel}
          </a>
        </div>
      </div>
    </article>
  );
}
