import type { ServicePageContent } from "@/content/services";
import { Container } from "@/components/ui/container";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";
import { DISABLED_PRESET_SLUGS } from "@/lib/calculator/presets";

type ServicePriceSectionProps = {
  service: ServicePageContent;
};

export function ServicePriceSection({ service }: ServicePriceSectionProps) {
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

          {service.price.calculatorPreset.introNote ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {service.price.calculatorPreset.introNote}
            </p>
          ) : null}

          <p className="mt-3 text-sm leading-6 text-slate-500">
            {service.price.note}
          </p>
        </div>

        <div className="mt-10">
          {DISABLED_PRESET_SLUGS.has(service.slug) ? (
            /* T-021: пока в прайсе нет типа полотна — считаем по проекту */
            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
              <p className="text-base font-semibold text-slate-950">
                Светопрозрачные полотна считаю по проекту — от 4 000 ₽/м²
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Стоимость зависит от размера полотна, подсветки и способа монтажа. Оставьте заявку —
                посчитаю по вашим размерам.
              </p>
              <a
                href="#action"
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Рассчитать по проекту
              </a>
            </div>
          ) : (
            <CalculatorTeaser
              preset={service.price.calculatorPreset}
              source={`${service.slug}:price`}
            />
          )}
        </div>
      </Container>
    </section>
  );
}
