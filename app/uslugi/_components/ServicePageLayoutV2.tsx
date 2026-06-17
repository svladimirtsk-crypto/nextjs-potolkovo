import type { ReactNode } from "react";

import type { ServicePageContent } from "@/content/services";
import { JsonLd } from "@/components/seo/json-ld";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFooter } from "@/components/home/home-footer";
import { MobileStickyCta } from "@/components/home/mobile-sticky-cta";
import { buildBreadcrumbSchema, buildServiceSchema } from "@/lib/seo-schema";

type ServicePageLayoutV2Props = {
  service: ServicePageContent;
  hero: ReactNode;
  proof: ReactNode;
  price: ReactNode;
  trust: ReactNode;
  promise: ReactNode;
  action: ReactNode;
  related?: ReactNode;
  compare?: ReactNode;
  reviews?: ReactNode;
};

export function ServicePageLayoutV2({
  service,
  hero,
  proof,
  price,
  trust,
  promise,
  action,
  related,
  compare,
  reviews,
}: ServicePageLayoutV2Props) {
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Главная", path: "/" },
    { name: service.hero.breadcrumbLabel, path: service.pathname },
  ]);

  return (
    <>
      <JsonLd data={buildServiceSchema(service)} />
      <JsonLd data={breadcrumbSchema} />

      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Перейти к содержимому
      </a>

      <HomeHeader />

      <div className="pb-24 lg:pb-0">
        <main>
          {hero}
          {proof}
          {price}
          {compare ?? null}
          {trust}
          {promise}
          {reviews ?? null}
          {action}
          {related ?? null}
        </main>

        <MobileStickyCta />
        <HomeFooter />
      </div>
    </>
  );
}
