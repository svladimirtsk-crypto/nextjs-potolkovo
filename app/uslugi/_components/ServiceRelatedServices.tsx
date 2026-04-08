import Link from "next/link";
import type { ServicePageContent } from "@/content/services";
import { getRelatedServiceLinks } from "@/content/services";
import { Container } from "@/components/ui/container";

type ServiceRelatedServicesProps = {
  service: ServicePageContent;
};

export function ServiceRelatedServices({
  service,
}: ServiceRelatedServicesProps) {
  const related = getRelatedServiceLinks(service.slug);

  if (!related.length) {
    return null;
  }

  return (
    <section
      aria-labelledby={`${service.slug}-related-title`}
      className="bg-white py-16 sm:py-20"
    >
      <Container>
        <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Другие услуги
            </p>

            <h2
              id={`${service.slug}-related-title`}
              className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              Что ещё часто выбирают вместе с этой услугой
            </h2>

            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              Если вы сравниваете решения или хотите собрать комплексный вариант,
              посмотрите смежные услуги ниже.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={item.href}
                className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-colors hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                <p className="text-lg font-semibold text-slate-950">
                  {item.label}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Перейти на страницу услуги и посмотреть детали, примеры работ и
                  ориентир по цене.
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-slate-950 transition-transform group-hover:translate-x-1">
                  Открыть →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
