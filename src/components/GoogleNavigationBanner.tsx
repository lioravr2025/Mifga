import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitMerge,
  RefreshCw,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import type { RouteStep } from "../lib/googleRouting";
import { formatDistance } from "../lib/geo";

// Google's `maneuver` string ("turn-left", "roundabout-right", "merge", ...)
// maps directly to an icon - simpler than the OSRM version since Google
// already gives one flat string instead of a type+modifier pair.
function iconFor(maneuver: string): LucideIcon {
  if (maneuver.includes("sharp-left") || maneuver === "turn-left") return CornerUpLeft;
  if (maneuver.includes("sharp-right") || maneuver === "turn-right") return CornerUpRight;
  if (maneuver.includes("slight-left")) return ArrowUpLeft;
  if (maneuver.includes("slight-right")) return ArrowUpRight;
  if (maneuver.includes("roundabout")) return RefreshCw;
  if (maneuver === "merge" || maneuver.includes("ramp")) return GitMerge;
  if (maneuver === "uturn-left" || maneuver === "uturn-right") return RotateCcw;
  return ArrowUp;
}

export default function GoogleNavigationBanner({ step, distanceM, isArrived }: { step: RouteStep; distanceM: number; isArrived: boolean }) {
  const Icon = isArrived ? Flag : iconFor(step.maneuver);
  return (
    <div className="absolute top-0 inset-x-0 z-[550] safe-top px-3 pt-3">
      <div className="flex items-center gap-3 bg-bg-panel/95 backdrop-blur border border-bg-border rounded-2xl px-4 py-3 shadow-2xl">
        <span className="w-12 h-12 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center shrink-0">
          <Icon size={26} className="text-brand-light" strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{isArrived ? "" : formatDistance(distanceM)}</div>
          <div className="text-sm text-neutral-300 truncate">{isArrived ? "הגעתם ליעד" : step.instruction}</div>
        </div>
      </div>
    </div>
  );
}
