import { Award, Camera, FileText, History, Pencil, Settings, ShieldCheck, Star, Trophy } from "lucide-react";
import { useState } from "react";
import { useApp } from "../context/AppContext";
import { levelForPoints } from "../lib/levels";
import { timeAgo } from "../lib/geo";
import EditProfileSheet from "../components/EditProfileSheet";
import InviteFriendButton from "../components/InviteFriendButton";
import RideHistorySheet from "../components/RideHistorySheet";

const RECENT_RIDES_SHOWN = 3;

export default function ProfileScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { user, friends, rideLog } = useApp();
  const { level, title, progress, pointsToNext, isMax } = levelForPoints(user.points);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const totalHazardsAvoided = rideLog.reduce((sum, r) => sum + r.hazardsAvoided, 0);

  const board = [{ id: user.id, name: `${user.name} (את/ה)`, points: user.points, mine: true }, ...friends.map((f) => ({ id: f.id, name: f.name, points: f.points, mine: false }))]
    .sort((a, b) => b.points - a.points);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-6 pb-4 safe-top">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neutral-50">פרופיל</h1>
        <button onClick={onOpenSettings} className="w-10 h-10 rounded-xl bg-bg-panel border border-bg-border flex items-center justify-center">
          <Settings size={18} className="text-neutral-300" />
        </button>
      </div>

      <div className="flex flex-col items-center mb-6">
        <button onClick={() => setEditOpen(true)} className="relative mb-3 active:scale-95 transition">
          {user.avatarPhoto ? (
            <img src={user.avatarPhoto} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-brand shadow-glow shadow-brand" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-bg-panel2 border-2 border-brand flex items-center justify-center text-4xl shadow-glow shadow-brand">
              {user.avatarEmoji}
            </div>
          )}
          <span className="absolute bottom-0 left-0 w-7 h-7 rounded-full bg-brand flex items-center justify-center border-2 border-bg">
            <Pencil size={12} className="text-white" />
          </span>
        </button>
        <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 active:opacity-70 transition">
          <span className="text-lg font-bold text-neutral-50">{user.name}</span>
          <Pencil size={13} className="text-neutral-500" />
        </button>
        <div className="flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-brand/15 border border-brand/40">
          <Trophy size={13} className="text-brand-light" />
          <span className="text-xs font-semibold text-brand-light">
            רמה {level} · {title}
          </span>
        </div>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-brand to-purple-700 p-5 mb-5 shadow-glow shadow-brand">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/80 text-sm">סך כל הנקודות שלך</span>
          <Star size={18} className="text-white fill-white" />
        </div>
        <div className="text-4xl font-extrabold text-white mb-3">{user.points}</div>
        {!isMax ? (
          <>
            <div className="h-2 rounded-full bg-white/20 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="text-[11px] text-white/70 mt-1.5">עוד {pointsToNext} נקודות לרמה הבאה</div>
          </>
        ) : (
          <div className="text-[11px] text-white/70 mt-1.5">הגעת לרמה המקסימלית! 🏆</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-brand/15 flex items-center justify-center">
            <FileText size={18} className="text-brand-light" />
          </span>
          <div>
            <div className="text-lg font-bold text-neutral-50">{user.reportsCount}</div>
            <div className="text-[11px] text-neutral-400">דיווחים</div>
          </div>
        </div>
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Camera size={18} className="text-amber-400" />
          </span>
          <div>
            <div className="text-lg font-bold text-neutral-50">{user.reportsWithPhoto}</div>
            <div className="text-[11px] text-neutral-400">עם תמונה</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History size={16} className="text-brand-light" />
          <h2 className="text-sm font-bold text-neutral-100">יומן נסיעות</h2>
        </div>
        {rideLog.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] text-green-400 font-semibold">
            <ShieldCheck size={12} />
            {totalHazardsAvoided} מפגעים נחסכו בסך הכל
          </span>
        )}
      </div>
      {rideLog.length === 0 ? (
        <div className="p-4 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-center text-xs text-neutral-500 mb-6">
          עדיין לא תיעדתם נסיעה - לחצו "תחילת נסיעה" במסך הראשי כדי להתחיל
        </div>
      ) : (
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border divide-y divide-bg-border overflow-hidden mb-3">
          {rideLog.slice(0, RECENT_RIDES_SHOWN).map((r) => {
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
      )}
      {rideLog.length > RECENT_RIDES_SHOWN && (
        <button
          onClick={() => setHistoryOpen(true)}
          className="w-full py-2.5 mb-6 rounded-2xl bg-bg-panel2 border border-bg-border text-xs font-semibold text-brand-light active:scale-[0.98] transition"
        >
          נסיעות קודמות ({rideLog.length - RECENT_RIDES_SHOWN}+)
        </button>
      )}
      {rideLog.length > 0 && rideLog.length <= RECENT_RIDES_SHOWN && <div className="mb-6" />}

      <div className="mb-6">
        <InviteFriendButton />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Award size={16} className="text-brand-light" />
        <h2 className="text-sm font-bold text-neutral-100">המדווחים המובילים</h2>
      </div>
      <div className="rounded-2xl bg-bg-panel2 border border-bg-border divide-y divide-bg-border overflow-hidden mb-4">
        {board.map((row, i) => (
          <div key={row.id} className={`flex items-center gap-3 px-4 py-3 ${row.mine ? "bg-brand/10" : ""}`}>
            <span className="w-6 text-center text-sm font-bold text-neutral-400">{i + 1}</span>
            <span className="flex-1 text-sm font-medium text-neutral-100">{row.name}</span>
            <span className="text-sm font-bold text-brand-light">{row.points}</span>
          </div>
        ))}
      </div>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} />
      <RideHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
