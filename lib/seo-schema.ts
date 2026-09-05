import { contacts } from "@/content/contacts";
import { homepage } from "@/content/homepage";
import type { ServicePageContent } from "@/content/services";

const SITE_URL = "https://potolkovo-msk.ru";
const ORGANIZATION_ID = `${SITE_URL}#organization`;

export type FaqSchemaItem = {
  q: string;
  a: string;
};

type BreadcrumbItem = {
  name: string;
  path: string;
};

function toAbsoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

function getSharedProvider() {
  return {
    "@id": ORGANIZATION_ID,
    "@type": "LocalBusiness",
    name: contacts.brandName,
    url: SITE_URL,
    telephone: contacts.phoneDisplay,
    email: contacts.emailDisplay,
    areaServed: [contacts.cityLabel, contacts.regionLabel],
  };
}

export function buildLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": ORGANIZATION_ID,
    name: contacts.brandName,
    url: SITE_URL,
    image: toAbsoluteUrl("/hero1.jpeg"),
    telephone: contacts.phoneDisplay,
    email: contacts.emailDisplay,
    address: {
      "@type": "PostalAddress",
      addressLocality: contacts.cityLabel,
      addressRegion: contacts.regionLabel,
      addressCountry: "RU",
    },
    areaServed: [
      {
        "@type": "City",
        name: contacts.cityLabel,
      },
      {
        "@type": "AdministrativeArea",
        name: contacts.regionLabel,
      },
    ],
    openingHours: "Mo-Su 09:00-21:00",
    sameAs: [contacts.telegramUrl],
  };
}

export function buildHomeServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: homepage.hero.h1,
    description: homepage.metadata.description,
    url: SITE_URL,
    areaServed: [contacts.cityLabel, contacts.regionLabel],
    provider: getSharedProvider(),
    serviceType: homepage.hero.servicesInlineLabel,
  };
}

export function buildServiceSchema(service: ServicePageContent) {
  const offer = service.price.offerFrom;

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.hero.h1,
    description: service.metadata.description,
    url: toAbsoluteUrl(service.pathname),
    areaServed: [contacts.cityLabel, contacts.regionLabel],
    provider: getSharedProvider(),
    serviceType: service.hero.breadcrumbLabel,
    image: toAbsoluteUrl(service.hero.imageSrc),

    /*
     * T-063: цена «от» в машиночитаемом виде — это то, что показывает
     * поисковик в сниппете. Услуги без фиксированной ставки («по расчёту»)
     * идут без Offer: выдуманный minPrice — прямой путь к санкциям.
     */
    ...(offer
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "RUB",
            availability: "https://schema.org/InStock",
            url: toAbsoluteUrl(service.pathname),
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              priceCurrency: "RUB",
              minPrice: offer.minPrice,
              unitText: offer.unitText,
            },
          },
        }
      : null),
  };
}

/** T-063: карточка товара/комплекта для страницы света. */
export type ProductOfferInput = {
  name: string;
  priceRub: number;
  url: string;
  image?: string | null;
  sku?: string | null;
  brand?: string | null;
};

/**
 * `ItemList` из товарных офферов. Используется на странице продажи света:
 * готовые комплекты и топ каталога — это реальные позиции с ценой,
 * поэтому им положен Product/Offer, а не абстрактный Service.
 */
export function buildProductListSchema(items: ProductOfferInput[], listName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: item.name,
        ...(item.image ? { image: toAbsoluteUrl(item.image) } : null),
        ...(item.sku ? { sku: item.sku } : null),
        ...(item.brand ? { brand: { "@type": "Brand", name: item.brand } } : null),
        offers: {
          "@type": "Offer",
          priceCurrency: "RUB",
          price: item.priceRub,
          availability: "https://schema.org/InStock",
          url: toAbsoluteUrl(item.url),
          seller: getSharedProvider(),
        },
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}

export function buildFaqSchema(items: FaqSchemaItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}
