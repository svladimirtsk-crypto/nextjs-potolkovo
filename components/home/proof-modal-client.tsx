"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { homeAssets } from "@/content/home-assets";

type ProofItem = (typeof import("@/content/homepage").homepage.proof.items)[number];

type ProofModalClientProps = {
  items: readonly ProofItem[];
  selectedIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function splitPriceLabel(priceLabel?: string) {
  if (!priceLabel) {
    return { main: "", suffix: "" };
  }

  const slashIndex = priceLabel.indexOf("/");

  if (slashIndex === -1) {
    return { main: priceLabel, suffix: "" };
  }

  return {
    main: priceLabel.slice(0, slashIndex).trim(),
    suffix: priceLabel.slice(slashIndex).trim(),
  };
}

export function ProofModalClient({
  items,
  selectedIndex,
  onClose,
  onPrev,
  onNext,
}: ProofModalClientProps) {
  const isOpen = selectedIndex !== null;
  const item = selectedIndex !== null ? items[selectedIndex] : null;
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose, onPrev, onNext]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedIndex]);

  const asset = useMemo(() => {
    if (!item) return null;
    return homeAssets.find((entry) => entry.assetKey === item.imageAssetKey) ?? null;
  }, [item]);

  const gallery = useMemo<string[]>(() => {
    if (!asset) return [];

    const maybeGallery =
      "gallery" in asset && Array.isArray(asset.gallery)
        ? [...asset.gallery]
        : [];

    if (maybeGallery.length > 0) {
      return maybeGallery;
    }

    return [asset.src];
  }, [asset]);

  if (!item || !asset) {
    return null;
  }

  const safeImageIndex = Math.min(activeImageIndex, Math.max(gallery.length - 1, 0));
  const activeImage = gallery[safeImageIndex] ?? asset.src;
  const price = splitPriceLabel(item.priceLabel);

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={item.title}>
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/72"
        aria-label="Закрыть окно"
      />

      <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-white text-slate-950 lg:inset-x-auto lg:left-1/2 lg:top-1/2 lg:h-auto lg:max-h-[92svh] lg:w-[min(1040px,calc(100vw-2rem))] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-[2rem]">
        <div className="flex h-full flex-col lg:max-h-[92svh]">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Работа {selectedIndex! + 1} из {items.length}
              </p>
              <p className="mt-1 truncate text-sm font-medium text-slate-900">
                {item.serviceType}
              </p>
            </div>

            <div className="ml-4 flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition-colors hover:bg-slate-50"
                aria-label="Предыдущая работа"
              >
                ←
              </button>

              <button
                type="button"
                onClick={onNext}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition-colors hover:bg-slate-50"
                aria-label="Следующая работа"
              >
                →
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition-colors hover:bg-slate-50"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            <div className="grid lg:grid-cols-[1.12fr_0.88fr]">
              <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="relative aspect-[5/4] overflow-hidden bg-slate-100 lg:min-h-[520px] lg:aspect-auto">
                  <Image
                    src={activeImage}
                    alt={`${item.alt} — фото ${safeImageIndex + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 56vw"
                    className="object-cover"
                  />
                </div>

                {gallery.length > 1 ? (
                  <div className="grid grid-cols-3 gap-2 p-3 sm:p-4">
                    {gallery.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setActiveImageIndex(index)}
                        className={[
                          "relative aspect-[4/3] overflow-hidden rounded-xl border transition-colors",
                          index === safeImageIndex
                            ? "border-slate-950"
                            : "border-slate-200 hover:border-slate-400",
                        ].join(" ")}
                        aria-label={`Показать фото ${index + 1}`}
                      >
                        <Image
                          src={src}
                          alt={`${item.alt} — миниатюра ${index + 1}`}
                          fill
                          sizes="(max-width: 1024px) 33vw, 180px"
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="p-5 sm:p-6 lg:p-8">
                <p className="text-sm font-medium text-slate-500">{item.serviceType}</p>

                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                  {item.title}
                </h3>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {item.roomType}
                  </span>

                  {item.areaLabel ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.areaLabel}
                    </span>
                  ) : null}

                  {item.timelineLabel ? (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.timelineLabel}
                    </span>
                  ) : null}
                </div>

                {item.summary ? (
                  <p className="mt-6 text-base leading-7 text-slate-600">{item.summary}</p>
                ) : null}

                {item.priceLabel ? (
                  <div className="mt-8 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Ориентир по бюджету
                    </p>

                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-4xl font-bold tracking-tight text-slate-950">
                        {price.main}
                      </p>

                      {price.suffix ? (
                        <span className="pb-1 text-sm font-medium text-slate-500">
                          {price.suffix}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-8 space-y-3">
                  <a
                    href={`#${item.actionTargetId ?? "action"}`}
                    onClick={onClose}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-800 hover:bg-slate-800"
                  >
                    Хочу похожее решение
                  </a>

                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:border-slate-950 hover:bg-slate-50"
                  >
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
