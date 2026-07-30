import { Check, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { getHazardType } from "../data/hazardTypes";
import { HazardIcon } from "./HazardIcon";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import type { HazardReport } from "../types";

/** Waze-style "is it still there?" prompt - fires when a ride passes within alert range of a police/inspector report, same trigger as the audio beep. */
export default function RideHazardConfirmPopup({ hazard, onResolve }: { hazard: HazardReport | null; onResolve: () => void }) {
  const { confirmHazard, denyHazard } = useApp();

  if (!hazard) return null;

  const def = getHazardType(hazard.type);
  const hex = HAZARD_COLOR_HEX[def.color] ?? "#38bdf8";

  const respond = (stillThere: boolean) => {
    if (stillThere) confirmHazard(hazard.id);
    else denyHazard(hazard.id);
    onResolve();
  };

  return (
    <div className="absolute top-4 inset-x-4 z-[2100] safe-top animate-slideUp">
      <div className="bg-bg-panel/95 backdrop-blur border rounded-2xl p-4 shadow-2xl" style={{ borderColor: `${hex}66` }}>
        <div className="flex items-center gap-3 mb-3">
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#0f1830", border: `2px solid ${hex}`, boxShadow: `0 0 12px -1px ${hex}` }}
          >
            <HazardIcon name={def.icon} color={hex} size={20} strokeWidth={2.4} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-neutral-50">{def.label} בקרבתכם</div>
            <div className="text-xs text-neutral-400">האם זה עדיין שם?</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => respond(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500/15 border border-green-500/40 text-green-300 text-sm font-semibold active:scale-95 transition"
          >
            <Check size={15} />
            עדיין שם
          </button>
          <button
            onClick={() => respond(false)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm font-semibold active:scale-95 transition"
          >
            <X size={15} />
            כבר לא
          </button>
        </div>
      </div>
    </div>
  );
}
