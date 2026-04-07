"use client";

import type { WheelEvent } from "react";
import { useMemo, useRef } from "react";

type ProofTrackClientProps = {
  children: React.ReactNode;
};

export function ProofTrackClient({ children }: ProofTrackClientProps) {
  const ref = useRef<HTMLDivElement>(null);

  const scrollByAmount = useMemo(() => 420, []);

  const scrollLeft = () => {
    ref.current?.scrollBy({ left: -scrollByAmount, behavior: "smooth" });
  };

  const scrollRight = () => {
    ref.current?.scrollBy({ left: scrollByAmount, behavior: "smooth" });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const container = ref.current;

    if (!container) {
      return;
    }

    const canScrollHorizontally = container.scrollWidth > container.clientWidth;

    if (!canScrollHorizontally) {
      return;
    }

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      container.scrollBy({
        left: event.deltaY,
      });
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-10 bg-gradient-to-r from-slate-950 to-transparent lg:block" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-10 bg-gradient-to-l from-slate-950 to-transparent lg:block" />

      <div className="mb-4 hidden justify-end gap-2 lg:flex">
        <button
          type="button"
          onClick={scrollLeft}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          aria-label="Прокрутить влево"
        >
          ←
        </button>
        <button
          type="button"
          onClick={scrollRight}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
          aria-label="Прокрутить вправо"
        >
          →
        </button>
      </div>

      <div
        ref={ref}
        onWheel={handleWheel}
        className="no-scrollbar flex gap-4 overflow-x-auto pb-2 sm:gap-5 lg:gap-6"
      >
        {children}
        <div className="w-4 shrink-0 sm:w-6 lg:w-8" />
      </div>
    </div>
  );
}
