import { AVITO_PROFILE } from "@/content/avito-reviews";
import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";

import { FounderBlock } from "./founder-block";

const trust = homepage.trust;

export function HomeTrust() {
  return (
    <Section id="trust" className="bg-slate-50">
      <Container>
        <Heading
          eyebrow="О мастере"
          title={trust.sectionTitle}
          description={trust.sectionIntro}
        />

        <div className="mt-10 sm:mt-12">
          <FounderBlock />
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Отзывы и внешнее подтверждение</p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  {AVITO_PROFILE.rating.toFixed(1)}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                  {AVITO_PROFILE.totalReviews} отзывов на Avito
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  {AVITO_PROFILE.memberSince}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {AVITO_PROFILE.badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                  >
                    ✓ {badge}
                  </span>
                ))}
              </div>
            </div>

            <TextLink href={AVITO_PROFILE.url} className="text-sm font-medium">
              Смотреть отзывы на Avito
            </TextLink>
          </div>
        </div>

        {trust.stats?.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {trust.stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.valueDisplay}`}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 sm:p-6"
              >
                <p className="text-3xl font-bold tracking-tight text-slate-950">
                  {stat.valueDisplay}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}

      </Container>
    </Section>
  );
}
