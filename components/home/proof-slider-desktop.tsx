"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ProofCard } from "./proof-card";
import type { homepage } from "@/content/homepage";

type ProofItem = (typeof homepage.proof.items)[number];

type ProofSliderDesktopProps = {
  items: readonly ProofItem[];
  onOpen: (slug: string) => void;
};

export function ProofSliderDesktop({ items, onOpen }: ProofSliderDesktopProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "prev" | "next") => {
    if (!trackRef.current) return;
    const card = trackRef.current.querySelector<HTMLElement>("article");
    const gap = 20;
    const cardWidth = card ? card.getBoundingClientRect().width + gap : 360;
    trackRef.current.scrollBy({
      left: dir === "next" ? cardWidth : -cardWidth,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  return (
    <div>
      <div
        ref={trackRef}
        role="region"
        aria-label="Выполненные работы"
        className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain pb-2"
      >
        {items.map((item) => (
          <div
            key={item.slug}
            className="snap-start flex-none"
            style={{ width: "calc(33.333% - 14px)", minWidth: "280px" }}
          >
            <ProofCard
              item={item}
              mode="desktop"
              onOpen={() => onOpen(item.slug)}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => scroll("prev")}
          aria-label="Предыдущие работы"
          className="px-4"
        >
          ←
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => scroll("next")}
          aria-label="Следующие работы"
          className="px-4"
        >
          →
        </Button>
      </div>
    </div>
  );
}
