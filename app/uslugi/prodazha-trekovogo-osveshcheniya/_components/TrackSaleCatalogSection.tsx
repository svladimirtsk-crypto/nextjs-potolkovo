"use client";

import { useMemo, useState } from "react";

import { catalog } from "@/content/eksmarket-assortment";
import type { ServiceCalculatorPreset } from "@/content/services";
import { formatPrice, calcDiscountedPrice } from "@/lib/price-utils";
import { PriceCalculatorClient } from "@/components/home/price-calculator-client";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Heading } from "@/components/ui/heading";
import { Section } from "@/components/ui/section";
import {
  useTrackSaleIntent,
  type SelectedProduct,
} from "./TrackSaleIntentContext";

type TrackSaleCatalogSectionProps = {
  preset: ServiceCalculatorPreset;
  sectionTitle: string;
  sectionIntro: string;
};

export function TrackSaleCatalogSection({
  preset,
  sectionTitle,
  sectionIntro,
}: TrackSaleCatalogSectionProps) {
  const { mode, selectedProducts, toggleProduct, clearSelection, isSelected, count } =
    useTrackSaleIntent();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [calculatorExpanded, setCalculatorExpanded] = useState(false);

  const filteredProducts = useMemo(() => {
    return catalog.products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.categoryId === activeCategory;
      const matchesSearch =
        searchQuery === "" ||
        product.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const handleToggle = (product: (typeof catalog.products)[number]) => {
    const selected: SelectedProduct = {
      sku: product.id,
      title: product.title,
      providerUrl: product.url,
