import { useState } from "react";
import { ChevronLeft, History, ShieldCheck, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import RideRouteSheet from "./RideRouteSheet";
import { useApp } from "../context/AppContext";
import { timeAgo } from "../lib/geo";
import type { RideLogEntry } from "../types";

export default function RideHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rideLog } = useApp();
  const totalHazardsAvoided = rideLog.reduce((sum, r) => sum + r.hazardsAvoided, 0);
  const [selectedRide, setSelectedRide] = useState<RideLogEntry | null>(null);

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-neutral-50">כל הנסיעות</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>
      <p className="text-xs text-neutral-400 mb-4">
        {rideLog.length} נסיעות · {totalHazardsAvoided} מפגעים נחסכו בסך הכל
      </p>

      <div className="rounded-2xl bg-bg-panel2 border border-bg-border divide-y divide-bg-border overflow-hidden">
        {rideLog.map((r) => {
          const minutes = Math.max(1, Math.round((r.endedAt - r.startedAt) / 60000));
          const start = new Date(r.startedAt);
          const dateLabel = start.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
          const timeLabel = start.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRide(r)}
              className="w-full flex items-center gap-3 px-4 py-3 active:bg-bg-panel transition text-right"
            >
              <span className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
                <History size={15} className="text-brand-light" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100">
                  {dateLabel} · {timeLabel}
                </div>
                <div className="text-[11px] text-neutral-400">
                  {minutes} דק' · {timeAgo(r.startedAt)}
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-green-400 shrink-0">
                <ShieldCheck size={13} />
                {r.hazardsAvoided}
              </span>
              <ChevronLeft size={16} className="text-neutral-500 shrink-0" />
            </button>
          );
        })}
      </div>

      <RideRouteSheet ride={selectedRide} onClose={() => setSelectedRide(null)} />
    </BottomSheet>
  );
}
