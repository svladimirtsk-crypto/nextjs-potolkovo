import Image from "next/image";
import Link from "next/link";
import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

type ServiceHeroProps = {
  service: ServicePageContent;
};

export function ServiceHero({ service }: ServiceHeroProps) {
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
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              {service.hero.badge}
            </div>

            <h1
              id={`${service.slug}-hero-title`}
              className="mt-5 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
            >
              {service.hero.h1}
            </h1>

            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
              {service.hero.subtitle}
            </p>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              {service.hero.supportingText}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                {service.hero.priceBadge}
              </div>

              <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                {contacts.regionLabel}
              </div>
            </div>

            {isTrackSalePage ? (
              <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-2xl font-bold tracking-tight text-emerald-700">−10%</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Только освещение</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Если потолок уже готов или нужен только комплект света.</p>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-2xl font-bold tracking-tight text-blue-700">−25%</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Освещение + потолок</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Максимальная выгода и правильные узлы монтажа.</p>
                </div>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button href={primaryHref} className="justify-center">
                {service.hero.primaryCtaLabel}
              </Button>

              {isTrackSalePage ? (
                <Button href="#price" variant="secondary" className="justify-center">
                  Добавить потолок −25%
                </Button>
              ) : (
                <Button
                  href={contacts.telegramUrl}
                  variant="secondary"
                  className="justify-center"
                >
                  {service.hero.secondaryTelegramCtaLabel}
                </Button>
              )}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              Телефон:{" "}
              <a
                href={contacts.phoneHref}
                className="font-semibold text-slate-950 underline underline-offset-4"
              >
                {contacts.phoneDisplay}
              </a>
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              {service.hero.quickFacts.map((fact) => (
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
                <Image
                  src={service.hero.imageSrc}
                  alt={service.hero.imageAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 48vw, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
