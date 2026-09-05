import Image from "next/image";

import { AVITO_PROFILE } from "@/content/avito-reviews";
import { homeAssets } from "@/content/home-assets";
import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";

import { HeroCta } from "./hero-cta";

const hero = homepage.hero;
const heroAsset = homeAssets.find((asset) => asset.assetKey === hero.heroAfterAssetKey);
const portraitAsset = homeAssets.find((asset) => asset.assetKey === hero.portraitAssetKey);

/**
 * T-040 · Первый экран главной.
 *
 * Состав строго по разделу 6.2 ТЗ: H1 + один подзаголовок + один primary CTA +
 * текстовая ссылка на замер + строка фактов + фото мастера. Скидочные карточки,
 * дублирующая строка отзывов, чипы доверия и два из трёх градиентов убраны —
 * они уводили внимание от единственного целевого действия.
 */
export function HomeHero() {
  if (!heroAsset) {
    return null;
  }

  const facts = hero.factsTemplate.replace("{reviews}", String(AVITO_PROFILE.totalReviews));

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
          {/* Единственный градиент: читаемость текста слева. */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/84 via-slate-950/56 to-slate-950/18" />
        </div>

        <Container className="relative z-10 flex min-h-[100svh] items-center py-14 sm:py-16 lg:py-20">
          <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="max-w-xl lg:max-w-2xl">
              <p className="text-sm font-medium text-white/72 sm:text-[15px]">
                {hero.servicesInlineLabel}
              </p>

              <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {hero.h1}
              </h1>

              <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-white/84 sm:text-lg sm:leading-8">
                {hero.subtitle}
              </p>

              <HeroCta label={hero.primaryCtaLabel} secondaryLabel={hero.secondaryCtaLabel} />

              <p className="mt-5 text-sm font-medium leading-6 text-white/76">{facts}</p>
            </div>

            {/* Фото мастера: на мобильном остаётся в первом экране, поэтому компактное. */}
            {portraitAsset ? (
              <figure className="mx-auto w-full max-w-[18rem] sm:max-w-xs lg:mx-0 lg:max-w-none">
                <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/5">
                  <Image
                    src={portraitAsset.src}
                    alt={portraitAsset.alt}
                    fill
                    sizes="(max-width: 1024px) 60vw, 360px"
                    className="object-cover object-top"
                  />
                </div>
                <figcaption className="mt-3 text-xs leading-5 text-white/70 sm:text-sm">
                  {hero.portraitCaption}
                </figcaption>
              </figure>
            ) : null}
          </div>
        </Container>
      </div>
    </section>
  );
}
