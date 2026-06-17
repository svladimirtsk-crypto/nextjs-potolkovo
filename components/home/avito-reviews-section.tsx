"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Heading } from "@/components/ui/heading";
import { avitoReviews, AVITO_PROFILE } from "@/content/avito-reviews";

const INITIAL_COUNT = 4;

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Рейтинг ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-4 w-4 ${star <= Math.round(value) ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({
  review,
  index,
}: {
  review: (typeof avitoReviews)[number];
  index: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
            {index + 1}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <StarRating value={5} />
              <span className="text-xs font-semibold text-emerald-700">5.0</span>
            </div>
          </div>
        </div>

        {review.dealConfirmed ? (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700">
            Сделка состоялась
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-700">
        &ldquo;{review.text}&rdquo;
      </p>

      {review.serviceType ? (
        <p className="mt-2 text-xs text-slate-500">
          Услуга: {review.serviceType}
        </p>
      ) : null}
    </div>
  );
}

export function AvitoReviewsSection() {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? avitoReviews : avitoReviews.slice(0, INITIAL_COUNT);

  return (
    <Section id="reviews" className="bg-slate-50">
      <Container>
        <div className="flex flex-col items-center text-center">
          <Heading
            eyebrow="Отзывы"
            title="Что говорят клиенты"
            description="Реальные отзывы с Avito — 19 отзывов, рейтинг 5.0"
          />
        </div>

        {/* Avito Profile Badge */}
        <div className="mx-auto mt-6 flex max-w-xl flex-wrap items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-1">
              <span className="text-2xl">⭐</span>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xl font-bold text-slate-950">{AVITO_PROFILE.rating}</span>
                <StarRating value={AVITO_PROFILE.rating} />
              </div>
              <p className="text-xs text-slate-500">
                {AVITO_PROFILE.totalReviews} отзывов · на Avito
              </p>
            </div>
          </div>

          <div className="hidden h-8 w-px bg-slate-200 sm:block" />

          <div className="flex flex-wrap gap-2">
            {AVITO_PROFILE.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
              >
                ✓ {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {displayed.map((review, index) => (
            <ReviewCard key={review.id} review={review} index={index} />
          ))}
        </div>

        {/* Show More / Link to Avito */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {!showAll && avitoReviews.length > INITIAL_COUNT ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="inline-flex h-12 items-center rounded-2xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-950 hover:bg-slate-50"
            >
              Показать все {avitoReviews.length} отзывов
            </button>
          ) : null}

          <a
            href={AVITO_PROFILE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 transition-colors hover:text-blue-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-5-5 1.41-1.41L11 14.17l7.59-7.59L20 8l-9 9z" />
            </svg>
            Читать все отзывы на Avito
          </a>
        </div>
      </Container>
    </Section>
  );
}
