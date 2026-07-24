import { useEffect } from "react";
import { Star } from "lucide-react";

export default function PointsToast({ points, onDone }: { points: number | null; onDone: () => void }) {
  useEffect(() => {
    if (points == null) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [points, onDone]);

  if (points == null) return null;

  return (
    <div className="absolute top-20 inset-x-0 z-[1200] flex justify-center pointer-events-none">
      <div className="animate-popIn flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-l from-brand to-brand-light text-white font-bold shadow-glow shadow-brand text-sm">
        <Star size={16} className="fill-white" />
        קיבלת {points} נקודות! תודה על הדיווח
      </div>
    </div>
  );
}
