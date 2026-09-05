import snapshotData from "@/data/eks-feed2-snapshot.json";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import { calcSystemEntryPrice } from "@/lib/lighting/system-entry-price";

const systems = [
  {
    id: "COLIBRI_220",
    title: "COLIBRI 220V",
    badge: "Рекомендуется",
    /** T-044: ровно три отличия — чтобы карточки можно было сравнить взглядом. */
    differences: [
      "Встроенный в потолок профиль",
      "Питание 220 В — блок питания не нужен",
      "Самый большой выбор светильников",
    ],
  },
  {
    id: "CLARUS_48",
    title: "CLARUS 48V",
    badge: "Нужен БП",
    differences: [
      "Магнитная система 48 В",
      "Ультратонкий профиль",
      "Нужен блок питания и место под него",
    ],
  },
  {
    id: "TRACK_220",
    title: "ART 220V",
    badge: "Накладной",
    differences: [
      "Накладной монтаж — потолок можно не трогать",
      "Питание 220 В напрямую",
      "Подходит, если потолок уже готов",
    ],
  },
] as const;

const nf = new Intl.NumberFormat("ru-RU");

export function TrackSaleSystemGuideSection() {
  // Полный фид читается только на сервере — в клиентский бандл он не попадает.
  const products = normalizeFeedCatalogProducts(
    (snapshotData as { products?: unknown[] }).products ?? []
  );

  return (
    <Section className="bg-white py-12 sm:py-16">
      <Container>
        <Heading
          eyebrow="Как выбрать систему"
          title="COLIBRI, CLARUS или ART — подскажу, что подойдёт"
          description="Если потолок ещё не установлен, систему лучше выбирать вместе с конструкцией потолка. Так проще заложить профиль, питание, блоки и монтаж без переделок."
          align="center"
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {systems.map((system) => {
            const entry = calcSystemEntryPrice(system.id, products);

            return (
              <article
                key={system.title}
                className="rounded-[1.75rem] border border-slate-200 bg-slate-50/80 p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">{system.title}</h3>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                    {system.badge}
                  </span>
                </div>

                {entry ? (
                  <p className="mt-3 text-sm font-semibold text-slate-950">
                    от {nf.format(entry.perMeterWithFixtureRub)} ₽/м со светильником
                  </p>
                ) : null}

                <ul className="mt-3 space-y-1.5 text-sm leading-6 text-slate-700">
                  {system.differences.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span aria-hidden="true" className="text-slate-400">
                        ·
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-950">
          <p className="font-semibold">Главное правило</p>
          <p className="mt-1 text-blue-900/80">
            Если потолок ещё предстоит делать — выгоднее собрать свет и потолок вместе: освещение будет со скидкой 25%, а монтажные узлы сразу заложим правильно.
          </p>
        </div>
      </Container>
    </Section>
  );
}
