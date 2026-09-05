import Image from "next/image";
import Link from "next/link";
import type { ServicePageContent } from "@/content/services";
import { Container } from "@/components/ui/container";

type ServiceProofStripProps = {
  service: ServicePageContent;
};

/**
 * T-046: страницы, где все «примеры» — одно и то же фото.
 * Показывать его трижды нечестно и выглядит как заглушка, поэтому для таких
 * услуг оставляем один снимок и честно говорим, что примеры покажем на замере.
 */
const SINGLE_PHOTO_SLUGS = new Set(["individualnye-proekty", "svetoprozrachnye-potolki"]);

export function ServiceProofStrip({ service }: ServiceProofStripProps) {
  const isSinglePhoto = SINGLE_PHOTO_SLUGS.has(service.slug);
  const items = isSinglePhoto ? service.proof.items.slice(0, 1) : service.proof.items;

  return (
    <section
      id="proof"
      aria-labelledby={`${service.slug}-proof-title`}
      className="bg-slate-50 py-16 sm:py-20"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Примеры работ
          </p>

          <h2
            id={`${service.slug}-proof-title`}
            className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {service.proof.sectionTitle}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            {service.proof.sectionIntro}
          </p>
        </div>

        <div className={`mt-10 grid gap-6 ${isSinglePhoto ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
          {items.map((item) => (
            <article
              key={`${service.slug}-${item.title}`}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative aspect-[4/3] bg-slate-100">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1024px) 30vw, 100vw"
                  className="object-cover"
                />
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.summary}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Площадь
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.areaLabel}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Срок
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.timelineLabel}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Ориентир
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {item.priceLabel}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {isSinglePhoto ? (
            <article className="flex flex-col justify-center rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold tracking-tight text-slate-950">
                Покажу примеры на замере
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Такие проекты сильно отличаются друг от друга, поэтому вместо
                случайных фото привожу папку с работами: узлы, схемы и материалы —
                можно посмотреть вживую и потрогать.
              </p>
              <Link
                href="/#proof"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-slate-950 underline underline-offset-4"
              >
                Смотреть работы на главной
              </Link>
            </article>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
