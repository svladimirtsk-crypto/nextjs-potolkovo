"use client";

import { CATALOG_SECTIONS, LAMP_SOCKETS, POINT_SUBTYPES, TRACK_GROUPS, TRACK_SYSTEMS, type CatalogSectionId } from "@/lib/catalog-ui-config";
import { CatalogFilterChipGroup, CatalogFilterChipsRow } from "@/components/lighting/CatalogFilterChips";
import type { CatalogFilters } from "@/lib/lighting/use-catalog-filters";
import type { CatalogSort } from "@/lib/lighting/catalog-presentation";
import type { SearchMatch } from "@/components/lighting/CatalogGrid";
import { SMART_SECTION_NOTE } from "@/lib/lighting/alice-routes";

const icons = [
  "M3 5h18M6 5v5h4V5m4 0v5h4V5M8 13l-3 6m11-6 3 6",
  "M4 8h16l-2 5H6zM8 16l-2 4m6-4v5m4-5 2 4",
  "M12 3v5M4 8h16M7 8v5l-3 5h6l-3-5m10-5v5l-3 5h6l-3-5",
  "M3 6h18v4H3zM5 15h2m3 0h2m3 0h2m3 0h1M5 19h14",
  "M6 8h12v8H6zM4 4h16M4 20h16M12 8v8",
  "M4 6h16v12H4zM8 6v12m4-12v12m4-12v12",
  "M8 16v-2a6 6 0 1 1 8 0v2zM9 19h6m-5 3h4",
];

export function CatalogNavigation({ filters, smartOnly, onSmartChange }: {
  filters: CatalogFilters; smartOnly: boolean; onSmartChange: () => void;
}) {
  return <aside className="pk-catalog-nav">
    <p className="pk-catalog-label">Оборудование</p>
    <div role="tablist" aria-label="Разделы каталога" className="pk-catalog-tabs">
      {CATALOG_SECTIONS.map((item, index) => <button
        key={item.id} type="button" role="tab" id={`catalog-tab-${item.id}`}
        aria-selected={filters.section === item.id} aria-controls="catalog-panel"
        tabIndex={filters.section === item.id ? 0 : -1}
        onClick={() => filters.selectSection(item.id)}
        onKeyDown={(event) => {
          let next = index;
          if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % CATALOG_SECTIONS.length;
          else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index + CATALOG_SECTIONS.length - 1) % CATALOG_SECTIONS.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = CATALOG_SECTIONS.length - 1;
          else return;
          event.preventDefault();
          const id = CATALOG_SECTIONS[next].id;
          filters.selectSection(id);
          document.getElementById(`catalog-tab-${id}`)?.focus();
        }}
      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true"><path d={icons[index]} /></svg><span>{item.label}</span></button>)}
    </div>
    <div className="pk-smart-note">
      <p className="pk-catalog-label">Умный свет</p>
      <h3>Свет под ваши сценарии</h3>
      <p>{SMART_SECTION_NOTE}</p>
      <button type="button" aria-pressed={smartOnly} onClick={onSmartChange}>SMART <span aria-hidden="true">{smartOnly ? "✓" : "+"}</span></button>
    </div>
  </aside>;
}

export function CatalogToolbar({ filters, smartOnly, sort, onSort, onReset, matches, count, visibleCount }: {
  filters: CatalogFilters; smartOnly: boolean; sort: CatalogSort; onSort: (sort: CatalogSort) => void;
  onReset: () => void; matches: SearchMatch[]; count: number; visibleCount: number;
}) {
  const { section, query } = filters;
  return <div className="pk-catalog-toolbar">
    <label className="pk-search">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
      <input type="search" aria-label="Поиск по каталогу" placeholder="Название или артикул" value={query} onChange={(e) => filters.setQuery(e.target.value)} />
    </label>
    {query ? <div className="pk-search-context"><span>Поиск по всему разделу — без ограничения по системе, типу и цоколю.</span><button type="button" onClick={filters.resetQuery}>Очистить поиск</button></div> : <>
      {section === "track-systems" && <>
        <CatalogFilterChipsRow ariaLabel="Система трека"><CatalogFilterChipGroup options={TRACK_SYSTEMS} active={filters.trackSystem} onSelect={filters.selectTrackSystem} /></CatalogFilterChipsRow>
        <CatalogFilterChipsRow ariaLabel="Группа трека"><CatalogFilterChipGroup options={TRACK_GROUPS} active={filters.trackGroup} onSelect={filters.selectTrackGroup} /></CatalogFilterChipsRow>
      </>}
      {section === "point-fixtures" && <CatalogFilterChipsRow ariaLabel="Тип точечного светильника"><CatalogFilterChipGroup options={POINT_SUBTYPES} active={filters.pointSubtype} onSelect={filters.selectPointSubtype} /></CatalogFilterChipsRow>}
      {section === "lamps" && <CatalogFilterChipsRow ariaLabel="Цоколь лампы"><CatalogFilterChipGroup options={LAMP_SOCKETS.map(id => ({ id, label: id }))} active={filters.lampSocket} onSelect={filters.selectLampSocket} /></CatalogFilterChipsRow>}
    </>}
    {matches.length > 0 && <div className="pk-search-matches" aria-live="polite"><span>Найдено ещё:</span>{matches.map(match => <button key={match.id} type="button" onClick={() => filters.selectSection(match.id as CatalogSectionId)}>«{match.label}»: {match.count}</button>)}</div>}
    {smartOnly && <p className="pk-smart-active">SMART-фильтр включён. Наличие маркировки не подтверждает совместимость.</p>}
    <div className="pk-catalog-results">
      <p role="status" aria-live="polite">Найдено <strong>{count}</strong><span> · показано {Math.min(visibleCount, count)}</span></p>
      <label>Порядок<select aria-label="Сортировка каталога" value={sort} onChange={(e) => onSort(e.target.value as CatalogSort)}>
        <option value="photo">Сначала с фото</option><option value="price-asc">Цена: ниже</option><option value="price-desc">Цена: выше</option><option value="name">По названию</option>
      </select></label>
      <button type="button" className="pk-reset-filters" onClick={onReset}>Сбросить фильтры</button>
    </div>
  </div>;
}
