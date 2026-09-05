"use client";

import type { LampSocket } from "@/lib/catalog-ui-config";

/**
 * N-051 · Предупреждения о неукомплектованной корзине каталога.
 *
 * Три независимых правила совместимости, каждое со своим действием-исправлением:
 * блок питания для CLARUS (без него система не запустится), закладные под
 * светильники 1:1 и лампы 1:1. Раньше все три жили инлайн в разметке страницы
 * вперемешку с сеткой товаров.
 */

export type MissingMount = {
  fixtureVendorCode: string;
  mountVendorCode: string;
  mountName?: string;
  requiredQty: number;
  currentQty: number;
};

export type MissingLamp = {
  socket: LampSocket;
  requiredQty: number;
  currentQty: number;
  cheapestLampId: string | null;
};

export function CatalogWarnings({
  psuOptions,
  missingMounts,
  missingLamps,
  onAddPsu,
  onAddMount,
  onAddLamp,
}: {
  /** Пусто, когда блок питания уже в корзине или система не CLARUS. */
  psuOptions: Array<{ vendorCode: string; productId: string; name: string }>;
  missingMounts: readonly MissingMount[];
  missingLamps: readonly MissingLamp[];
  onAddPsu: (productId: string) => void;
  onAddMount: (fixtureVendorCode: string) => void;
  onAddLamp: (socket: LampSocket, cheapestLampId: string) => void;
}) {
  return (
    <div className="mt-6 space-y-3">
      {psuOptions.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
          <p className="font-semibold">Для системы CLARUS обязателен минимум 1 блок питания.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {psuOptions.map((option) => (
              <button
                key={option.vendorCode}
                type="button"
                onClick={() => onAddPsu(option.productId)}
                className="rounded-xl bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Добавить: {option.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {missingMounts.map((m) => (
        <div
          key={`${m.fixtureVendorCode}-${m.mountVendorCode}`}
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p className="font-semibold">Не хватает закладных 1:1</p>
          <p className="mt-2">
            Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
            <span className="font-semibold">{m.currentQty}</span> шт.
            {m.mountName ? ` · Закладная: ${m.mountName}` : ""}
          </p>

          <button
            type="button"
            onClick={() => onAddMount(m.fixtureVendorCode)}
            className="mt-3 rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Добавить 1:1
          </button>
        </div>
      ))}

      {missingLamps.map((m) => (
        <div key={m.socket} className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p className="font-semibold">Не хватает ламп {m.socket} (1:1)</p>
          <p className="mt-2">
            Нужно: <span className="font-semibold">{m.requiredQty}</span> шт., в корзине:{" "}
            <span className="font-semibold">{m.currentQty}</span> шт.
          </p>

          <button
            type="button"
            disabled={!m.cheapestLampId}
            onClick={() => {
              if (!m.cheapestLampId) return;
              onAddLamp(m.socket, m.cheapestLampId);
            }}
            className="mt-3 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            Добавить 1:1 (самые доступные)
          </button>
        </div>
      ))}
    </div>
  );
}
