import { Picture } from "@/components/ui/picture";

import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import { getAvailabilityLabel } from "@/content/availability";

const founder = homepage.trust.founder;

const portraitAsset = homeAssets.find(
  (asset) => asset.assetKey === founder.portraitAssetKey
);

export function FounderBlock() {
  /** N-061: ближайшие окна замера; null — календарь устарел, строку не рисуем. */
  const availabilityLabel = getAvailabilityLabel();

  if (!portraitAsset) {
    return null;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="relative aspect-[4/3]">
          <Picture
            src={portraitAsset.src}
            alt={founder.portraitAlt}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            imgClassName="object-cover"
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

        {/*
          N-061 (F-52): «почему сейчас» на самой странице, а не только в форме.
          Календарь ручной и с коротким сроком годности — если он протух,
          getAvailabilityLabel вернёт null и строка исчезнет, а не соврёт.
        */}
        {availabilityLabel ? (
          <p
            data-testid="founder-availability"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200"
          >
            {availabilityLabel}
          </p>
        ) : null}

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
