// Mirrors src/data/hazardTypes.ts on the mobile app - keep ids in sync.
export interface HazardTypeOption {
  id: string;
  label: string;
}

export const HAZARD_TYPE_OPTIONS: HazardTypeOption[] = [
  { id: "police", label: "שוטר" },
  { id: "inspector", label: "פקח" },
  { id: "pothole", label: "חור בכביש" },
  { id: "car", label: "רכב מפריע" },
  { id: "sidewalk", label: "מדרכה משובשת" },
  { id: "camera", label: "מצלמה" },
  { id: "accident", label: "תאונה" },
  { id: "roadwork", label: "עבודות בכביש" },
  { id: "closure", label: "כביש חסום" },
  { id: "flood", label: "הצפה" },
  { id: "animal", label: "בעל חיים בכביש" },
];

export const HAZARD_TYPE_LABELS: Record<string, string> = Object.fromEntries(HAZARD_TYPE_OPTIONS.map((o) => [o.id, o.label]));
