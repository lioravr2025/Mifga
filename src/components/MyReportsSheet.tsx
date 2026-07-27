import { useEffect, useState } from "react";
import { Eye, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { HazardIcon } from "./HazardIcon";
import { useApp } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { fetchMyReports } from "../lib/backend/hazards";
import { getHazardType } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import type { HazardReport } from "../types";

/** "how many people saw and verified this report" - the closest real signal we track is votes (confirmations + denials), not raw impressions (which nothing currently counts). */
function verificationCount(h: HazardReport) {
  return h.confirmations + h.denials;
}

export default function MyReportsSheet({
  open,
  onClose,
  photoOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  photoOnly?: boolean;
}) {
  const { user, hazards: localHazards } = useApp();
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isBackendConfigured) {
      setReports(localHazards.filter((h) => h.reporterId === user.id));
      return;
    }
    setLoading(true);
    fetchMyReports(user.id)
      .then(setReports)
      .catch((err) => console.error("Mifga: fetchMyReports failed", err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);

  const visible = photoOnly ? reports.filter((r) => r.hasPhoto) : reports;

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="85%">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-50">{photoOnly ? "התמונות שצילמתי" : "הדיווחים שלי"}</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      {loading && <div className="text-center text-xs text-neutral-500 py-6">טוען...</div>}

      {!loading && visible.length === 0 && (
        <div className="p-4 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-center text-xs text-neutral-500">
          {photoOnly ? "עדיין לא צילמתם תמונה בדיווח" : "עדיין לא דיווחתם על מפגע"}
        </div>
      )}

      <div className="space-y-2.5">
        {visible.map((r) => {
          const def = getHazardType(r.type);
          const date = new Date(r.createdAt);
          return (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-2xl bg-bg-panel2 border border-bg-border">
              {r.hasPhoto && r.photoDataUrl ? (
                <img src={r.photoDataUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-bg-border shrink-0" />
              ) : (
                <span
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "#0f1830", border: `2px solid ${HAZARD_COLOR_HEX[def.color]}` }}
                >
                  <HazardIcon name={def.icon} color={HAZARD_COLOR_HEX[def.color]} size={20} />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{def.label}</div>
                <div className="text-[11px] text-neutral-400">
                  {date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })} ·{" "}
                  {date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  {r.removed && " · הוסר"}
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-brand-light shrink-0" title="כמות אימותים (עדין שם / לא שם)">
                <Eye size={13} />
                {verificationCount(r)}
              </span>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
