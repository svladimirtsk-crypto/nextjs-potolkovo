import Image from "next/image";

import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";

const founder = homepage.trust.founder;

const portraitAsset = homeAssets.find(
  (asset) => asset.assetKey === founder.portraitAssetKey
);

export function FounderBlock() {
  if (!portraitAsset) {
    return null;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-start">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="relative aspect-[4/3]">
          <Image
            src={portraitAsset.src}
            alt={founder.portraitAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
          />
        </div>
      </div>

      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {founder.role}
        </p>

        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {founder.name}
        </h3>

        <p className="mt-4 text-lg font-medium leading-8 text-slate-700">
          {founder.responsibilityLine}
        </p>

        {founder.specializationLine ? (
          <p className="mt-4 text-base leading-7 text-slate-600">
            {founder.specializationLine}
          </p>
        ) : null}

        <div className="mt-6 space-y-4">
          {founder.bioLines.map((line) => (
            <p key={line} className="text-base leading-7 text-slate-600">
              {line}
            </p>
          ))}
        </div>

        {founder.microproofLines?.length ? (
          <ul className="mt-6 flex flex-wrap gap-2">
            {founder.microproofLines.map((line) => (
              <li
                key={line}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
