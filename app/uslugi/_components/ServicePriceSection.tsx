import type { ServicePageContent } from "@/content/services";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServicePriceSectionProps = {
  service: ServicePageContent;
};

export function ServicePriceSection({ service }: ServicePriceSectionProps) {
  const presetNote = service.price.calculatorPreset.introNote;

  return (
    <section
      id="price"
      aria-labelledby={`${service.slug}-price-title`}
      className="scroll-mt-24 bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Цена
          </p>

          <h2
            id={`${service.slug}-price-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.price.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.price.sectionIntro}
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Ориентир по услуге
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  {service.price.fromLabel}
                </p>
              </div>

              <Button href="#action" variant="secondary" className="justify-center">
                {service.hero.primaryCtaLabel}
              </Button>
            </div>

            {presetNote ? (
              <p className="mt-4 text-sm leading-6 text-slate-600">{presetNote}</p>
            ) : null}

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {service.price.note}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-950">
              Что дальше после расчёта
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>• Сохраняем параметры расчёта в форме заявки.</li>
              <li>• Уточняем адрес или район и формат помещения.</li>
              <li>• Фиксируем точную смету после замера.</li>
            </ul>
          </div>
        </div>

        <div className="mt-10">
          <PriceCalculatorClient
            key={service.slug}
            preset={service.price.calculatorPreset}
          />
        </div>
      </Container>
    </section>
  );
}
