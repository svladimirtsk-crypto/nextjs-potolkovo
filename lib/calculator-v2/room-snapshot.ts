import { homepage } from "@/content/homepage";
import type { CalculatorLeadSnapshot } from "@/components/home/price-calculator-context";
import type { DerivedInputs } from "@/lib/calculator-modal-types";
import { calcRecommendedTrackSpots } from "@/lib/lighting-formulas";

const calculator = homepage.price.calculator;
const CHANDELIERS_INSTALL_RATE_PER_UNIT = calculator.chandeliers?.ratePerUnit ?? 1000;

export type V2RoomConfig = {
  id: string;
  label: string;
  area: number;
  ceilingType: "standard" | "shadow" | "floating" | "shadow-floating";
  shadowEnabled: boolean;
  shadowLength: number;
  floatingEnabled: boolean;
  floatingLength: number;
  lightLinesEnabled: boolean;
  lightLinesLength: number;
  corniceType: "none" | "built-in" | "hidden-niche" | "surface";
  corniceLength: number;
  corniceLightingEnabled: boolean;
  corniceLightingLength: number;
  corniceLightingPowerSupplies: number;
  trackType: "none" | "built-in" | "surface";
  trackLength: number;
  chandeliersEnabled: boolean;
  chandeliersCount: number;
  lightsEnabled: boolean;
  lightsCount: number;
};

export function calcRoomSnapshotV2(room: V2RoomConfig): { total: number; snapshot: CalculatorLeadSnapshot } {
  const shadowCeiling = calculator.ceilingTypes.find(c=>c.slug==="shadow") ?? calculator.ceilingTypes[0];
  const floatingCeiling = calculator.ceilingTypes.find(c=>c.slug==="floating") ?? calculator.ceilingTypes[0];
  const selectedCeiling = calculator.ceilingTypes.find(c=>c.slug===room.ceilingType) ?? calculator.ceilingTypes[0];
  const selectedCornice = calculator.cornices.find(c=>c.slug===room.corniceType) ?? calculator.cornices[0];
  const selectedTrack = calculator.tracks.find(t=>t.slug===room.trackType) ?? calculator.tracks[0];

  const hasSpecial = room.shadowEnabled || room.floatingEnabled;
  const ceilingBaseRate = hasSpecial ? shadowCeiling.baseRatePerSqm : selectedCeiling.baseRatePerSqm;
  const ceilingBaseTotal = room.area * ceilingBaseRate;
  const shadowExtraTotal = room.shadowEnabled ? room.shadowLength * shadowCeiling.extraRatePerMeter : 0;
  const floatingExtraTotal = room.floatingEnabled ? room.floatingLength * floatingCeiling.extraRatePerMeter : 0;
  const ceilingExtraTotal = shadowExtraTotal + floatingExtraTotal;
  const lightLinesTotal = room.lightLinesEnabled ? room.lightLinesLength * calculator.lightLines.ratePerMeter : 0;
  const corniceTotal = selectedCornice.ratePerMeter > 0 ? room.corniceLength * selectedCornice.ratePerMeter : 0;
  const isCorniceLightingActive = room.corniceLightingEnabled && room.corniceType !== "none";
  const corniceLightingMetersTotal = isCorniceLightingActive ? (room.corniceLightingLength ?? room.corniceLength) * calculator.corniceLighting.ratePerMeter : 0;
  const corniceLightingPowerSupplyTotal = isCorniceLightingActive ? (room.corniceLightingPowerSupplies ?? 1) * calculator.corniceLighting.powerSupplyRate : 0;
  const corniceLightingTotal = corniceLightingMetersTotal + corniceLightingPowerSupplyTotal;
  const trackTotal = selectedTrack.ratePerMeter > 0 ? room.trackLength * selectedTrack.ratePerMeter : 0;
  const chandeliersTotal = room.chandeliersEnabled ? room.chandeliersCount * CHANDELIERS_INSTALL_RATE_PER_UNIT : 0;
  const lightsTotal = room.lightsEnabled ? room.lightsCount * calculator.lights.ratePerUnit : 0;
  const total = ceilingBaseTotal + ceilingExtraTotal + lightLinesTotal + corniceTotal + corniceLightingTotal + trackTotal + chandeliersTotal + lightsTotal;

  const derivedTrackMountType: DerivedInputs["trackMountType"] =
    room.trackType === "built-in" ? "built-in" : room.trackType === "surface" ? "surface" : "none";

  const snapshot: CalculatorLeadSnapshot = {
    area: room.area,
    calculationScope: "room",
    ceilingTypeLabel: !room.shadowEnabled && !room.floatingEnabled ? "Простой потолок" : `${room.shadowEnabled?"Теневой":""}${room.shadowEnabled&&room.floatingEnabled?" + ":""}${room.floatingEnabled?"Парящий":""}`,
    ceilingBaseRate,
    ceilingBaseTotal,
    ceilingExtraLabel: hasSpecial ? "Профиль" : null,
    ceilingLength: null,
    ceilingExtraRatePerMeter: null,
    ceilingExtraTotal,
    lightLinesEnabled: room.lightLinesEnabled,
    lightLinesLabel: room.lightLinesEnabled ? calculator.lightLines.label : null,
    lightLinesLength: room.lightLinesEnabled ? room.lightLinesLength : null,
    lightLinesRatePerMeter: room.lightLinesEnabled ? calculator.lightLines.ratePerMeter : null,
    lightLinesTotal,
    corniceLabel: selectedCornice.ratePerMeter>0 ? selectedCornice.label : null,
    corniceLength: selectedCornice.ratePerMeter>0 ? room.corniceLength : null,
    corniceRatePerMeter: selectedCornice.ratePerMeter>0 ? selectedCornice.ratePerMeter : null,
    corniceTotal,
    corniceLightingEnabled: room.corniceLightingEnabled,
    corniceLightingLabel: room.corniceLightingEnabled ? calculator.corniceLighting.label : null,
    corniceLightingLength: room.corniceLightingEnabled ? (room.corniceLightingLength ?? null) : null,
    corniceLightingRatePerMeter: room.corniceLightingEnabled ? calculator.corniceLighting.ratePerMeter : null,
    corniceLightingPowerSupplies: room.corniceLightingEnabled ? (room.corniceLightingPowerSupplies ?? null) : null,
    corniceLightingPowerSupplyRate: room.corniceLightingEnabled ? calculator.corniceLighting.powerSupplyRate : null,
    corniceLightingTotal,
    trackLabel: selectedTrack.ratePerMeter>0 ? selectedTrack.label : null,
    trackLength: selectedTrack.ratePerMeter>0 ? room.trackLength : null,
    trackRatePerMeter: selectedTrack.ratePerMeter>0 ? selectedTrack.ratePerMeter : null,
    trackTotal,
    chandeliersEnabled: room.chandeliersEnabled,
    chandeliersCount: room.chandeliersEnabled ? room.chandeliersCount : null,
    chandeliersRatePerUnit: CHANDELIERS_INSTALL_RATE_PER_UNIT,
    chandeliersTotal,
    lightsEnabled: room.lightsEnabled,
    lightsCount: room.lightsEnabled ? room.lightsCount : null,
    lightsRatePerUnit: calculator.lights.ratePerUnit,
    lightsTotal,
    total,
    derivedInputs: {
      pointSpotsQty: room.lightsEnabled ? room.lightsCount : 0,
      trackMountType: derivedTrackMountType,
      trackLengthMeters: room.trackType!=="none" ? room.trackLength : 0,
      recommendedTrackSpotsQty: calcRecommendedTrackSpots(room.trackType!=="none" ? room.trackLength : 0),
    },
  };

  return { total, snapshot };
}

export function calcRoomsTotal(rooms: V2RoomConfig[]): number {
  return rooms.reduce((sum, r) => sum + calcRoomSnapshotV2(r).total, 0);
}
