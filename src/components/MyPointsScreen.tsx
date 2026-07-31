import { useEffect, useState } from "react";
import { Calendar, Camera, Coins, Gift, Loader2, Star, TriangleAlert, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { levelForPoints } from "../lib/levels";
import { fetchPointsBreakdown, type PointsBreakdown } from "../lib/backend/points";
import { isBackendConfigured } from "../lib/supabaseClient";

function Tile({
  icon,
  label,
  count,
  countLabel,
  points,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  countLabel: string;
  points: number;
  color: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border">
      <span className="w-9 h-9 rounded-full flex items-center justify-center mb-2.5" style={{ background: `${color}22` }}>
        {icon}
      </span>
      <div className="text-sm font-semibold text-neutral-50 mb-0.5">{label}</div>
      <div className="text-[11px] text-neutral-500 mb-2">
        {count} {countLabel}
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        +{points}
      </div>
    </div>
  );
}

export default function MyPointsScreen({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  const { level, title } = levelForPoints(user.points);
  const [breakdown, setBreakdown] = useState<PointsBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !isBackendConfigured || !user.id) return;
    setLoading(true);
    fetchPointsBreakdown(user.id, user.reportsCount, user.reportsWithPhoto)
      .then(setBreakdown)
      .catch((err) => console.error("Mifga: fetchPointsBreakdown failed", err))
      .finally(() => setLoading(false));
  }, [open, user.id, user.reportsCount, user.reportsWithPhoto]);

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="80%">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-neutral-50">הנקודות שלי</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="p-5 rounded-2xl bg-gradient-to-br from-brand to-purple-700 shadow-glow shadow-brand mb-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-white/80 text-xs mb-1.5">
          <Star size={13} className="fill-white/80" />
          רמה {level} · {title}
        </div>
        <div className="text-4xl font-extrabold text-white">{user.points}</div>
        <div className="text-xs text-white/70 mt-1">סך כל הנקודות שצברת</div>
      </div>

      <p className="text-[11px] text-neutral-500 leading-relaxed mb-4 text-center">
        כל נקודה נספרת - בעתיד תוכלו לממש את הנקודות שצברתם להטבות ושווי כספי, בדיוק כמו במועדוני לקוחות מובילים.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="text-neutral-500 animate-spin" />
        </div>
      ) : breakdown ? (
        <div className="grid grid-cols-2 gap-3">
          <Tile
            icon={<TriangleAlert size={16} color="#f59e0b" />}
            label="דיווחי מפגעים"
            count={breakdown.reportsCount}
            countLabel="דיווחים"
            points={breakdown.reportsPoints}
            color="#f59e0b"
          />
          <Tile
            icon={<Camera size={16} color="#22c55e" />}
            label="דיווחים עם תמונה"
            count={breakdown.reportsWithPhotoCount}
            countLabel="דיווחים"
            points={breakdown.reportsWithPhotoPoints}
            color="#22c55e"
          />
          <Tile
            icon={<Calendar size={16} color="#a78bfa" />}
            label="הגעה למפגשים"
            count={breakdown.meetupsCount}
            countLabel="מפגשים"
            points={breakdown.meetupsPoints}
            color="#a78bfa"
          />
          <Tile
            icon={<Gift size={16} color="#38bdf8" />}
            label="פרסים שנאספו"
            count={breakdown.prizesCount}
            countLabel="פרסים"
            points={breakdown.prizesPoints}
            color="#38bdf8"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-10 text-neutral-500 text-xs">
          <Coins size={16} />
          לא ניתן לטעון את פירוט הנקודות כרגע
        </div>
      )}
    </BottomSheet>
  );
}
