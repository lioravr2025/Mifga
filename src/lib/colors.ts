// Single source of truth for hazard marker colors, keyed by HazardTypeDef.color.
// Previously duplicated across mapIcons/ReportFlow/MapScreen/HazardDetailSheet -
// centralized so a palette change (like the police/inspector swap) can't miss a copy.
export const HAZARD_COLOR_HEX: Record<string, string> = {
  police: "#f43f5e",
  inspector: "#38bdf8",
  pothole: "#a855f7",
  car: "#ef4444",
  sidewalk: "#facc15",
  green: "#22c55e",
};
