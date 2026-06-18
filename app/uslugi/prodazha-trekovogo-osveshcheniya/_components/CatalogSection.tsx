"use client";

import dynamic from "next/dynamic";

import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { FeedCatalogProduct, FeedCatalogResult } from "@/lib/eks-feed2-catalog";

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

const snapshotCatalogData: FeedCatalogResult = {
  ok: true,
  updatedAt: String((snapshotData as { updatedAt?: unknown }).updatedAt ?? new Date().toISOString()),
  source: "snapshot",
  discountPercentForCeilingOrder: 25,
  categories: [],
  products: ((snapshotData as { products?: unknown[] }).products ?? []) as FeedCatalogProduct[],
};

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
              ? "Готовим каталог освещения — скоро можно будет выбрать комплект."
              : "Готовим подбор освещения…"}
          </p>
        </div>
      </Container>
    </Section>
  );
}

export function CatalogSection() {
  return <CatalogSectionClient data={snapshotCatalogData} />;
}
