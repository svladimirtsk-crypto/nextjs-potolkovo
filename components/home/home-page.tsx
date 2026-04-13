import { HomeHeader } from "./home-header";
import { HomeHero } from "./home-hero";
import { HomeProof } from "./home-proof";
import { HomePrice } from "./home-price";
import { HomeTrust } from "./home-trust";
import { HomePromise } from "./home-promise";
import { HomeAction } from "./home-action";
import { HomeFooter } from "./home-footer";
import { MobileStickyCta } from "./mobile-sticky-cta";

export function HomePage() {
  return (
    <>
      <HomeHeader />
      <div className="pb-24 lg:pb-0">
        <main>
          <HomeHero />
          <HomeProof />
          <HomePrice />
          <HomeTrust />
          <HomePromise />
          <HomeAction />
        </main>
        <MobileStickyCta />
        <HomeFooter />
      </div>
    </>
  );
}
