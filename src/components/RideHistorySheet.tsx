import { History, ShieldCheck, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { timeAgo } from "../lib/geo";

export default function RideHistorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { rideLog } = useApp();
  const totalHazardsAvoided = rideLog.reduce((sum, r) => sum + r.hazardsAvoided, 0);

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
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-9 h-9 rounded-full bg-brand/15 flex items-center justify-center shrink-0">
                <History size={15} className="text-brand-light" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100">נסיעה {timeAgo(r.startedAt)}</div>
                <div className="text-[11px] text-neutral-400">{minutes} דק'</div>
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-green-400 shrink-0">
                <ShieldCheck size={13} />
                {r.hazardsAvoided}
              </span>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
