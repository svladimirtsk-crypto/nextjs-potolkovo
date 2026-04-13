"use client";

import { useState } from "react";

import type { LightingSnapshot } from "@/lib/calculator-modal-types";
import { useCalculatorModal } from "./calculator-modal-context";

const PRESET_KITS = [
  {
    kitId: "colibri-start-5",
    kitName: "Старт COLIBRI 220V · 5 спотов",
    items: [
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 1, priceRub: 7400 },
      { sku: "colibri-london-10w", name: "COLIBRI LONDON 10W", qty: 5, priceRub: 1540 },
    ],
    totalRub: 7400 + 5 * 1540,
  },
  {
    kitId: "clarus-start-5",
    kitName: "Старт CLARUS 48V · 5 спотов",
    items: [
      { sku: "clarus-profile-48v", name: "Профиль CLARUS 48V", qty: 1, priceRub: 8000 },
      { sku: "clarus-psu-48v", name: "Блок питания CLARUS", qty: 1, priceRub: 1530 },
      { sku: "clarus-spot-12w-4000k", name: "CLARUS SPOT 12W", qty: 5, priceRub: 3520 },
    ],
    totalRub: 8000 + 1530 + 5 * 3520,
  },
  {
    kitId: "colibri-rio-8",
    kitName: "Комфорт COLIBRI RIO · 8 спотов",
    items: [
      { sku: "colibri-profile-220v", name: "Профиль COLIBRI 220V", qty: 2, priceRub: 7400 },
      { sku: "colibri-rio-12w", name: "COLIBRI RIO 12W", qty: 8, priceRub: 3080 },
    ],
    totalRub: 2 * 7400 + 8 * 3080,
  },
] as const;

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type LightingMode = "kit" | "custom" | "none";

export function WizardStep1Lighting() {
  const { lightingDraft, setLightingDraft } = useCalculatorModal();

  const [mode, setMode] = useState<LightingMode>(
    lightingDraft?.mode ?? "none"
  );
  const [selectedKitId, setSelectedKitId] = useState<string | null>(
    lightingDraft?.mode === "kit" ? lightingDraft.kitId ?? null : null
  );
  const [customNote, setCustomNote] = useState<string>(
    lightingDraft?.mode === "custom" ? lightingDraft.customNote ?? "" : ""
  );

  const handleModeChange = (newMode: LightingMode) => {
    setMode(newMode);

    if (newMode === "none") {
      setLightingDraft({ mode: "none" });
      setSelectedKitId(null);
    } else if (newMode === "custom") {
      setSelectedKitId(null);
      setLightingDraft({ mode: "custom", customNote });
    } else {
      setCustomNote("");
      setLightingDraft({ mode: "kit" });
    }
  };

  const handleKitSelect = (kit: (typeof PRESET_KITS)[number]) => {
    setSelectedKitId(kit.kitId);
    const snapshot: LightingSnapshot = {
      mode: "kit",
      kitId: kit.kitId,
      kitName: kit.kitName,
      items: kit.items.map((i) => ({ ...i })),
      totalRub: kit.totalRub,
    };
    setLightingDraft(snapshot);
  };

  const handleCustomNoteChange = (value: string) => {
    const trimmed = value.slice(0, 300);
    setCustomNote(trimmed);
    setLightingDraft({ mode: "custom", customNote: trimmed });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Добавить освещение к расчёту?
      </p>

      <div className="grid grid-cols-1 gap-3">
        <ModeCard
          active={mode === "kit"}
          title="Готовый комплект"
          description="Подобранные наборы трекового освещения"
          onClick={() => handleModeChange("kit")}
        />
        <ModeCard
          active={mode === "custom"}
          title="Свои пожелания"
          description="Опишите, что нужно — подберём под проект"
          onClick={() => handleModeChange("custom")}
        />
        <ModeCard
          active={mode === "none"}
          title="Без освещения"
          description="Только потолок без треков и спотов"
          onClick={() => handleModeChange("none")}
        />
      </div>

      {mode === "kit" ? (
        <div className="space-y-3 pt-2">
          <p className="text-sm font-medium text-slate-900">
            Выберите комплект:
          </p>
          {PRESET_KITS.map((kit) => {
            const selected = selectedKitId === kit.kitId;
            return (
              <button
                key={kit.kitId}
                type="button"
                onClick={() => handleKitSelect(kit)}
                className={`w-full text-left rounded-2xl border p-4 transition-all min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
                  selected
                    ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950"
                    : "border-slate-200 bg-white hover:border-slate-400"
                }`}
              >
                <p className="text-sm font-semibold text-slate-950">
                  {kit.kitName}
                </p>
                <div className="mt-2 space-y-1">
                  {kit.items.map((item) => (
                    <p key={item.sku} className="text-xs text-slate-500">
                      {item.name} × {item.qty} — {fmt(item.priceRub)} ₽/шт.
                    </p>
                  ))}
                </div>
                <p className="mt-2 text-sm font-bold text-slate-950">
                  {fmt(kit.totalRub)} ₽
                </p>
                {selected ? (
                  <p className="mt-1 text-xs text-emerald-600 font-medium">
                    ✓ Выбран
                  </p>
                ) : null}
              </button>
            );
          })}
          <p className="text-xs text-slate-400">
            Скидка 15% при заказе потолка применяется к итоговой смете
          </p>
        </div>
      ) : null}

      {mode === "custom" ? (
        <div className="pt-2">
          <textarea
            value={customNote}
            onChange={(e) => handleCustomNoteChange(e.target.value)}
            placeholder="Например: 3 трека по 2 метра, 8 спотов, тёплый свет..."
            maxLength={300}
            rows={3}
            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 resize-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            {customNote.length}/300 символов
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ModeCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-full text-left rounded-2xl border p-4 transition-all min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-950 hover:border-slate-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p
            className={`mt-0.5 text-xs ${
              active ? "text-white/70" : "text-slate-500"
            }`}
          >
            {description}
          </p>
        </div>
        <span
          className={`mt-0.5 h-4 w-4 rounded-full border ${
            active
              ? "border-white bg-white"
              : "border-slate-300 bg-transparent"
          }`}
        />
      </div>
    </button>
  );
}
