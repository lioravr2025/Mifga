import { Pencil, Star, Trophy } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { VehicleIcon, vehicleLabel } from "./VehicleIcons";
import { useApp } from "../context/AppContext";
import { levelForPoints } from "../lib/levels";

/** What a friend would see tapping your marker on the map - your public profile + vehicle. */
export default function MyProfileCard({ open, onClose, onGoProfile }: { open: boolean; onClose: () => void; onGoProfile: () => void }) {
  const { user } = useApp();
  const { level, title } = levelForPoints(user.points);

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="55%">
      <div className="flex flex-col items-center mb-5">
        {user.avatarPhoto ? (
          <img src={user.avatarPhoto} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-brand shadow-glow shadow-brand mb-3" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-bg-panel2 border-2 border-brand flex items-center justify-center text-4xl shadow-glow shadow-brand mb-3">
            {user.avatarEmoji}
          </div>
        )}
        <div className="text-lg font-bold text-neutral-50">{user.name}</div>
        <div className="flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-brand/15 border border-brand/40">
          <Trophy size={13} className="text-brand-light" />
          <span className="text-xs font-semibold text-brand-light">
            רמה {level} · {title}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-3">
        <div className="flex items-center gap-2 text-neutral-300 text-sm">
          <Star size={15} className="text-amber-400 fill-amber-400" />
          נקודות
        </div>
        <span className="text-lg font-bold text-brand-light">{user.points}</span>
      </div>

      <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border mb-5">
        {user.vehicleType ? (
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-full bg-brand/15 border border-brand/40 flex items-center justify-center">
              <VehicleIcon type={user.vehicleType} size={22} color="#a78bfa" />
            </span>
            <div>
              <div className="text-sm font-semibold text-neutral-50">{vehicleLabel(user.vehicleType)}</div>
              <div className="text-xs text-neutral-400">{user.vehicleModel || "ללא דגם מוגדר"}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-neutral-500 text-center">עדיין לא הוגדר כלי רכב - הוסיפו אחד בפרופיל</div>
        )}
      </div>

      <button
        onClick={onGoProfile}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand text-white font-bold text-sm active:scale-95 transition"
      >
        <Pencil size={15} />
        עריכת פרופיל וכלי
      </button>
    </BottomSheet>
  );
}
