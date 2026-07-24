import type { HazardTypeDef, HazardTypeId } from "../types";

// Order here defines the order of the quick-report grid.
// police/inspector are both `highPriority` (bigger pulsing marker on the
// map + jump the queue in push notifications) AND `primary` - the only two
// shown up-front on the home screen. Every other type lives behind "עוד".
// police = red siren, inspector = blue shield (swapped from the original
// pairing per product feedback - police needs the more urgent, unmistakable mark).
export const HAZARD_TYPES: HazardTypeDef[] = [
  { id: "police", label: "שוטר", icon: "Siren", color: "police", highPriority: true, primary: true },
  { id: "inspector", label: "פקח", icon: "Shield", color: "inspector", highPriority: true, primary: true },
  { id: "pothole", label: "חור בכביש", icon: "CircleDashed", color: "pothole" },
  { id: "car", label: "רכב מפריע", icon: "CarFront", color: "car" },
  { id: "sidewalk", label: "מדרכה משובשת", icon: "Construction", color: "sidewalk" },
  { id: "camera", label: "מצלמה", icon: "Camera", color: "green" },
  { id: "accident", label: "תאונה", icon: "TriangleAlert", color: "car" },
  { id: "roadwork", label: "עבודות בכביש", icon: "HardHat", color: "sidewalk" },
  { id: "closure", label: "כביש חסום", icon: "Ban", color: "pothole" },
  { id: "flood", label: "הצפה", icon: "Waves", color: "inspector" },
  { id: "animal", label: "בעל חיים בכביש", icon: "PawPrint", color: "green" },
];

export const PRIMARY_HAZARD_TYPES = HAZARD_TYPES.filter((h) => h.primary);
export const MORE_HAZARD_TYPES = HAZARD_TYPES.filter((h) => !h.primary);

export function getHazardType(id: HazardTypeId): HazardTypeDef {
  const found = HAZARD_TYPES.find((h) => h.id === id);
  if (!found) throw new Error(`Unknown hazard type: ${id}`);
  return found;
}

export const REMOVAL_THRESHOLD = 5; // denial votes needed to auto-remove a hazard
export const POINTS_PER_REPORT = 1;
export const POINTS_PER_REPORT_WITH_PHOTO = 5;

/** Which of the 3 distinct ride-alert beep sounds a hazard type should play. */
export type RideAlertKind = "police" | "inspector" | "other";

export function rideAlertKind(type: HazardTypeId): RideAlertKind {
  if (type === "police") return "police";
  if (type === "inspector") return "inspector";
  return "other";
}
