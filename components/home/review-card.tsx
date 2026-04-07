type ReviewItem = (typeof import("@/content/homepage").homepage.trust.reviews)[number];

type ReviewCardProps = {
  item: ReviewItem;
};

export function ReviewCard({ item }: ReviewCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{item.authorName}</h3>
          <p className="mt-1 text-sm text-slate-500">{item.sourceLabel}</p>
        </div>

        {item.resultLabel ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {item.resultLabel}
          </span>
        ) : null}
      </div>

      {item.highlightQuote ? (
        <p className="mt-5 text-lg font-medium leading-8 text-slate-950">
          {item.highlightQuote}
        </p>
      ) : null}

      <p className="mt-4 text-sm leading-7 text-slate-600">«{item.quote}»</p>

      {item.objectType ? (
        <p className="mt-4 text-sm text-slate-500">{item.objectType}</p>
      ) : null}
    </article>
  );
}
