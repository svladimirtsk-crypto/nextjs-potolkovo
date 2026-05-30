import snapshotData from "@/data/eks-feed2-snapshot.json";
import type { LightingItem } from "@/lib/calculator-modal-types";
import { applyLightingDiscount } from "@/lib/lighting-formulas";
import { detectSocket } from "@/lib/feed2-products";
import { LightKitCtaButton } from "./LightKitCtaButton";

type SnapshotParam = {
  label?: unknown;
  value?: unknown;
};

type SnapshotProduct = {
  productId?: unknown;
  vendorCode?: unknown;
  name?: unknown;
  coverImage?: unknown;
  images?: unknown;
  priceRub?: unknown;
  available?: unknown;
  kind?: unknown;
  system?: unknown;
  params?: unknown;
  keyAttributes?: unknown;
};

type KitCard = {
  title: string;
  subtitle: string;
  imageUrl: string;
  items: LightingItem[];
};

const REMOVED_VENDOR_CODES = new Set(["0У-00002967", "0У-00001345"]);

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeProducts(): SnapshotProduct[] {
  const raw = (snapshotData as { products?: unknown[] })?.products ?? [];
  return raw
    .map((item) => item as SnapshotProduct)
    .filter((item) => !REMOVED_VENDOR_CODES.has(toText(item.vendorCode)));
}

function getProductImage(product: SnapshotProduct | null): string {
  if (!product) return "";
  const cover = toText(product.coverImage);
  if (cover) return cover;

  if (Array.isArray(product.images)) {
    const first = product.images.map((img) => toText(img)).find(Boolean);
    return String(first ?? "");
  }

  return "";
}

function findByVendor(products: SnapshotProduct[], vendorCode: string): SnapshotProduct | null {
  const safeVendorCode = toText(vendorCode);
  return (
    products.find((product) => toText(product.vendorCode) === safeVendorCode) ?? null
  );
}

function findColibriProfileByLength(products: SnapshotProduct[], targetMm: 1000 | 2000): SnapshotProduct | null {
  const candidates = products.filter((product) => {
    if (toText(product.system) !== "COLIBRI_220") return false;
    if (toText(product.kind) !== "TRACK_PROFILE") return false;
    const vendorCode = toText(product.vendorCode);
    if (REMOVED_VENDOR_CODES.has(vendorCode)) return false;
    return true;
  });

  const scored = candidates.map((product) => {
    const name = toText(product.name).toLowerCase();

    const fromMm = name.match(/(\d{3,4})\s*мм/i);
    const mmValue = fromMm ? Number(fromMm[1]) : NaN;

    const fromMeters = name.match(/(\d(?:[.,]\d)?)\s*м(?!м)/i);
    const metersValue = fromMeters ? Number(String(fromMeters[1]).replace(",", ".")) * 1000 : NaN;

    const inferred = Number.isFinite(mmValue)
      ? mmValue
      : Number.isFinite(metersValue)
      ? metersValue
      : 0;

    const diff = Math.abs(inferred - targetMm);
    return { product, diff, inferred };
  });

  scored.sort((a, b) => a.diff - b.diff);

  const best = scored[0];
  return best ? best.product : null;
}

function isMR16Lamp(product: SnapshotProduct): boolean {
  if (toText(product.kind) !== "LAMP") return false;
  if (toNumber(product.priceRub) <= 0) return false;
  if (product.available === false) return false;

  const mapped = {
    productId: toText(product.productId),
    vendorCode: toText(product.vendorCode),
    name: toText(product.name),
    url: "",
    categoryId: "",
    categoryPath: "",
    images: [],
    coverImage: toText(product.coverImage),
    priceRub: toNumber(product.priceRub),
    available: true,
    params: (Array.isArray(product.params) ? product.params : []) as SnapshotParam[],
    keyAttributes: (Array.isArray(product.keyAttributes) ? product.keyAttributes : []) as SnapshotParam[],
    system: "UNKNOWN",
    kind: "LAMP",
    unit: "pcs",
    lengthMeters: null,
    pieceLengthMeters: null,
  };

  return detectSocket(mapped) === "MR16";
}

function toLightingItem(product: SnapshotProduct | null, qty: number, fallbackVendor: string): LightingItem {
  if (!product) {
    return {
      sku: String(fallbackVendor ?? ""),
      name: `Позиция ${String(fallbackVendor ?? "")}`,
      qty,
      priceRub: 0,
    };
  }

  return {
    sku: toText(product.productId) || toText(product.vendorCode) || toText(fallbackVendor),
    name: toText(product.name) || `Позиция ${String(fallbackVendor ?? "")}`,
    qty,
    priceRub: toNumber(product.priceRub),
  };
}

function buildKits(products: SnapshotProduct[]): KitCard[] {
  const colibri2000 = findColibriProfileByLength(products, 2000);
  const colibri1000 = findColibriProfileByLength(products, 1000);

  const kitchenItems: LightingItem[] = [
    toLightingItem(colibri2000, 1, "COLIBRI_PROFILE_2000"),
    toLightingItem(colibri1000, 1, "COLIBRI_PROFILE_1000"),
    toLightingItem(findByVendor(products, "0У-00001335"), 2, "0У-00001335"),
    toLightingItem(findByVendor(products, "0У-00001338"), 3, "0У-00001338"),
    toLightingItem(findByVendor(products, "0У-00006095"), 1, "0У-00006095"),
    toLightingItem(findByVendor(products, "0У-00001342"), 1, "0У-00001342"),
  ];

  const livingItems: LightingItem[] = [
    toLightingItem(colibri2000, 4, "COLIBRI_PROFILE_2000"),
    toLightingItem(colibri1000, 2, "COLIBRI_PROFILE_1000"),
    toLightingItem(findByVendor(products, "0У-00001335"), 2, "0У-00001335"),
    toLightingItem(findByVendor(products, "0У-00001339"), 4, "0У-00001339"),
    toLightingItem(findByVendor(products, "0У-00001336"), 2, "0У-00001336"),
    toLightingItem(findByVendor(products, "0У-00006095"), 4, "0У-00006095"),
    toLightingItem(findByVendor(products, "0У-00001342"), 4, "0У-00001342"),
  ];

  const bestMr16Lamp =
    products.find((product) => isMR16Lamp(product)) ?? null;

  const hallwayItems: LightingItem[] = [
    toLightingItem(findByVendor(products, "0У-00001355"), 1, "0У-00001355"),
    toLightingItem(findByVendor(products, "0У-00006327"), 4, "0У-00006327"),
    toLightingItem(bestMr16Lamp, 4, "MR16_LAMP"),
  ];

  return [
    {
      title: "Готовый комплект для кухни",
      subtitle: "Лаконичный трековый свет для рабочей зоны и обеденного стола.",
      imageUrl:
        getProductImage(findByVendor(products, "0У-00001338")) ||
        getProductImage(colibri2000),
      items: kitchenItems,
    },
    {
      title: "Готовый комплект для гостиной",
      subtitle: "Сценарное освещение для мягкой зоны и центральной части комнаты.",
      imageUrl:
        getProductImage(findByVendor(products, "0У-00001339")) ||
        getProductImage(colibri2000),
      items: livingItems,
    },
    {
      title: "Готовый комплект для прихожей",
      subtitle: "Компактное ART-решение с направленным светом и лампами 1:1.",
      imageUrl:
        getProductImage(findByVendor(products, "0У-00006327")) ||
        getProductImage(findByVendor(products, "0У-00001355")),
      items: hallwayItems,
    },
  ];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

export function LightKitShowcase() {
  const products = normalizeProducts();
  const kits = buildKits(products);

  return (
    <section className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">
          Готовые решения
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Выберите готовый комплект и откройте его в калькуляторе за 1 клик
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Все наборы уже собраны с учетом совместимых компонентов. Вы сможете сразу
          отредактировать количество и увидеть итоговую стоимость.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => {
          const totalRub = kit.items.reduce((sum, item) => sum + item.qty * item.priceRub, 0);
          const discounted = applyLightingDiscount(totalRub);

          return (
            <article
              key={kit.title}
              className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-slate-100">
                {kit.imageUrl ? (
                  <img
                    src={String(kit.imageUrl ?? "")}
                    alt={kit.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
                    Фото комплекта
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-4 flex-grow">
                  <h3 className="mb-1 text-lg font-semibold text-slate-950">{kit.title}</h3>
                  <p className="mb-3 text-sm text-slate-600">{kit.subtitle}</p>
                  <ul className="space-y-1.5">
                    {kit.items.map((item) => (
                      <li key={`${kit.title}-${item.sku}`} className="flex justify-between gap-2 text-sm text-slate-700">
                        <span className="line-clamp-2">{item.name}</span>
                        <span className="shrink-0 text-slate-500">x {item.qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-sm text-slate-400 line-through">{fmt(totalRub)} ₽</p>
                  <p className="text-2xl font-bold text-emerald-600">{fmt(discounted)} ₽</p>
                  <p className="mt-0.5 text-xs font-medium text-emerald-700">-15% при заказе потолка</p>

                  <div className="mt-4">
                    <LightKitCtaButton
                      title={kit.title}
                      items={kit.items}
                      source="track-sale-ready-kit"
                    />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
