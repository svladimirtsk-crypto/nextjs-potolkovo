"use client";

/**
 * PT-018 (B-F104, T-324) · экраны подбора Шага 1 «Свет»: товары и комплекты.
 *
 * Вкладка «Подбор» показывает не один список, а восемь экранов, и для каждого
 * нужен свой набор товаров плюс «что доложить, чтобы свет заработал»:
 * автосборка профиля (T-032), дособирание комплекта (T-042), блокировка
 * «К итогу» без блока питания CLARUS, ориентир по светильникам, сетка точек
 * (N-021) и прогресс по цоколям. Всё это считалось в оркестраторе Шага 1 между
 * разметкой и футером.
 *
 * Хук собирает экраны из уже вынесенных чистых функций: правила выдачи —
 * `step1-selectors`, правила корзины — `step1-cart-rules`, комплектность —
 * `kit-rules`. Состояние здесь только одно и оно про интерфейс: какой тип точек
 * выбран и открыт ли ручной выбор по цоколю (N-021).
 */
import { useCallback, useMemo, useState } from "react";

import { pricing } from "@/content/pricing";
import type { PointSubtypeId, TrackSystemId } from "@/lib/catalog-ui-config";
import type { FeedCatalogProduct } from "@/lib/eks-feed2-catalog";
import { detectSocket } from "@/lib/feed2-products";
// ВНИМАНИЕ: `WizardStep` в `calculator-modal-types` — это номер шага модалки
// (0 | 1 | 2), а в `resolve-initial-step` — экран мастера света. Имена
// совпадают случайно; здесь нужен первый.
import type { WizardStep as ModalStep } from "@/lib/calculator-modal-types";
import type { CartEntry } from "@/lib/lighting/cart-derived";
import {
  autoAssembleProfiles,
  completeKit,
  fixturesHintForMeters,
  isTrackSystemId,
  type AutoProfilePlan,
  type Cart,
  type CompleteKitResult,
} from "@/lib/lighting/kit-rules";
import { isPanelProduct } from "@/lib/lighting/product-predicates";
import { pointProgressBySocket, type PointKindId, type SocketProgress } from "@/lib/lighting/popular-points";
import {
  applyKitSuggestions,
  applyProfilePlan,
} from "@/lib/lighting/step1-cart-rules";
import {
  selectChandeliers,
  selectCorniceLighting,
  selectPointProducts,
} from "@/lib/lighting/step1-selectors";

export type UseStep1ScreensInput = {
  products: FeedCatalogProduct[];
  cartItems: Cart;
  updateCart: (updater: Cart | ((prev: Cart) => Cart)) => void;
  resolveProduct: (productId: string) => FeedCatalogProduct | undefined;
  cartEntries: CartEntry[];

  /** Данные Шага 0. */
  requiredTrackMeters: number;
  requiredPointQty: number;
  selectedTrackMeters: number;

  /** Профили выбранной системы — из них собирается план T-032. */
  trackProfiles: FeedCatalogProduct[];

  /** Профиль выбирает систему (T-010). */
  setWSystem: (system: TrackSystemId | null) => void;
  /** «К итогу» ведёт на Шаг 2. */
  goToStep: (step: ModalStep) => void;
};

export type Step1ScreensApi = {
  /* N-021: тип точек и ручной выбор по цоколю */
  pointKind: PointKindId;
  choosePointKind: (kind: PointKindId) => void;
  manualPointsOpen: boolean;
  openManualPoints: () => void;
  pointTab: PointSubtypeId;
  setPointTab: (tab: PointSubtypeId) => void;
  pointProducts: FeedCatalogProduct[];
  pointProgressBySubtype: SocketProgress;

  /* T-032: автосборка профиля */
  autoProfilePlan: AutoProfilePlan | null;
  applyAutoProfilePlan: () => void;
  fixturesHint: ReturnType<typeof fixturesHintForMeters>;

  /* T-042: дособирание комплекта */
  kitCompletion: CompleteKitResult;
  applyKitCompletion: (
    suggestions: readonly { product: FeedCatalogProduct; qty: number }[]
  ) => void;
  psuAcknowledged: boolean;
  setPsuAcknowledged: (value: boolean) => void;
  psuBlocks: boolean;
  finishAction: () => { label: string; disabled?: boolean; onClick: () => void };

  /* T-043: люстры и подсветка карниза */
  chandeliers: FeedCatalogProduct[];
  corniceLighting: FeedCatalogProduct[];
};

export function useStep1Screens(input: UseStep1ScreensInput): Step1ScreensApi {
  const {
    products,
    cartItems,
    updateCart,
    resolveProduct,
    cartEntries,
    requiredTrackMeters,
    requiredPointQty,
    selectedTrackMeters,
    trackProfiles,
    setWSystem,
    goToStep,
  } = input;

  /* ─── N-021: сначала вид светильника, цоколь — только по явному запросу ─── */

  const [pointTab, setPointTab] = useState<PointSubtypeId>("GX53");
  const [pointKind, setPointKind] = useState<PointKindId>("recessed");
  const [manualPointsOpen, setManualPointsOpen] = useState(false);

  /** Смена типа закрывает ручной выбор: тип и цоколь не должны противоречить. */
  const choosePointKind = useCallback((kind: PointKindId) => {
    setPointKind(kind);
    setManualPointsOpen(false);
  }, []);

  const openManualPoints = useCallback(() => setManualPointsOpen(true), []);

  const pointProducts = useMemo(
    () =>
      selectPointProducts({
        products,
        manualOpen: manualPointsOpen,
        socketTab: pointTab,
        pointKind,
      }),
    [manualPointsOpen, pointKind, pointTab, products]
  );

  const pointProgressBySubtype = useMemo(
    () => pointProgressBySocket(cartEntries, requiredPointQty, isPanelProduct, detectSocket),
    [cartEntries, requiredPointQty]
  );

  /* ─── T-032: автосборка профиля и ориентир по светильникам ─── */

  const autoProfilePlan = useMemo(
    () => autoAssembleProfiles(requiredTrackMeters, trackProfiles),
    [requiredTrackMeters, trackProfiles]
  );

  /** Одним тапом кладём подобранные куски в корзину. */
  const applyAutoProfilePlan = useCallback(() => {
    if (!autoProfilePlan) return;

    const system = autoProfilePlan.pieces[0]?.product.system;
    if (system && isTrackSystemId(system)) setWSystem(system);

    updateCart((prev) => applyProfilePlan(prev, autoProfilePlan.pieces));
  }, [autoProfilePlan, setWSystem, updateCart]);

  /** «Ориентир для 10 м: 8–12 светильников» — вилка ±20 %. */
  const fixturesHint = useMemo(
    () =>
      fixturesHintForMeters(selectedTrackMeters || requiredTrackMeters, pricing.trackSpotsPerMeter),
    [requiredTrackMeters, selectedTrackMeters]
  );

  /* ─── T-042: дособирание комплекта (питание, стыки, БП, лампы) ─── */

  /** Чего не хватает выбранному свету, чтобы он заработал. */
  const kitCompletion = useMemo(
    () => completeKit(cartItems, resolveProduct, products),
    [cartItems, products, resolveProduct]
  );

  /** «Добавить всё» — кладём обязательные позиции одним действием. */
  const applyKitCompletion = useCallback(
    (suggestions: readonly { product: FeedCatalogProduct; qty: number }[]) => {
      if (suggestions.length === 0) return;
      updateCart((prev) => applyKitSuggestions(prev, suggestions));
    },
    [updateCart]
  );

  /**
   * T-042: CLARUS без блока питания не запустится. Не прячем кнопку совсем —
   * даём явно согласиться на «подберём при звонке», иначе счёт уедет неполным.
   */
  const [psuAcknowledged, setPsuAcknowledged] = useState(false);
  const psuBlocks = kitCompletion.psuMissing && !psuAcknowledged;

  /** Кнопка «К итогу» с учётом блокировки по БП. */
  const finishAction = useCallback(
    (): { label: string; disabled?: boolean; onClick: () => void } =>
      psuBlocks
        ? { label: "Нужен блок питания", disabled: true, onClick: () => undefined }
        : { label: "К итогу →", onClick: () => goToStep(2) },
    [goToStep, psuBlocks]
  );

  /* ─── T-043: люстры и подсветка карниза ─── */

  const chandeliers = useMemo(() => selectChandeliers(products), [products]);
  const corniceLighting = useMemo(() => selectCorniceLighting(products), [products]);

  return {
    pointKind,
    choosePointKind,
    manualPointsOpen,
    openManualPoints,
    pointTab,
    setPointTab,
    pointProducts,
    pointProgressBySubtype,
    autoProfilePlan,
    applyAutoProfilePlan,
    fixturesHint,
    kitCompletion,
    applyKitCompletion,
    psuAcknowledged,
    setPsuAcknowledged,
    psuBlocks,
    finishAction,
    chandeliers,
    corniceLighting,
  };
}
