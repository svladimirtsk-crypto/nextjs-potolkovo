import Image from "next/image";

import { AVITO_PROFILE } from "@/content/avito-reviews";
import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";

const hero = homepage.hero;
const heroAsset = homeAssets.find((asset) => asset.assetKey === hero.heroAfterAssetKey);

export function HomeHero() {
  if (!heroAsset) {
    return null;
  }

  return (
    <section
      id="hero"
      className="relative -mt-[var(--header-height)] overflow-hidden bg-slate-950 pt-[var(--header-height)] text-white"
    >
      <div className="relative min-h-[100svh]">
        <div className="absolute inset-0">
          <Image
            src={heroAsset.src}
            alt={heroAsset.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/56" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/12 via-slate-950/26 to-slate-950/74" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/84 via-slate-950/56 to-slate-950/18" />
        </div>

        <Container className="relative z-10 flex min-h-[100svh] items-center py-14 sm:py-16 lg:py-20">
          <div className="max-w-xl lg:max-w-2xl">
            <p className="text-sm font-medium text-white/72 sm:text-[15px]">
              {hero.servicesInlineLabel}
            </p>

            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
              {hero.h1}
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/84 sm:text-lg sm:leading-8">
              {hero.subtitle}
            </p>

            {hero.secondaryMicrocopy ? (
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
                {hero.secondaryMicrocopy}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Button href="#action" className="w-full sm:w-auto">
                {hero.primaryCtaLabel}
              </Button>
              <Button href="#price" variant="secondary" className="w-full sm:w-auto">
                Рассчитать стоимость
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_auto_1fr]">
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-sm">
                <p className="text-2xl font-bold tracking-tight text-white">{AVITO_PROFILE.rating.toFixed(1)}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">рейтинг на Avito</p>
              </div>

              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-sm">
                <p className="text-2xl font-bold tracking-tight text-white">{AVITO_PROFILE.totalReviews}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/60">реальных отзывов</p>
              </div>

              <div className="rounded-2xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                Освещение с потолком — скидка −25%
                <p className="mt-1 text-xs font-medium text-emerald-100/70">
                  Только свет — −10% · с потолком максимальная выгода
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/72">
              <span>Отзывы: 5.0 · {AVITO_PROFILE.totalReviews}</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block" />
              <span>{AVITO_PROFILE.memberSince}</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/30 sm:inline-block" />
              <a
                href={AVITO_PROFILE.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white hover:text-white"
              >
                Смотреть отзывы
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {hero.trustChips.map((chip) => (
                <Chip key={chip.label} tone="dark" className="px-3.5 py-2 text-[13px]">
                  {chip.label}
                </Chip>
              ))}
              {AVITO_PROFILE.badges.map((badge) => (
                <Chip key={badge} tone="dark" className="border-emerald-300/20 bg-emerald-400/10 px-3.5 py-2 text-[13px] text-emerald-100">
                  {badge}
                </Chip>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
