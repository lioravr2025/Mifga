import type { VehicleTypeId } from "../types";
import ScooterIcon from "./ScooterIcon";

// Hand-drawn stroke icons in the same 24x24 style as ScooterIcon - lucide
// has no electric-bike/motorcycle-specific glyphs, so these fill the gap.
export function EBikeIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="18" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M5.5 18 10 9h5" />
      <path d="M10 9 8.5 6H6.5" />
      <path d="m12.5 9 3 5.5h3" />
      <path d="M16 5.5h2L19.5 8" />
    </svg>
  );
}

export function EMotorcycleIcon({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M7.3 18h9.4" />
      <path d="M9 18l1.5-6h4L16 18" />
      <path d="M10.5 12H8l-1.5 2.5" />
      <path d="M14.5 12h2.8" />
      <path d="M15 8.5h2.5L19 12" />
    </svg>
  );
}

export const VEHICLE_DEFS: { id: VehicleTypeId; label: string; Icon: (p: { size?: number; color?: string }) => JSX.Element }[] = [
  { id: "scooter", label: "קורקינט", Icon: ScooterIcon },
  { id: "ebike", label: "אופניים חשמליים", Icon: EBikeIcon },
  { id: "emotorcycle", label: "אופנוע חשמלי", Icon: EMotorcycleIcon },
];

export function vehicleLabel(id: VehicleTypeId): string {
  return VEHICLE_DEFS.find((v) => v.id === id)?.label ?? id;
}

export function VehicleIcon({ type, size = 20, color = "currentColor" }: { type: VehicleTypeId; size?: number; color?: string }) {
  const def = VEHICLE_DEFS.find((v) => v.id === type);
  if (!def) return null;
  const { Icon } = def;
  return <Icon size={size} color={color} />;
}
