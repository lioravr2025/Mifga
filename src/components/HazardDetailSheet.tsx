import { useState } from "react";
import { Tag, ThumbsDown, ThumbsUp, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { HazardIcon } from "./HazardIcon";
import Confetti from "./Confetti";
import { getHazardType } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { timeAgo } from "../lib/geo";
import { useApp } from "../context/AppContext";

export default function HazardDetailSheet({ hazardId, onClose }: { hazardId: string | null; onClose: () => void }) {
  const { hazards, confirmHazard, denyHazard } = useApp();
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  // look up the live hazard by id every render (rather than taking a snapshot
  // object as a prop) so vote counts update immediately after confirm/deny
  const hazard = hazardId ? hazards.find((h) => h.id === hazardId) ?? null : null;
  if (!hazard) return null;
  const def = getHazardType(hazard.type);
  const hex = HAZARD_COLOR_HEX[def.color];
  const likeScore = hazard.confirmations - hazard.denials;

  const vote = (kind: "confirm" | "deny") => {
    if (kind === "confirm") confirmHazard(hazard.id);
    else denyHazard(hazard.id);
    setConfettiTrigger((t) => t + 1);
  };

  return (
    <BottomSheet open={!!hazard} onClose={onClose} maxHeight="70%">
      <div className="relative">
        <Confetti trigger={confettiTrigger} />
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "#0f1830", border: `2px solid ${hex}`, boxShadow: `0 0 12px -2px ${hex}` }}
            >
              <HazardIcon name={def.icon} color={hex} size={24} />
            </span>
            <div>
              <div className="text-lg font-bold text-neutral-50">{def.label}</div>
              <div className="text-xs text-neutral-400">
                דווח ע״י {hazard.reporterName} · {timeAgo(hazard.createdAt)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 shrink-0">
            <X size={22} />
          </button>
        </div>

        {def.highPriority && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-semibold w-fit">
            מפגע בעדיפות גבוהה
          </div>
        )}

        {hazard.nickname && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-panel2 border border-bg-border w-fit">
            <Tag size={13} className="text-brand-light shrink-0" />
            <span className="text-xs text-neutral-200">{hazard.nickname}</span>
          </div>
        )}

        {hazard.photoDataUrl && (
          <img src={hazard.photoDataUrl} alt="" className="w-full h-40 object-cover rounded-2xl border border-bg-border mb-4" />
        )}

        <div className="text-sm text-neutral-300 mb-2">האם המפגע עדיין שם?</div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => vote("confirm")}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-300 font-semibold active:scale-95 transition"
          >
            <ThumbsUp size={18} />
            כן, עדיין שם
          </button>
          <button
            onClick={() => vote("deny")}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 font-semibold active:scale-95 transition"
          >
            <ThumbsDown size={18} />
            כבר לא שם
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
          <ThumbsUp size={11} className="text-brand-light" />
          <span className="font-semibold text-neutral-200">{likeScore}</span>
          <span>לייקים</span>
          {hazard.lastVoteAt && (
            <>
              <span className="mx-1">·</span>
              <span>לייק אחרון {timeAgo(hazard.lastVoteAt)}</span>
            </>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
