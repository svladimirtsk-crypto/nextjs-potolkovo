import { LIGHTING_KITS } from "@/lib/lighting-kits";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { LightKitCtaButton } from "./LightKitCtaButton";

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

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
          {LIGHTING_KITS.map((kit) => (
            <div
              key={kit.kitId}
              className="flex flex-col h-full rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex-grow">
                <h3 className="text-lg font-semibold text-slate-950 mb-3">
                  {kit.kitName}
                </h3>

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
                <p className="text-2xl font-bold text-slate-950 mb-4">
                  {fmt(kit.totalRub)} ₽
                </p>

                <LightKitCtaButton kit={kit} />

                <p className="mt-2 text-xs text-slate-400 text-center">
                  Скидка 15% при заказе потолка
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-slate-500">
            Не нашли подходящий комплект? Можно собрать свой.
          </p>
        </div>
      </Container>
    </Section>
  );
}
