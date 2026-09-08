"use client";

/**
 * N-051 · Экран «Профиль трека».
 *
 * Самый крупный из инлайн-блоков мастера: 80 строк JSX, четыре карточки-помощника
 * и сетка товаров в одном условии `shownWStep === "trackProfile"`. Разметка
 * зависит только от переданных данных, поэтому живёт отдельно от оркестратора.
 *
 * Собственных карточек экран не рисует — переиспользует `AutoProfilePlanCard`,
 * `KitCompletionCard` и `RecommendedKitCard` из `Step1Screens.tsx`.
 */
import {
  AutoProfilePlanCard,
  KitCompletionCard,
  RecommendedKitCard,
} from "@/components/lighting/Step1Screens";
import { ProductCard } from "@/components/lighting/CatalogPieces";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import type { AutoProfilePiece } from "@/lib/lighting/kit-rules";
import { toNumber, toText } from "@/lib/feed2-snapshot-normalize";

/** Позиция докомплектации с человеческим обоснованием. */
export type KitCompletionItem = {
  product: FeedCatalogProduct;
  qty: number;
  reason: string;
};

export type TrackProfileStepProps = {
  systemLabel: string;
  products: readonly FeedCatalogProduct[];
  cartItems: Record<string, number>;
  onQtyChange: (product: FeedCatalogProduct, qty: number) => void;
  onZoom: (image: { src: string; alt: string }) => void;
  discountPercent: number;

  /** T-032: автосборка под требуемый метраж одним нажатием. */
  autoPlan: {
    pieces: AutoProfilePiece[];
    totalRub: number;
    discountedTotalRub: number;
    totalMeters: number;
  } | null;
  requiredMeters: number;
  onApplyAutoPlan: () => void;

  /** T-042: чего не хватает комплекту. */
  mandatory: KitCompletionItem[];
  recommended: KitCompletionItem[];
  psuMissing: boolean;
  psuAcknowledged: boolean;
  onPsuAcknowledgedChange: (value: boolean) => void;
  onAddMandatory: () => void;
  onAddRecommended: () => void;

  onBack: () => void;
  onNext: () => void;
  nextDisabled: boolean;
};

/** Позиции карточек ждут плоский вид, а не товар целиком. */
function toCardItems(items: KitCompletionItem[]) {
  return items.map((item) => ({
    productId: toText(item.product.productId),
    name: toText(item.product.name),
    qty: item.qty,
    reason: item.reason,
  }));
}

export function TrackProfileStep({
  systemLabel,
  products,
  cartItems,
  onQtyChange,
  onZoom,
  discountPercent,
  autoPlan,
  requiredMeters,
  onApplyAutoPlan,
  mandatory,
  recommended,
  psuMissing,
  psuAcknowledged,
  onPsuAcknowledgedChange,
  onAddMandatory,
  onAddRecommended,
  onBack,
  onNext,
  nextDisabled,
}: TrackProfileStepProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-sm font-semibold text-emerald-950">Профиль трека: {systemLabel}</p>
        <p className="mt-1 text-xs text-emerald-800">
          Одно нажатие «+» добавляет 1 шт. Можно собрать профиль из разных длин.
        </p>
      </div>

      {autoPlan ? (
        <AutoProfilePlanCard
          pieces={autoPlan.pieces}
          totalRub={autoPlan.totalRub}
          discountedTotalRub={autoPlan.discountedTotalRub}
          totalMeters={autoPlan.totalMeters}
          requiredMeters={requiredMeters}
          onApply={onApplyAutoPlan}
        />
      ) : null}

      {mandatory.length > 0 ? (
        <KitCompletionCard
          items={toCardItems(mandatory)}
          psuMissing={psuMissing}
          psuAcknowledged={psuAcknowledged}
          onAddAll={onAddMandatory}
          onPsuAcknowledgedChange={onPsuAcknowledgedChange}
        />
      ) : null}

      {recommended.length > 0 ? (
        <RecommendedKitCard items={toCardItems(recommended)} onAddAll={onAddRecommended} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => {
          const id = toText(product.productId);
          const qty = toNumber(cartItems[id]);

          return (
            <ProductCard
              key={id}
              product={product}
              qty={qty}
              onInc={() => onQtyChange(product, qty + 1)}
              onDec={() => onQtyChange(product, qty - 1)}
              onImageClick={() =>
                onZoom({ src: toText(product.coverImage), alt: toText(product.name) })
              }
              discountPercent={discountPercent}
            />
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Система
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-950"
        >
          Подтвердить →
        </button>
      </div>
    </div>
  );
}
