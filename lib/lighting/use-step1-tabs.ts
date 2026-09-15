"use client";

/**
 * PT-018 (B-F104) · T-031: вкладка и режим каталога Шага 1 «Свет».
 *
 * У Шага 1 три режима: «Подбор», «Каталог» и «Выбранное». Базовый режим
 * выводится из того, откуда человек пришёл (`options.initialLightingTab`,
 * `initialLightingView`, `entryMode`) и не открыт ли уже каталог в контексте
 * модалки (`step1CatalogView`), а ручной выбор хранится оверрайдом и
 * сбрасывается, когда меняется сам базис — то есть при новом открытии или
 * переходе шага. Именно так T-031 убрал три эффекта с `setState`, из-за которых
 * экран «прыгал» лишним рендером.
 *
 * Правила вывода — чистые функции (их можно проверить тестом без React), хук
 * ниже только хранит оверрайд. Тот же приём, что в `use-catalog-filters`.
 */
import { useCallback, useMemo, useState } from "react";

import type { CalculatorEntryMode, CatalogViewMode } from "@/lib/calculator-modal-types";

export type Step1Tab = "recommendations" | "catalog";

/** Что известно про вход на Шаг 1: общий контекст модалки + параметры открытия. */
export type Step1TabBase = {
  /** Каталог уже открыт в контексте (например, человек пришёл со страницы света). */
  step1CatalogView: CatalogViewMode | null;
  initialLightingTab?: "recommendations" | "catalog";
  initialLightingView?: CatalogViewMode;
  entryMode?: CalculatorEntryMode;
};

/** Вкладка по умолчанию: явный каталог важнее параметров открытия. */
export function resolveBaseTab(base: Step1TabBase): Step1Tab {
  if (base.step1CatalogView) return "catalog";
  if (base.initialLightingTab === "catalog") return "catalog";
  if (base.initialLightingTab === "recommendations") return "recommendations";
  return base.entryMode === "lighting-first" ? "catalog" : "recommendations";
}

/** Режим каталога по умолчанию: «Выбранное» — только если его явно попросили. */
export function resolveBaseCatalogView(base: Step1TabBase): CatalogViewMode {
  if (base.step1CatalogView) return base.step1CatalogView;
  return base.initialLightingView === "selected" ? "selected" : "browse";
}

/** Ручной выбор пользователя. `base` — снимок базиса, в котором он сделан. */
export type Step1TabOverride = {
  base: string;
  tab: Step1Tab;
  view: CatalogViewMode;
} | null;

/** Ключ базиса: пока он не изменился, оверрайд в силе. */
export function baseKeyOf(tab: Step1Tab, view: CatalogViewMode): string {
  return `${tab}|${view}`;
}

/** Что показать: оверрайд, если базис тот же, иначе базис. */
export function shownTabState(input: {
  override: Step1TabOverride;
  baseKey: string;
  baseTab: Step1Tab;
  baseView: CatalogViewMode;
}): { tab: Step1Tab; view: CatalogViewMode } {
  const active = input.override?.base === input.baseKey ? input.override : null;
  return { tab: active?.tab ?? input.baseTab, view: active?.view ?? input.baseView };
}

/** Выбор вкладки: режим каталога сохраняется, если базис не менялся. */
export function applyTabChoice(
  prev: Step1TabOverride,
  input: { baseKey: string; tab: Step1Tab; baseView: CatalogViewMode }
): Step1TabOverride {
  return {
    base: input.baseKey,
    tab: input.tab,
    view: prev?.base === input.baseKey ? prev.view : input.baseView,
  };
}

/** Выбор режима: вкладка сохраняется, если базис не менялся. */
export function applyViewChoice(
  prev: Step1TabOverride,
  input: { baseKey: string; view: CatalogViewMode; baseTab: Step1Tab }
): Step1TabOverride {
  return {
    base: input.baseKey,
    tab: prev?.base === input.baseKey ? prev.tab : input.baseTab,
    view: input.view,
  };
}

/** Пустое «Выбранное» показывать нечем — молча показываем каталог. */
export function shownCatalogViewOf(
  view: CatalogViewMode,
  selectedCount: number
): CatalogViewMode {
  return view === "selected" && selectedCount === 0 ? "browse" : view;
}

export type UseStep1TabsInput = Step1TabBase & {
  /** Режим каталога общий с модалкой — при ручном выборе пишем и в контекст. */
  setStep1CatalogView: (view: CatalogViewMode | null) => void;
};

export type Step1TabsApi = {
  activeTab: Step1Tab;
  catalogView: CatalogViewMode;
  setActiveTab: (tab: Step1Tab) => void;
  setCatalogView: (view: CatalogViewMode) => void;
  /** То же, что `setCatalogView`, плюс запись в общий контекст модалки. */
  setCatalogViewAndSync: (view: CatalogViewMode) => void;
};

export function useStep1Tabs(input: UseStep1TabsInput): Step1TabsApi {
  const {
    step1CatalogView,
    initialLightingTab,
    initialLightingView,
    entryMode,
    setStep1CatalogView,
  } = input;

  // Базис мемоизирован: от него зависят идентичности обработчиков, а их
  // идентичность — зависимости эффектов, публикующих футер в контекст модалки.
  const baseTab = useMemo(
    () => resolveBaseTab({ step1CatalogView, initialLightingTab, entryMode }),
    [entryMode, initialLightingTab, step1CatalogView]
  );
  const baseCatalogView = useMemo(
    () => resolveBaseCatalogView({ step1CatalogView, initialLightingView }),
    [initialLightingView, step1CatalogView]
  );
  const baseKey = useMemo(
    () => baseKeyOf(baseTab, baseCatalogView),
    [baseCatalogView, baseTab]
  );

  const [tabOverride, setTabOverride] = useState<Step1TabOverride>(null);
  const { tab: activeTab, view: catalogView } = shownTabState({
    override: tabOverride,
    baseKey,
    baseTab,
    baseView: baseCatalogView,
  });

  const setActiveTab = useCallback(
    (tab: Step1Tab) =>
      setTabOverride((prev) => applyTabChoice(prev, { baseKey, tab, baseView: baseCatalogView })),
    [baseCatalogView, baseKey]
  );

  const setCatalogView = useCallback(
    (view: CatalogViewMode) =>
      setTabOverride((prev) => applyViewChoice(prev, { baseKey, view, baseTab })),
    [baseKey, baseTab]
  );

  const setCatalogViewAndSync = useCallback(
    (view: CatalogViewMode) => {
      setCatalogView(view);
      setStep1CatalogView(view);
    },
    [setCatalogView, setStep1CatalogView]
  );

  return { activeTab, catalogView, setActiveTab, setCatalogView, setCatalogViewAndSync };
}
