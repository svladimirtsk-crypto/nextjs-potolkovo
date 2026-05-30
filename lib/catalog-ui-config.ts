export type CatalogSectionId = "track-systems" | "point-fixtures" | "mounts-grilles";
export type TrackSystemId = "COLIBRI_220" | "CLARUS_48" | "TRACK_220";
export type TrackGroupId = "TRACK_FIXTURE" | "TRACK_PROFILE" | "TRACK_ACCESSORY";
export type PointSubtypeId = "GX53" | "MR16" | "PANELS";

export const CATALOG_SECTIONS: { id: CatalogSectionId; label: string }[] = [
  { id: "track-systems", label: "Трековые системы" },
  { id: "point-fixtures", label: "Точечные светильники" },
  { id: "mounts-grilles", label: "Закладные и решетки" },
];

export const TRACK_SYSTEMS: { id: TrackSystemId; label: string }[] = [
  { id: "COLIBRI_220", label: "COLIBRI 220V" },
  { id: "CLARUS_48", label: "CLARUS 48V" },
  { id: "TRACK_220", label: "ART 220V" },
];

export const TRACK_GROUPS: { id: TrackGroupId; label: string }[] = [
  { id: "TRACK_FIXTURE", label: "Светильники" },
  { id: "TRACK_PROFILE", label: "Профили/шинопроводы" },
  { id: "TRACK_ACCESSORY", label: "Аксессуары" },
];

export const POINT_SUBTYPES: { id: PointSubtypeId; label: string }[] = [
  { id: "GX53", label: "GX53" },
  { id: "MR16", label: "MR16" },
  { id: "PANELS", label: "Панели" },
];

export const REMOVED_COLIBRI_VENDOR_CODES = new Set<string>([
  "0У-00002967",
  "0У-00001345",
]);

export const TRACK_PROFILE_WHITELIST: Record<TrackSystemId, string[]> = {
  COLIBRI_220: ["0У-00006089", "0У-00006090", "0У-00006986"],
  CLARUS_48: ["0У-00006634", "0У-00006633"],
  TRACK_220: [
    "0У-00006342",
    "0У-00006341",
    "0У-00001613",
    "0У-00001356",
    "0У-00001355",
    "0У-00001354",
    "0У-00001353",
  ],
};
