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

// Mirrors src/data/hazardTypes.ts on the mobile app - police/inspector hazards
// are never actually deleted server-side when their 20-minute silent window
// elapses, each client just stops showing them. The admin dashboard needs the
// same filter, or it keeps "seeing" reports riders can no longer see at all.
export const HAZARD_EXPIRY_MS = 20 * 60_000;
export const HAZARD_EXPIRY_TYPES = ["police", "inspector"];

export function isHazardExpired(h: { type: string; created_at: string; last_vote_at: string | null }): boolean {
  if (!HAZARD_EXPIRY_TYPES.includes(h.type)) return false;
  const lastInteraction = new Date(h.last_vote_at ?? h.created_at).getTime();
  return Date.now() - lastInteraction >= HAZARD_EXPIRY_MS;
}
