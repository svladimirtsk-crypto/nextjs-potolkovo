import { HomeAction } from "./home-action";
import { HomeFooter } from "./home-footer";
import { HomeHeader } from "./home-header";
import { HomeHero } from "./home-hero";
import { HomePrice } from "./home-price";
import { HomePromise } from "./home-promise";
import { HomeProof } from "./home-proof";
import { HomeTrust } from "./home-trust";
import { MobileStickyCta } from "./mobile-sticky-cta";
import { PriceCalculatorProvider } from "./price-calculator-context";

export function HomePage() {
  return (
    <>
      <HomeHeader />
      <HomeHero />

      <PriceCalculatorProvider>
        <HomeProof />
        <HomePrice />
        <HomeTrust />
        <HomePromise />
        <HomeAction />
        <MobileStickyCta />
      </PriceCalculatorProvider>

      <HomeFooter />
    </>
  );
}
