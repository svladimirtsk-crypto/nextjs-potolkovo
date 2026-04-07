"use client";

import { useRef } from "react";

type ProofTrackClientProps = {
  children: React.ReactNode;
};

export function ProofTrackClient({ children }: ProofTrackClientProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollByAmount = 380;

  const scrollLeft = () => {
    ref.current?.scrollBy({ left: -scrollByAmount, behavior: "smooth" });
  };

  const scrollRight = () => {
    ref.current?.scrollBy({ left: scrollByAmount, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="mb-4 hidden justify-end gap-2 lg:flex">
        <button
          type="button"
          onClick={scrollLeft}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 text-sm font-medium text-white transition-colors hover:bg-white/14"
          aria-label="Прокрутить работы влево"
        >
          ←
        </button>

        <button
          type="button"
          onClick={scrollRight}
          className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/15 bg-white/8 px-3 text-sm font-medium text-white transition-colors hover:bg-white/14"
          aria-label="Прокрутить работы вправо"
        >
          →
        </button>
      </div>

      <div
        ref={ref}
        role="region"
        aria-label="Лента выполненных работ"
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 sm:gap-5 lg:gap-6"
      >
        {children}
        <div className="w-4 shrink-0 sm:w-6 lg:w-8" />
      </div>
    </div>
  );
}
