import snapshotData from "@/data/eks-feed2-snapshot.json";

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem } from "@/lib/calculator-modal-types";
import { LightKitCtaButton } from "./LightKitCtaButton";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

type SnapshotCatalogShape = { products?: FeedCatalogProduct[] };

function bySystem(products: FeedCatalogProduct[], system: FeedCatalogProduct["system"]) {
  return products.filter((p) => p.system === system);
}

function firstAvailable(products: FeedCatalogProduct[], kind: FeedCatalogProduct["kind"]) {
  return products.find((p) => p.kind === kind && p.available !== false) ?? null;
}

function buildSet(
  title: string,
  systemProducts: FeedCatalogProduct[],
  defaultFixtureQty: number
): { title: string; items: LightingItem[] } | null {
  const fixture = firstAvailable(systemProducts, "TRACK_FIXTURE");
  const profile = firstAvailable(systemProducts, "TRACK_PROFILE");

  if (!fixture || !profile) return null;

  return {
    title,
    items: [
      {
        sku: profile.productId,
        name: profile.name,
        qty: 2,
        priceRub: profile.priceRub,
      },
      {
        sku: fixture.productId,
        name: fixture.name,
        qty: defaultFixtureQty,
        priceRub: fixture.priceRub,
      },
    ],
  };
}

export function LightKitShowcase() {
  const catalog = snapshotData as unknown as SnapshotCatalogShape;
  const products = (catalog.products ?? []).filter((p) => Number.isFinite(p.priceRub) && p.priceRub > 0);

  const colibri = buildSet("COLIBRI 220V: готовый старт", bySystem(products, "COLIBRI_220"), 5);
  const clarus = buildSet("CLARUS 48V: готовый старт", bySystem(products, "CLARUS_48"), 5);
  const art = buildSet("ART 220V: готовый старт", bySystem(products, "TRACK_220"), 4);

  const sets = [colibri, clarus, art].filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <Section id="proof" className="scroll-mt-24 bg-slate-50">
      <Container>
        <Heading
          eyebrow="Готовые комплекты"
          title="Готовые наборы на базе feed2"
          description="Комплекты собраны из актуального feed2 snapshot. Цены и товары совпадают с каталогом."
        />

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => {
            const totalRub = set.items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
            const discounted = applyLightingDiscount(totalRub);

            return (
              <div
                key={set.title}
                className="flex h-full flex-col rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex-grow">
                  <h3 className="mb-1 text-lg font-semibold text-slate-950">{set.title}</h3>
                  <ul className="space-y-1.5">
                    {set.items.map((item) => (
                      <li key={item.sku} className="flex justify-between gap-2 text-sm text-slate-600">
                        <span>{item.name}</span>
                        <span className="shrink-0 text-slate-400">× {item.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-400 line-through">{fmt(totalRub)} ₽</p>
                  <p className="text-2xl font-bold text-emerald-600">{fmt(discounted)} ₽</p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-700">−15% при заказе потолка</p>

                  <div className="mt-4">
                    <LightKitCtaButton title={set.title} items={set.items} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">
            Точечные светильники и лампы 1:1 выбирайте в каталоге ниже.
          </p>
        </div>
      </Container>
    </Section>
  );
}
