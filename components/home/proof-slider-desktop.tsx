"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";

type ProofItem = {
  slug: string;
  title: string;
  image: string;
  category: string;
  description?: string;
};

type ProofSliderDesktopProps = {
  items: ProofItem[];
  onOpen: (slug: string) => void;
  renderCard: (item: ProofItem, onOpen: (slug: string) => void) => React.ReactNode;
};

export function ProofSliderDesktop({
  items,
  onOpen,
  renderCard,
}: ProofSliderDesktopProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "prev" | "next") => {
    if (!trackRef.current) return;
    const card = trackRef.current.querySelector("[data-proof-card]");
    const cardWidth = card
      ? card.getBoundingClientRect().width + 20
      : 340;
    trackRef.current.scrollBy({
      left: dir === "next" ? cardWidth : -cardWidth,
      behavior: "smooth",
    });
  };

  return (
    <div>
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
      <div
        ref={trackRef}
        role="region"
        aria-label="Выполненные работы"
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-2"
      >
        {items.map((item) => (
          <div
            key={item.slug}
            data-proof-card
            className="snap-start w-[calc(33.333%-14px)] flex-none min-w-72"
          >
            {renderCard(item, onOpen)}
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => scroll("prev")}
          aria-label="Предыдущие работы"
        >
          ←
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => scroll("next")}
          aria-label="Следующие работы"
        >
          →
        </Button>
      </div>
    </div>
  );
}
