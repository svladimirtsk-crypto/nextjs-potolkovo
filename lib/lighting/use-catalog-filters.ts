"use client";

/**
 * N-051 · Состояние фильтров каталога — одно на модалку и страницу.
 *
 * Шесть `useState` (раздел, система трека, группа, подтип точечных, цоколь,
 * поисковый запрос) были продублированы дословно в `wizard-step1-lighting.tsx`
 * и `CatalogSectionClient.tsx`. Дубли успели разойтись в поведении: на
 * странице смена раздела сбрасывала счётчик показанных карточек, а в модалке
 * такого счётчика не было вовсе; клик по чипу сбрасывал запрос в четырёх
 * местах из четырёх на странице и в трёх из четырёх в модалке.
 *
 * Хук держит правила переходов в одном месте:
 *   — смена раздела сохраняет запрос (T-065): человек ищет то же самое,
 *     просто в другом месте, и терять набранное обидно;
 *   — смена фильтра внутри раздела запрос сбрасывает: он сужает выдачу, и
 *     старый запрос почти всегда даёт пусто.
 */
import { useCallback, useMemo, useState } from "react";

import type {
  CatalogSectionId,
  LampSocket,
  PointSubtypeId,
  TrackGroupId,
  TrackSystemId,
} from "@/lib/catalog-ui-config";

export type CatalogFiltersState = {
  section: CatalogSectionId;
  trackSystem: TrackSystemId;
  trackGroup: TrackGroupId;
  pointSubtype: PointSubtypeId;
  lampSocket: LampSocket;
  query: string;
};

export type CatalogFilters = CatalogFiltersState & {
  /** Смена раздела: запрос сохраняется, пагинация начинается заново. */
  selectSection: (id: CatalogSectionId) => void;
  /** Фильтры внутри раздела — каждый сбрасывает запрос. */
  selectTrackSystem: (id: TrackSystemId) => void;
  selectTrackGroup: (id: TrackGroupId) => void;
  selectPointSubtype: (id: PointSubtypeId) => void;
  selectLampSocket: (socket: LampSocket) => void;
  setQuery: (value: string) => void;
  resetQuery: () => void;
};

/** Что именно изменилось — по этому решается судьба запроса и пагинации. */
export type CatalogFilterChange =
  | { type: "section"; value: CatalogSectionId }
  | { type: "trackSystem"; value: TrackSystemId }
  | { type: "trackGroup"; value: TrackGroupId }
  | { type: "pointSubtype"; value: PointSubtypeId }
  | { type: "lampSocket"; value: LampSocket }
  | { type: "query"; value: string }
  | { type: "resetQuery" };

/**
 * Чистый переход состояния фильтров.
 *
 * Вынесен из хука, чтобы правила проверялись тестом напрямую, без рендера
 * компонента: именно они разъехались между модалкой и страницей.
 */
export function applyCatalogFilterChange(
  state: CatalogFiltersState,
  change: CatalogFilterChange
): CatalogFiltersState {
  switch (change.type) {
    case "section":
      // T-065: запрос переживает смену раздела.
      return { ...state, section: change.value };
    case "trackSystem":
      return { ...state, trackSystem: change.value, query: "" };
    case "trackGroup":
      return { ...state, trackGroup: change.value, query: "" };
    case "pointSubtype":
      return { ...state, pointSubtype: change.value, query: "" };
    case "lampSocket":
      return { ...state, lampSocket: change.value, query: "" };
    case "query":
      return { ...state, query: change.value };
    case "resetQuery":
      return { ...state, query: "" };
  }
}

/** Меняет ли переход состав выдачи — и значит, сбрасывает ли пагинацию. */
export function changeResetsResults(change: CatalogFilterChange): boolean {
  // Ввод текста фильтрует по мере набора; сбрасывать счётчик на каждой букве
  // значит дёргать список под рукой у человека.
  return change.type !== "query" && change.type !== "resetQuery";
}

export type CatalogFiltersOptions = {
  initialSection?: CatalogSectionId;
  /**
   * Вызывается, когда выдача заведомо меняется целиком: страница каталога
   * сбрасывает этим счётчик «Показать ещё». Модалке передавать нечего.
   */
  onResultsReset?: () => void;
};

export function useCatalogFilters(options: CatalogFiltersOptions = {}): CatalogFilters {
  const { initialSection = "track-systems", onResultsReset } = options;

  const [state, setState] = useState<CatalogFiltersState>(() => ({
    section: initialSection,
    trackSystem: "COLIBRI_220",
    trackGroup: "TRACK_FIXTURE",
    pointSubtype: "GX53",
    lampSocket: "GX53",
    query: "",
  }));

  const apply = useCallback(
    (change: CatalogFilterChange) => {
      setState((prev) => applyCatalogFilterChange(prev, change));
      if (changeResetsResults(change)) onResultsReset?.();
    },
    [onResultsReset]
  );

  return useMemo(
    () => ({
      ...state,
      selectSection: (value: CatalogSectionId) => apply({ type: "section", value }),
      selectTrackSystem: (value: TrackSystemId) => apply({ type: "trackSystem", value }),
      selectTrackGroup: (value: TrackGroupId) => apply({ type: "trackGroup", value }),
      selectPointSubtype: (value: PointSubtypeId) => apply({ type: "pointSubtype", value }),
      selectLampSocket: (value: LampSocket) => apply({ type: "lampSocket", value }),
      setQuery: (value: string) => apply({ type: "query", value }),
      resetQuery: () => apply({ type: "resetQuery" }),
    }),
    [state, apply]
  );
}
