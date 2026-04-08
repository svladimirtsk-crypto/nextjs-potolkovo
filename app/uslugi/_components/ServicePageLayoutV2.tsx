import { ReactNode } from "react";
import { contacts } from "@/content/contacts";
import type { ServicePageContent } from "@/content/services";
import { HomeFooter } from "@/components/home/home-footer";
import { HomeHeader } from "@/components/home/home-header";
import { MobileStickyCta } from "@/components/home/mobile-sticky-cta";
import { PriceCalculatorProvider } from "@/components/home/price-calculator-context";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
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
            {related ?? null}
            {action}
          </main>

          <MobileStickyCta />
        </PriceCalculatorProvider>

        <section className="border-t border-slate-200 bg-slate-50">
          <Container className="py-10 sm:py-12">
            <div className="grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-8">
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {service.hero.badge}
                </p>

                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {service.action.sectionTitle}
                </h2>

                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                  {service.action.sectionSubtitle}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {service.hero.quickFacts.map((fact) => (
                    <span
                      key={fact}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {fact}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
                <Button href="#action" className="justify-center">
                  {service.hero.primaryCtaLabel}
                </Button>

                <Button
                  href={contacts.phoneHref}
                  variant="secondary"
                  className="justify-center"
                >
                  {contacts.phoneDisplay}
                </Button>

                <Button
                  href={contacts.telegramUrl}
                  variant="ghost"
                  className="justify-center"
                >
                  {service.hero.secondaryTelegramCtaLabel}
                </Button>
              </div>
            </div>
          </Container>
        </section>

        <HomeFooter />
      </div>
    </>
  );
}
