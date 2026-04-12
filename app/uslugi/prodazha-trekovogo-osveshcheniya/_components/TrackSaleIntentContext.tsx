"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type IntentMode = "install" | "buy";

export type SelectedProduct = {
  sku: string;
  title: string;
  providerUrl?: string;
  priceRetail?: number | null;
  priceWithCeiling?: number | null;
  imageUrl?: string;
};

type TrackSaleIntentContextValue = {
  mode: IntentMode;
  setMode: (mode: IntentMode) => void;
  selectedProducts: SelectedProduct[];
  toggleProduct: (product: SelectedProduct) => void;
  clearSelection: () => void;
  isSelected: (sku: string) => boolean;
  count: number;
};

const defaultContext: TrackSaleIntentContextValue = {
  mode: "install",
  setMode: () => {},
  selectedProducts: [],
  toggleProduct: () => {},
  clearSelection: () => {},
  isSelected: () => false,
  count: 0,
};

const TrackSaleIntentContext =
  createContext<TrackSaleIntentContextValue>(defaultContext);

type TrackSaleIntentProviderProps = {
  children: ReactNode;
  initialMode?: IntentMode;
};

export function TrackSaleIntentProvider({
  children,
  initialMode = "install",
}: TrackSaleIntentProviderProps) {
  const [mode, setMode] = useState<IntentMode>(initialMode);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    []
  );

  const toggleProduct = useCallback((product: SelectedProduct) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.sku === product.sku);
      if (exists) return prev.filter((p) => p.sku !== product.sku);
      return [...prev, product];
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  const isSelected = useCallback(
    (sku: string) => selectedProducts.some((p) => p.sku === sku),
    [selectedProducts]
  );

  const value = useMemo<TrackSaleIntentContextValue>(
    () => ({
      mode,
      setMode,
      selectedProducts,
      toggleProduct,
      clearSelection,
      isSelected,
      count: selectedProducts.length,
    }),
    [mode, selectedProducts, toggleProduct, clearSelection, isSelected]
  );

  return (
    <TrackSaleIntentContext.Provider value={value}>
      {children}
    </TrackSaleIntentContext.Provider>
  );
}

/**
 * Safe hook: returns default values on pages without TrackSaleIntentProvider.
 * No throw — so ActionForm on other service pages keeps working.
 */
export function useTrackSaleIntent() {
  return useContext(TrackSaleIntentContext);
}
