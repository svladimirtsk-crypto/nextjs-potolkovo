import { Picture } from "@/components/ui/picture";

import snapshotData from "@/data/eks-feed2-snapshot.json";

import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";

import {
  applyLightingOnlyDiscount,
  applyLightingWithCeilingDiscount,
} from "@/lib/lighting-formulas";
import { normalizeFeedCatalogProducts } from "@/lib/feed2-snapshot-normalize";
import { applyVendorOverrides } from "@/lib/vendor-code-overrides";
import { detectSocket } from "@/lib/feed2-products";
import { isRemovedColibriVendorCode } from "@/lib/catalog-ui-config";

import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { LightingItem } from "@/lib/calculator-modal-types";
import type { ProductOfferInput } from "@/lib/seo-schema";

import { LightKitCtaButton } from "./LightKitCtaButton";

function fmtRub(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getProducts(): FeedCatalogProduct[] {
  // T-014: единая нормализация + оверрайды, как во всём каталоге
  const catalog = snapshotData as unknown as { products?: unknown[] };
  return normalizeFeedCatalogProducts(catalog.products ?? [])
    .map((p) => applyVendorOverrides(p))
    .filter((p) => toNumber(p.priceRub) > 0 && p.available !== false);
}

/** T-014: ввод питания COLIBRI обязателен в каждом комплекте. */
const COLIBRI_POWER_FEED_VENDOR_CODE = "0У-00001343";
/** T-014: прямой соединитель COLIBRI для стыков профилей. */
const COLIBRI_STRAIGHT_CONNECTOR_VENDOR_CODE = "0У-00001344";

function findByVendorCode(products: FeedCatalogProduct[], vendorCode: string): FeedCatalogProduct | null {
  const code = toText(vendorCode);
  if (!code) return null;

  return (
    products.find((p) => toText(p.vendorCode) === code) ??
    products.find((p) => toText(p.productId) === code) ??
    null
  );
}

function itemFromProduct(product: FeedCatalogProduct, qty: number): LightingItem {
  return {
    sku: toText(product.productId),
    name: toText(product.name),
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

function pickColibriProfileByLength(
  products: FeedCatalogProduct[],
  pieceLengthMeters: 1 | 2
): FeedCatalogProduct | null {
  const candidates = products
    .filter((p) => p.system === "COLIBRI_220")
    .filter((p) => p.kind === "TRACK_PROFILE")
    .filter((p) => !isRemovedColibriVendorCode(p.vendorCode))
    .filter((p) => p.available !== false);

  // 1) Prefer exact pieceLengthMeters from snapshot
  const exact = candidates.find((p) => {
    const len = p.pieceLengthMeters;
    return typeof len === "number" && Math.abs(len - pieceLengthMeters) < 0.001;
  });
  if (exact) return exact;

  // 2) Fallback: parse name
  const mm = pieceLengthMeters === 2 ? 2000 : 1000;
  const nameMatch = candidates.find((p) => toText(p.name).includes(`${mm}`));
  return nameMatch ?? candidates[0] ?? null;
}

function pickLampBySocket(products: FeedCatalogProduct[], socket: "MR16" | "GX53"): FeedCatalogProduct | null {
  const lamps = products
    .filter((p) => p.kind === "LAMP")
    .filter((p) => p.available !== false)
    .filter((p) => detectSocket(p) === socket)
    .sort((a, b) => toNumber(a.priceRub) - toNumber(b.priceRub));

  return lamps[0] ?? null;
}

type KitCard = {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  items: LightingItem[];
};

function buildKitKitchen(products: FeedCatalogProduct[]): KitCard | null {
  const profile2000 = pickColibriProfileByLength(products, 2);
  const profile1000 = pickColibriProfileByLength(products, 1);

  const f1335 = findByVendorCode(products, "0У-00001335");
  const f1338 = findByVendorCode(products, "0У-00001338");
  const cornerJoin = findByVendorCode(products, "0У-00006095");
  const cornerConn = findByVendorCode(products, "0У-00001342");

  if (!profile2000 || !profile1000 || !f1335 || !f1338 || !cornerJoin || !cornerConn) return null;

  const powerFeed = findByVendorCode(products, COLIBRI_POWER_FEED_VENDOR_CODE);
  if (!powerFeed) return null;

  const items: LightingItem[] = [
    itemFromProduct(profile2000, 1),
    itemFromProduct(profile1000, 1),
    itemFromProduct(f1335, 2),
    itemFromProduct(f1338, 3),
    itemFromProduct(cornerJoin, 1),
    itemFromProduct(cornerConn, 1),
    itemFromProduct(powerFeed, 1),
  ];

  const imageSrc = toText(f1335.coverImage) || "/svc-tracksale.jpeg";

  return {
    title: "Для кухни — COLIBRI",
    subtitle: "Профиль 2 м + 1 м, 5 светильников и угол",
    imageSrc,
    imageAlt: "Комплект трекового освещения для кухни (COLIBRI)",
    items,
  };
}

function buildKitLiving(products: FeedCatalogProduct[]): KitCard | null {
  const profile2000 = pickColibriProfileByLength(products, 2);
  const profile1000 = pickColibriProfileByLength(products, 1);

  const f1335 = findByVendorCode(products, "0У-00001335");
  const f1339 = findByVendorCode(products, "0У-00001339");
  const f1336 = findByVendorCode(products, "0У-00001336");
  const cornerJoin = findByVendorCode(products, "0У-00006095");
  const cornerConn = findByVendorCode(products, "0У-00001342");

  if (!profile2000 || !profile1000 || !f1335 || !f1339 || !f1336 || !cornerJoin || !cornerConn) return null;

  const powerFeed = findByVendorCode(products, COLIBRI_POWER_FEED_VENDOR_CODE);
  const straightConnector = findByVendorCode(products, COLIBRI_STRAIGHT_CONNECTOR_VENDOR_CODE);
  if (!powerFeed || !straightConnector) return null;

  const profilePieces = 4 + 2;
  const corners = 4;
  // Стыки, которые не закрыты угловыми коннекторами
  const straightJoints = Math.max(0, profilePieces - corners - 1);

  const items: LightingItem[] = [
    itemFromProduct(profile2000, 4),
    itemFromProduct(profile1000, 2),
    itemFromProduct(f1335, 2),
    itemFromProduct(f1339, 4),
    itemFromProduct(f1336, 2),
    itemFromProduct(cornerJoin, 4),
    itemFromProduct(cornerConn, 4),
    itemFromProduct(powerFeed, 1),
    ...(straightJoints > 0 ? [itemFromProduct(straightConnector, straightJoints)] : []),
  ];

  const imageSrc = toText(f1339.coverImage) || "/svc-tracksale.jpeg";

  return {
    title: "Для гостиной — COLIBRI",
    subtitle: "6 м профиля, 8 светильников и 4 угла",
    imageSrc,
    imageAlt: "Комплект трекового освещения для гостиной (COLIBRI)",
    items,
  };
}

function buildKitHallway(products: FeedCatalogProduct[]): KitCard | null {
  const profileArt = findByVendorCode(products, "0У-00001355");
  const fixtureArt = findByVendorCode(products, "0У-00006327");
  const lampMr16 = pickLampBySocket(products, "MR16");

  if (!profileArt || !fixtureArt || !lampMr16) return null;

  const items: LightingItem[] = [
    itemFromProduct(profileArt, 1),
    itemFromProduct(fixtureArt, 4),
    itemFromProduct(lampMr16, 4),
  ];

  const imageSrc = toText(fixtureArt.coverImage) || "/svc-tracksale.jpeg";

  return {
    title: "Для прихожей — ART",
    subtitle: "1 профиль, 4 светильника + лампы MR16 (1:1)",
    imageSrc,
    imageAlt: "Комплект трекового освещения для прихожей (ART)",
    items,
  };
}

function calcTotals(items: LightingItem[]) {
  const totalRub = items.reduce((sum, i) => sum + i.qty * i.priceRub, 0);
  const lightingOnlyRub = applyLightingOnlyDiscount(totalRub);
  const withCeilingRub = applyLightingWithCeilingDiscount(totalRub);
  const lightingOnlyBenefitRub = Math.max(0, Math.round(totalRub - lightingOnlyRub));
  const withCeilingBenefitRub = Math.max(0, Math.round(totalRub - withCeilingRub));
  return { totalRub, lightingOnlyRub, withCeilingRub, lightingOnlyBenefitRub, withCeilingBenefitRub };
}

/** T-014: минимальная цена комплекта «с потолком» — источник ценового якоря страницы. */
export function getKitsPriceAnchorRub(): number | null {
  const products = getProducts();
  const kits = [buildKitKitchen(products), buildKitLiving(products), buildKitHallway(products)].filter(
    (kit): kit is KitCard => kit !== null
  );
  if (kits.length === 0) return null;
  return Math.min(...kits.map((kit) => calcTotals(kit.items).withCeilingRub));
}

/**
 * T-063 · Данные для schema.org: 3 готовых комплекта и топ каталога.
 *
 * Это реальные позиции с ценой, поэтому в разметке они идут как Product/Offer,
 * а не как абстрактный Service страницы.
 */
export function getTrackSaleProductOffers(topProductsLimit = 12): {
  kits: ProductOfferInput[];
  topProducts: ProductOfferInput[];
} {
  const products = getProducts();

  const kits = [buildKitKitchen(products), buildKitLiving(products), buildKitHallway(products)]
    .filter((kit): kit is KitCard => kit !== null)
    .map((kit) => ({
      name: kit.title,
      // Цена комплекта — со скидкой «только свет»: именно её видит покупатель.
      priceRub: calcTotals(kit.items).lightingOnlyRub,
      url: "/uslugi/prodazha-trekovogo-osveshcheniya",
      image: kit.imageSrc,
    }));

  const topProducts = [...products]
    .sort((a, b) => toNumber(b.priceRub) - toNumber(a.priceRub))
    .slice(0, topProductsLimit)
    .map((product) => ({
      name: toText(product.name),
      priceRub: toNumber(product.priceRub),
      url: "/uslugi/prodazha-trekovogo-osveshcheniya",
      image: toText(product.coverImage) || null,
      sku: toText(product.vendorCode) || null,
      brand: toText(product.system).toUpperCase() || null,
    }));

  return { kits, topProducts };
}

export function LightKitShowcase() {
  const products = getProducts();

  const kits = [
    buildKitKitchen(products),
    buildKitLiving(products),
    buildKitHallway(products),
  ].filter((x): x is KitCard => x !== null);

  return (
    <Section className="bg-white">
      <Container>
        <Heading
          eyebrow="Готовые комплекты"
          title="Быстрый старт: самые популярные наборы"
          description="Можно взять готовый комплект и дальше настроить его под ваш интерьер в калькуляторе."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {kits.map((kit) => {
            const { totalRub, lightingOnlyRub, withCeilingRub, lightingOnlyBenefitRub, withCeilingBenefitRub } = calcTotals(kit.items);

            return (
              <article
                key={kit.title}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
              >
                <div className="relative aspect-[16/10] w-full bg-slate-100">
                  <Picture
                    src={kit.imageSrc}
                    alt={kit.imageAlt}
                    fill
                    sizes="(max-width: 1280px) 100vw, 520px"
                    imgClassName="object-cover"
                  />
                </div>

                <div className="p-6">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                      {kit.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{kit.subtitle}</p>
                  </div>

                  <ul className="mt-5 space-y-2 text-sm text-slate-700">
                    {kit.items.map((item) => (
                      <li key={`${item.sku}-${item.name}`} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                        <span className="leading-snug">
                          {item.name} × <span className="font-semibold">{item.qty}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="text-sm text-slate-600">
                        Без скидки: <span className="font-semibold text-slate-950 line-through decoration-slate-400">{fmtRub(totalRub)} ₽</span>
                      </p>
                      <p className="text-sm text-emerald-700">
                        Только свет: <span className="font-semibold">{fmtRub(lightingOnlyRub)} ₽</span> · −10% (−{fmtRub(lightingOnlyBenefitRub)} ₽)
                      </p>
                      <p className="text-sm text-blue-700">
                        С потолком: <span className="font-semibold">{fmtRub(withCeilingRub)} ₽</span> · −25% (−{fmtRub(withCeilingBenefitRub)} ₽)
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <LightKitCtaButton
                      title={kit.title}
                      items={kit.items}
                      source="track-sale-ready-kits"
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500">
                    Точечные светильники и дополнительные позиции можно выбрать ниже в каталоге.
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
