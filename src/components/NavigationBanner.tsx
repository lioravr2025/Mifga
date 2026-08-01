import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitMerge,
  Navigation,
  RefreshCw,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { describeManeuver, type RouteStep } from "../lib/routing";
import { formatDistance } from "../lib/geo";

function iconFor(step: RouteStep): LucideIcon {
  if (step.type === "depart") return Navigation;
  if (step.type === "arrive") return Flag;
  if (step.type === "roundabout" || step.type === "rotary") return RefreshCw;
  if (step.type === "merge") return GitMerge;
  switch (step.modifier) {
    case "left":
    case "sharp left":
      return CornerUpLeft;
    case "right":
    case "sharp right":
      return CornerUpRight;
    case "slight left":
      return ArrowUpLeft;
    case "slight right":
      return ArrowUpRight;
    case "uturn":
      return RotateCcw;
    default:
      return ArrowUp;
  }
}

/** Waze-style top banner during active turn-by-turn: big icon, distance to the next maneuver, what to do there. */
export default function NavigationBanner({ step, distanceM }: { step: RouteStep; distanceM: number }) {
  const Icon = iconFor(step);
  return (
    <div className="absolute top-0 inset-x-0 z-[550] safe-top px-3 pt-3">
      <div className="flex items-center gap-3 bg-bg-panel/95 backdrop-blur border border-bg-border rounded-2xl px-4 py-3 shadow-2xl">
        <span className="w-12 h-12 rounded-2xl bg-brand/15 border border-brand/40 flex items-center justify-center shrink-0">
          <Icon size={26} className="text-brand-light" strokeWidth={2.4} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{formatDistance(distanceM)}</div>
          <div className="text-sm text-neutral-300 truncate">{describeManeuver(step)}</div>
        </div>
      </div>
    </div>
  );
}
