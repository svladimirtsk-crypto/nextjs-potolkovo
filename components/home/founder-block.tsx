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
    <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
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

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {founder.role}
        </p>

        <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          {founder.name}
        </h3>

        <p className="mt-4 text-lg font-medium leading-8 text-slate-800">
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
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {founder.microproofLines.map((line) => (
              <li
                key={line}
                className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700"
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
