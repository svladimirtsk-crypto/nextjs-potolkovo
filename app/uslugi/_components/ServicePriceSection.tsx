import type { ServicePageContent } from "@/content/services";
import { Container } from "@/components/ui/container";
import { CalculatorTeaser } from "@/components/calculator-modal/calculator-teaser";
import { servicePriceAnchor } from "@/content/pricing";
import { DISABLED_PRESET_SLUGS } from "@/lib/calculator/presets";
import { projectEntryCtaLabel } from "@/lib/entry-context";

/**
 * PT-008 · Заголовок блока «по проекту» для услуг, где типовой калькулятор
 * не считает честно (`DISABLED_PRESET_SLUGS`).
 *
 * Раньше текст был один и захардкожен под светопрозрачные полотна: после
 * добавления в список индивидуальных проектов он показывал бы на их странице
 * «Светопрозрачные полотна считаю по проекту» — то есть чужой факт.
 *
 * Цена в заголовке берётся из `servicePriceAnchor` (`content/pricing.ts`),
 * а не литералом «от 4 000 ₽/м²»: правило ТЗ запрещает литералы цен вне
 * прайса.
 */
const PROJECT_BLOCK_TITLE: Record<string, string> = {
  "svetoprozrachnye-potolki": "Светопрозрачные полотна считаю по проекту",
  "individualnye-proekty": "Индивидуальные проекты считаю по замеру и конструкции",
};

const PROJECT_BLOCK_TITLE_FALLBACK = "Стоимость считаю по проекту";

/**
 * Пояснение к блоку. Для светопрозрачных полотен сохранён прежний текст;
 * для остальных берётся `price.note` страницы — он уже написан для этой
 * услуги и не обещает расчёт, которого нет.
 */
const PROJECT_BLOCK_TEXT: Record<string, string> = {
  "svetoprozrachnye-potolki":
    "Стоимость зависит от размера полотна, подсветки и способа монтажа. Оставьте заявку — посчитаю по вашим размерам.",
};

/**
 * Для остальных услуг — приглашение, а не факт: цифры и состав работ уже
 * названы в `price.note` выше и в прайсе страницы.
 */
const PROJECT_BLOCK_TEXT_FALLBACK = "Оставьте заявку — посчитаю по вашим размерам и задаче.";

type ServicePriceSectionProps = {
  service: ServicePageContent;
};

export function ServicePriceSection({ service }: ServicePriceSectionProps) {
  const anchor = servicePriceAnchor(service.slug);
  const presetDisabled = DISABLED_PRESET_SLUGS.has(service.slug);

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

          {/*
            * PT-008: `sectionIntro` и `calculatorPreset.introNote` у услуг без
            * честного расчёта буквально обещают «калькулятор ниже» — его там
            * нет. Тексты `content/services.ts` не правим (правило 0.4 ТЗ v2):
            * вместо них показываем `price.note` этой же услуги, он про замер и
            * смету, а не про калькулятор.
            */}
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {presetDisabled ? service.price.note : service.price.sectionIntro}
          </p>

          {!presetDisabled && service.price.calculatorPreset.introNote ? (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {service.price.calculatorPreset.introNote}
            </p>
          ) : null}

          {presetDisabled ? null : (
            <p className="mt-3 text-sm leading-6 text-slate-500">{service.price.note}</p>
          )}
        </div>

        <div className="mt-10">
          {presetDisabled ? (
            /* T-021 · PT-008: по таким услугам считаем только по проекту */
            <div
              className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8"
              data-testid="project-entry-block"
            >
              <p className="text-base font-semibold text-slate-950">
                {PROJECT_BLOCK_TITLE[service.slug] ?? PROJECT_BLOCK_TITLE_FALLBACK}
                {anchor.value ? ` — ${anchor.label}` : ""}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {PROJECT_BLOCK_TEXT[service.slug] ?? PROJECT_BLOCK_TEXT_FALLBACK}
              </p>
              <a
                href="#action"
                data-testid="project-entry-cta"
                className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {projectEntryCtaLabel()}
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
