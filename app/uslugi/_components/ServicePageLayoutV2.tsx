import type { ReactNode } from "react";

import type { ServicePageContent } from "@/content/services";
import { HomeHeader } from "@/components/home/home-header";
import { HomeFooter } from "@/components/home/home-footer";
import { MobileStickyCta } from "@/components/home/mobile-sticky-cta";

type ServicePageLayoutV2Props = {
  service: ServicePageContent;
  hero: ReactNode;
  proof: ReactNode;
  price: ReactNode;
  trust: ReactNode;
  promise: ReactNode;
  action: ReactNode;
  related?: ReactNode;
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
}: ServicePageLayoutV2Props) {
  return (
    <>
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
          {trust}
          {promise}
          {action}
          {related ?? null}
        </main>

        <MobileStickyCta />
        <HomeFooter />
      </div>
    </>
  );
}
