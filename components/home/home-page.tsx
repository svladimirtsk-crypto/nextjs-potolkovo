import { HomeAction } from "./home-action";
import { HomeFooter } from "./home-footer";
import { HomeHeader } from "./home-header";
import { HomeHero } from "./home-hero";
import { HomePrice } from "./home-price";
import { HomePromise } from "./home-promise";
import { HomeProof } from "./home-proof";
import { HomeTrust } from "./home-trust";
import { MobileStickyCta } from "./mobile-sticky-cta";

export function HomePage() {
  return (
    <>
      <HomeHeader />

      <div className="pb-20 md:pb-0">
        <main>
          <HomeHero />
          <HomeProof />
          <HomePrice />
          <HomeTrust />
          <HomePromise />
          <HomeAction />
        </main>

        <HomeFooter />
      </div>

      <MobileStickyCta />
    </>
  );
}
