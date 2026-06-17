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
