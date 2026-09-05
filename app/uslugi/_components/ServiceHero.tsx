import { servicePriceAnchor } from "@/content/pricing";
import { Picture } from "@/components/ui/picture";
import Link from "next/link";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ServiceHeroLightingCta } from "./ServiceHeroLightingCta";
import { ServiceHeroCta } from "./ServiceHeroCta";

type ServiceHeroProps = {
  /** T-014: вычисляемый ценовой якорь вместо статичного бейджа. */
  priceBadgeOverride?: string;
  service: ServicePageContent;
};

export function ServiceHero({ service, priceBadgeOverride }: ServiceHeroProps) {
  // N-002: цена берётся из прайса, а не из строкового литерала в services.ts.
  const priceAnchor = servicePriceAnchor(service.slug);
  const isTrackSalePage = service.slug === "prodazha-trekovogo-osveshcheniya";
  const primaryHref = isTrackSalePage ? "#price" : "#action";

  return (
    <section
      id="hero"
      aria-labelledby={`${service.slug}-hero-title`}
      className="bg-white py-10 sm:py-12 lg:py-16"
    >
      <Container>
        <nav aria-label="Хлебные крошки" className="mb-6">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                Главная
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-slate-950">{service.hero.breadcrumbLabel}</li>
          </ol>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <h1
              id={`${service.slug}-hero-title`}
              className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
            >
              {service.hero.h1}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {service.hero.subtitle}
            </p>

            {/*
              T-046 · Диета героя: убраны supportingText, бейдж «Услуга»,
              бейдж региона (регион живёт в title и футере) и строка телефона.
              Остаётся ценовой якорь — крупно, как главный факт экрана.
            */}
            <p className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {priceBadgeOverride ?? priceAnchor.label}
            </p>
            {!priceBadgeOverride && priceAnchor.note ? (
              <p className="mt-2 text-sm text-slate-600">{priceAnchor.note}</p>
            ) : null}

            {/* T-045: вместо двух крупных «штампов» — одна спокойная строка про скидки. */}
            {isTrackSalePage ? (
              <p className="mt-6 text-sm font-semibold text-slate-700">
                −10 % на свет · −25 % при заказе потолка
              </p>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {isTrackSalePage ? (
                <>
                  <Button href={primaryHref} className="justify-center">
                    {service.hero.primaryCtaLabel}
                  </Button>
                  <ServiceHeroLightingCta label="Открыть в калькуляторе" />
                </>
              ) : (
                <>
                  {/* Primary ведёт в калькулятор с пресетом этой услуги. */}
                  <ServiceHeroCta slug={service.slug} label="Рассчитать с этим узлом" />
                  <a
                    href="#action"
                    className="min-h-11 text-center text-sm font-semibold text-slate-700 underline underline-offset-4 transition-colors hover:text-slate-950 sm:text-left"
                  >
                    Записаться на замер
                  </a>
                </>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {service.hero.quickFacts.slice(0, 3).map((fact) => (
                <span
                  key={fact}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                >
                  {fact}
                </span>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 shadow-sm">
              <div className="relative aspect-[4/3]">
                <Picture
                  src={service.hero.imageSrc}
                  alt={service.hero.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 48vw, 100vw"
                  imgClassName="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
