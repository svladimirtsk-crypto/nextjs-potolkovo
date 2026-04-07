import { homepage } from "@/content/homepage";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { TextLink } from "@/components/ui/text-link";

import { FounderBlock } from "./founder-block";
import { ReviewCard } from "./review-card";

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

        <div className="mt-10 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm text-slate-500">{trust.externalRatingLabel}</p>
            <div className="mt-2 flex items-center gap-3">
              {trust.externalRatingValue ? (
                <span className="text-3xl font-bold tracking-tight text-slate-950">
                  {trust.externalRatingValue}
                </span>
              ) : null}
              {trust.externalRatingSource ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                  {trust.externalRatingSource}
                </span>
              ) : null}
            </div>
          </div>

          {trust.externalRatingUrl ? (
            <TextLink href={trust.externalRatingUrl} className="text-sm font-medium">
              Смотреть отзывы на внешнем источнике
            </TextLink>
          ) : null}
        </div>

        {trust.stats?.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {trust.stats.map((stat) => (
              <div
                key={`${stat.label}-${stat.valueDisplay}`}
                className="rounded-3xl border border-slate-200 bg-white p-5"
              >
                <p className="text-2xl font-bold tracking-tight text-slate-950">
                  {stat.valueDisplay}
                </p>
                <p className="mt-2 text-sm text-slate-600">{stat.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-12">
          {trust.reviewsTitle ? (
            <h3 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {trust.reviewsTitle}
            </h3>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {trust.reviews.map((review) => (
              <ReviewCard key={review.slug} item={review} />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
