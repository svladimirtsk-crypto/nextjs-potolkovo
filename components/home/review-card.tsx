type ReviewItem = (typeof import("@/content/homepage").homepage.trust.reviews)[number];

type ReviewCardProps = {
  item: ReviewItem;
};

export function ReviewCard({ item }: ReviewCardProps) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{item.authorName}</h3>
          <p className="mt-1 text-sm text-slate-500">{item.sourceLabel}</p>
        </div>

        {item.resultLabel ? (
          <span className="inline-flex w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
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
        <p className="mt-4 text-sm font-medium text-slate-500">{item.objectType}</p>
      ) : null}
    </article>
  );
}
