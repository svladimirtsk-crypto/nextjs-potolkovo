import Image from "next/image";

import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";

const hero = homepage.hero;
const heroAsset = homeAssets.find((asset) => asset.assetKey === hero.heroAfterAssetKey);

export function HomeHero() {
  if (!heroAsset) {
    return null;
  }

  return (
    <Section id="hero" className="relative overflow-hidden bg-slate-950 py-0 text-white">
      <div className="relative min-h-[100svh]">
        <div className="absolute inset-0">
          <Image
            src={heroAsset.src}
            alt={heroAsset.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/58" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/30 to-black/75" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/48 via-black/18 to-transparent" />
        </div>

        <Container className="relative z-10 flex min-h-[100svh] items-center pt-28 pb-16 sm:pt-32 sm:pb-20 lg:pt-36 lg:pb-24">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              {hero.servicesInlineLabel}
            </p>

            <h1 className="mt-5 text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-7xl">
              {hero.h1}
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
              {hero.subtitle}
            </p>

            {hero.secondaryMicrocopy ? (
              <p className="mt-4 text-sm leading-6 text-white/68 sm:text-base">
                {hero.secondaryMicrocopy}
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Button href="#action" variant="secondary" className="w-full sm:w-auto">
                {hero.primaryCtaLabel}
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {hero.trustChips.map((chip) => (
                <Chip key={chip.label} tone="dark">
                  {chip.label}
                </Chip>
              ))}
            </div>
          </div>
        </Container>
      </div>
    </Section>
  );
}
