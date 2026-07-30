import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Shield,
  Siren,
  CircleDashed,
  CarFront,
  Construction,
  Camera,
  TriangleAlert,
  HardHat,
  Ban,
  Waves,
  PawPrint,
  type LucideIcon,
} from "lucide-react";

// Mirrors src/data/hazardTypes.ts + src/lib/colors.ts on the mobile app - keep
// ids/icons/colors in sync so the admin map reads exactly like the app's.
export interface HazardTypeOption {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

export const HAZARD_TYPE_OPTIONS: HazardTypeOption[] = [
  { id: "police", label: "שוטר", icon: Siren, color: "#f43f5e" },
  { id: "inspector", label: "פקח", icon: Shield, color: "#38bdf8" },
  { id: "pothole", label: "חור בכביש", icon: CircleDashed, color: "#a855f7" },
  { id: "car", label: "רכב מפריע", icon: CarFront, color: "#ef4444" },
  { id: "sidewalk", label: "מדרכה משובשת", icon: Construction, color: "#facc15" },
  { id: "camera", label: "מצלמה", icon: Camera, color: "#22c55e" },
  { id: "accident", label: "תאונה", icon: TriangleAlert, color: "#ef4444" },
  { id: "roadwork", label: "עבודות בכביש", icon: HardHat, color: "#facc15" },
  { id: "closure", label: "כביש חסום", icon: Ban, color: "#a855f7" },
  { id: "flood", label: "הצפה", icon: Waves, color: "#38bdf8" },
  { id: "animal", label: "בעל חיים בכביש", icon: PawPrint, color: "#22c55e" },
];

export const HAZARD_TYPE_LABELS: Record<string, string> = Object.fromEntries(HAZARD_TYPE_OPTIONS.map((o) => [o.id, o.label]));
const HAZARD_TYPE_BY_ID: Record<string, HazardTypeOption> = Object.fromEntries(HAZARD_TYPE_OPTIONS.map((o) => [o.id, o]));

/** Same visual language as the mobile app's hazardDivIcon (mapIcons.tsx) - a colored ring around a lucide icon on a dark circle. */
export function hazardMapIcon(type: string): L.DivIcon {
  const def = HAZARD_TYPE_BY_ID[type];
  const hex = def?.color ?? "#38bdf8";
  const Icon = def?.icon ?? TriangleAlert;
  const size = 34;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "9999px",
        background: "#0f1830",
        border: `2px solid ${hex}`,
        boxShadow: `0 0 10px -1px ${hex}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={17} color={hex} strokeWidth={2.4} />
    </div>
  );
  return L.divIcon({ html, className: "mifga-admin-hazard-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
}

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
