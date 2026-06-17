"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import type { FeedCatalogResult } from "@/lib/eks-feed2-catalog";

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

const CatalogSectionClient = dynamic(
  () => import("./CatalogSectionClient").then((mod) => mod.CatalogSectionClient),
  {
    ssr: false,
    loading: () => <CatalogLoadingState mode="component" />,
  }
);

function CatalogLoadingState({ mode = "initial" }: { mode?: "initial" | "component" }) {
  return (
    <Section id="price" className="scroll-mt-24 py-10">
      <Container>
        <div className="flex items-start justify-between gap-6">
          <Heading
            title="Каталог освещения"
            description="Подгружаем каталог и подготовим подбор по системам, точкам, лампам и комплектующим."
          />
        </div>

        <div className="mt-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-5 sm:p-6">
          <div className="h-5 w-52 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-11 w-full animate-pulse rounded-2xl bg-white" />

          <div className="mt-6 flex gap-2 overflow-hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-10 w-36 shrink-0 animate-pulse rounded-xl bg-white"
              />
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="grid grid-cols-[5.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
                  <div className="aspect-square animate-pulse rounded-xl bg-slate-100" />
                  <div>
                    <div className="h-4 w-24 animate-pulse rounded-full bg-slate-100" />
                    <div className="mt-3 h-5 w-full animate-pulse rounded bg-slate-100" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-100" />
                    <div className="mt-5 h-4 w-3/5 animate-pulse rounded bg-slate-100" />
                    <div className="mt-5 h-11 w-full animate-pulse rounded-xl bg-slate-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-500">
            {mode === "initial"
              ? "Каталог загрузится, когда пользователь дойдёт до этого блока."
              : "Подключаем интерфейс подбора…"}
          </p>
        </div>
      </Container>
    </Section>
  );
}

function CatalogErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Section id="price" className="scroll-mt-24 py-10">
      <Container>
        <Heading
          title="Каталог освещения"
          description="Не удалось загрузить каталог автоматически. Можно попробовать ещё раз."
        />

        <div className="mt-8 rounded-[2rem] border border-rose-200 bg-rose-50 p-5 sm:p-6">
          <p className="text-sm leading-6 text-rose-900">
            Ошибка загрузки каталога. Проверьте соединение и повторите попытку.
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Повторить загрузку
          </button>
        </div>
      </Container>
    </Section>
  );
}

export function CatalogSection() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [data, setData] = useState<FeedCatalogResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || shouldFetch) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldFetch(true);
        observer.disconnect();
      },
      {
        rootMargin: "600px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [shouldFetch]);

  useEffect(() => {
    if (!shouldFetch || data || isLoading) return;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const response = await fetch("/api/catalog", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const nextData = (await response.json()) as FeedCatalogResult;
        if (cancelled) return;
        setData(nextData);
      } catch {
        if (cancelled) return;
        setHasError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [data, isLoading, shouldFetch]);

  if (hasError && !data) {
    return (
      <div ref={rootRef}>
        <CatalogErrorState
          onRetry={() => {
            setHasError(false);
            setShouldFetch(true);
            setData(null);
          }}
        />
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      {!shouldFetch || (isLoading && !data) ? <CatalogLoadingState /> : null}
      {data ? <CatalogSectionClient data={data} /> : null}
    </div>
  );
}
