"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { homeAssets } from "@/content/home-assets";
import { useCalculatorModal } from "@/components/calculator-modal/calculator-modal-context";
import type { ServiceCalculatorPreset } from "@/content/services";

type ProofItem = {
  slug: string;
  title: string;
  serviceType: string;
  roomType: string;
  summary: string;
  areaLabel?: string;
  timelineLabel?: string;
  priceLabel?: string;
  imageAssetKey: string;
  alt: string;
  ctaLabel: string;
  actionTargetId: string;
  addressLabel?: string;
  challenge?: string;
  workDone?: string;
  configurationLines?: readonly string[];
  scopeLabel?: string;
  budgetNote?: string;
  budgetBreakdown?: {
    ceilingWorksRub: number;
    lightingRawRub: number;
    lightingDiscountPercent: number;
    lightingDiscountedRub: number;
    customCharges: readonly { label: string; amountRub: number }[];
    totalRub: number;
  };
  actionPreset?: ServiceCalculatorPreset;
};

type ProofModalClientProps = {
  items: readonly ProofItem[];
  selectedIndex: number | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(value));
}

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
  const { openCalculator } = useCalculatorModal();

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
    const frame = requestAnimationFrame(() => setActiveImageIndex(0));
    return () => cancelAnimationFrame(frame);
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

  const handleWantSame = () => {
    onClose();

    const preset = (item.actionPreset ?? {
      ceilingType: "standard",
    }) as ServiceCalculatorPreset;

    openCalculator({
      preset,
      forcePreset: true,
      // T-021: единый формат источника "<slug>:<placement>"
      source: `${item.slug}:proof`,
    });
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={item.title}>
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/72"
        aria-label="Закрыть окно"
      />

      <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden bg-white text-slate-950 lg:inset-y-4 lg:left-1/2 lg:w-[min(1180px,calc(100vw-2rem))] lg:-translate-x-1/2 lg:rounded-[2rem]">
        <div className="flex h-full flex-col">
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

          <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
            <div className="grid h-full lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="relative aspect-[5/4] overflow-hidden bg-slate-100 lg:min-h-0 lg:flex-1 lg:aspect-auto">
                  <Image
                    src={activeImage}
                    alt={`${item.alt} — фото ${safeImageIndex + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 58vw"
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

              <div className="flex min-h-0 flex-col p-5 sm:p-6 lg:p-8">
                <div>
                  <p className="text-sm font-medium text-slate-500">{item.serviceType}</p>

                  <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                    {item.title}
                  </h3>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.roomType}
                    </span>

                    {item.addressLabel ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        {item.addressLabel}
                      </span>
                    ) : null}

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

                    {item.scopeLabel ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                        {item.scopeLabel}
                      </span>
                    ) : null}
                  </div>

                  {item.summary ? (
                    <p className="mt-6 text-base leading-7 text-slate-600">{item.summary}</p>
                  ) : null}

                  {item.challenge ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Задача</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.challenge}</p>
                    </div>
                  ) : null}

                  {item.workDone ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Что сделано</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.workDone}</p>
                    </div>
                  ) : null}

                  {item.configurationLines?.length ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Конфигурация</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                        {item.configurationLines.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
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

                      {item.budgetNote ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.budgetNote}</p>
                      ) : null}

                      {item.budgetBreakdown ? (
                        <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span>Потолок и монтаж</span>
                            <span className="font-medium">{formatCurrency(item.budgetBreakdown.ceilingWorksRub)} ₽</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Освещение без скидки</span>
                            <span className="line-through text-slate-400">{formatCurrency(item.budgetBreakdown.lightingRawRub)} ₽</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 text-emerald-700">
                            <span>Освещение со скидкой −{item.budgetBreakdown.lightingDiscountPercent}%</span>
                            <span className="font-medium">{formatCurrency(item.budgetBreakdown.lightingDiscountedRub)} ₽</span>
                          </div>
                          {item.budgetBreakdown.customCharges?.map((charge) => (
                            <div key={charge.label} className="flex items-center justify-between gap-3">
                              <span>{charge.label}</span>
                              <span className="font-medium">{formatCurrency(charge.amountRub)} ₽</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3 font-semibold text-slate-950">
                            <span>Итого по кейсу</span>
                            <span>{formatCurrency(item.budgetBreakdown.totalRub)} ₽</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-8 space-y-3 lg:mt-auto">
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                    <p className="font-semibold">Что будет дальше</p>
                    <ul className="mt-2 space-y-1.5 text-blue-900/80">
                      <li>1. Загружу стартовые параметры по этому кейсу.</li>
                      <li>2. Вы проверите площадь и метры нужных участков.</li>
                      <li>3. Затем можно уточнить свет и получить общий ориентир.</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={handleWantSame}
                    className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-950 bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-slate-800 hover:bg-slate-800"
                  >
                    Хочу похожее решение
                  </button>

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
