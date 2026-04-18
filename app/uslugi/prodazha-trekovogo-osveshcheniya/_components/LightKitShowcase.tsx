// app/uslugi/prodazha-trekovogo-osveshcheniya/_components/LightKitShowcase.tsx

import { LIGHTING_KITS } from "@/lib/lighting-kits";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { LightKitCtaButton } from "./LightKitCtaButton";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

// Только трековые киты в этой секции
const TRACK_KITS = LIGHTING_KITS.filter(
  (k) => k.kitCategory === "track-built-in" || k.kitCategory === "track-surface"
);

export function LightKitShowcase() {
  return (
    <Section id="proof" className="scroll-mt-24 bg-slate-50">
      <Container>
        <Heading
          eyebrow="Готовые комплекты"
          title="Трековое освещение под ключ"
          description="Подобранные комплекты — от профиля до спотов. Скидка 15% на всё оборудование при заказе натяжного потолка."
        />

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TRACK_KITS.map((kit) => {
            const discountedTotal = applyLightingDiscount(kit.totalRub);

            return (
              <div
                key={kit.kitId}
                className="flex flex-col h-full rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex-grow">
                  {/* Название — baseName без жёсткого qty (qty в defaultSpotsQty) */}
                  <h3 className="text-lg font-semibold text-slate-950 mb-1">
                    {kit.kitBaseName}
                  </h3>
                  <p className="text-sm text-slate-500 mb-3">
                    Базовый комплект · {kit.defaultSpotsQty} светильника
                  </p>

                  <ul className="space-y-1.5">
                    {kit.items.map((item) => (
                      <li
                        key={item.sku}
                        className="text-sm text-slate-600 flex justify-between gap-2"
                      >
                        <span>{item.name}</span>
                        <span className="text-slate-400 shrink-0">
                          × {item.qty}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  {/* Две цены */}
                  <div className="mb-1">
                    <p className="text-sm text-slate-400 line-through">
                      {fmt(kit.totalRub)} ₽
                    </p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {fmt(discountedTotal)} ₽
                    </p>
                    <p className="text-xs text-emerald-700 font-medium mt-0.5">
                      −15% при заказе потолка
                    </p>
                  </div>

                  <div className="mt-4">
                    <LightKitCtaButton kit={kit} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">
            Точечные светильники (GX53/MR16) — в каталоге ниже или в калькуляторе.
          </p>
        </div>
      </Container>
    </Section>
  );
}
