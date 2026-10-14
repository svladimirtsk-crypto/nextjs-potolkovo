"use client";

import { useState } from "react";
import { avitoReviews, AVITO_PROFILE } from "@/content/avito-reviews";

const INITIAL_COUNT = 4;
const LIGHT_REVIEW_PATTERN = /трек|светильник|подсветк|люстр|свет/i;
const MIN_TOPIC_REVIEWS = 2;

function StarRating({ value }: { value: number }) {
  return <div role="img" className="pk-review-stars" aria-label={`Рейтинг ${value} из 5`}>
    {[1, 2, 3, 4, 5].map(star => <svg key={star} aria-hidden="true" width="16" height="16" viewBox="0 0 20 20" fill={star <= Math.round(value) ? "currentColor" : "none"}><path d="M10 1.5l2.4 5.3 5.8.7-4.3 4 .9 5.8-4.8-2.9-4.8 2.9.9-5.8-4.3-4 5.8-.7z" stroke="currentColor" /></svg>)}
  </div>;
}

/** Attribution and original quotations remain intact; profile data is not a live rating feed. */
export function AvitoReviewsSection({ filter }: { filter?: "light" } = {}) {
  const [showAll, setShowAll] = useState(false);
  const topical = filter === "light" ? avitoReviews.filter(review => LIGHT_REVIEW_PATTERN.test(review.text)) : avitoReviews;
  const useTopical = filter !== "light" || topical.length >= MIN_TOPIC_REVIEWS;
  const source = useTopical ? topical : avitoReviews;
  const honestNote = filter === "light" && !useTopical ? "Отзывы по монтажу потолков" : null;
  const displayed = showAll ? source : source.slice(0, INITIAL_COUNT);

  return (
    <section id="reviews" className="pk-reviews" aria-labelledby="reviews-title">
      <div className="pk-wrap">
        <div className="pk-reviews-header"><div><p className="pk-eyebrow">Опыт клиентов</p><h2 id="reviews-title">Что говорят клиенты</h2><p>Отзывы из профиля основателя на Avito. Цитаты клиентов сохранены без изменений.</p>{honestNote ? <p>{honestNote}</p> : null}</div><div className="pk-review-profile"><p>Профиль основателя на Avito</p><div className="pk-review-score"><strong>{AVITO_PROFILE.rating.toFixed(1)}</strong><div><StarRating value={AVITO_PROFILE.rating} /><span>{AVITO_PROFILE.totalReviews} отзывов · по данным профиля</span></div></div><div className="pk-review-badges">{AVITO_PROFILE.badges.map(badge => <span key={badge}>{badge}</span>)}</div><small>На сайте опубликована часть отзывов. Текущий рейтинг и отметки — в профиле на Avito.</small></div></div>
        <div className="pk-reviews-grid">{displayed.map((review, index) => <article key={review.id} className="pk-review-card" data-review-id={review.id}><div className="pk-review-card-top"><span>{String(index + 1).padStart(2, "0")} / Отзыв клиента</span>{review.dealConfirmed ? <span>Сделка состоялась</span> : null}</div><blockquote><p>{review.text}</p></blockquote>{review.serviceType ? <p className="pk-review-service">Услуга в отзыве: {review.serviceType}</p> : null}</article>)}</div>
        <div className="pk-reviews-actions">{!showAll && source.length > INITIAL_COUNT ? <button type="button" onClick={() => setShowAll(true)}>Показать все {source.length} отзывов <span aria-hidden="true">↓</span></button> : null}<a href={AVITO_PROFILE.url} target="_blank" rel="noopener noreferrer">Читать все отзывы на Avito <span aria-hidden="true">↗</span></a></div>
      </div>
    </section>
  );
}
