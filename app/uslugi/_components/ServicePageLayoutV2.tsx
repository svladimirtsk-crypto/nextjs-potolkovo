import { ReactNode } from "react";
import type { ServicePageContent } from "@/content/services";
import { HomeFooter } from "@/components/home/home-footer";
import { HomeHeader } from "@/components/home/home-header";
import { MobileStickyCta } from "@/components/home/mobile-sticky-cta";
import { PriceCalculatorProvider } from "@/components/home/price-calculator-context";

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
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-full focus-visible:bg-slate-950 focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-white"
      >
        Перейти к содержимому
      </a>

      <HomeHeader />

      <div className="pb-24 lg:pb-0">
        <PriceCalculatorProvider>
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
        </PriceCalculatorProvider>

        <HomeFooter />
      </div>
    </>
  );
}
