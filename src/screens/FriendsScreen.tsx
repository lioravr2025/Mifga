import { useState } from "react";
import { Clock, MapPin, Mic, Navigation, Plus, Radio, Settings2, Square, Star, UserPlus, Users } from "lucide-react";
import { useApp, MAX_FAVORITE_FRIENDS } from "../context/AppContext";
import { formatDistance, distanceMeters } from "../lib/geo";
import { useGeolocation } from "../hooks/useGeolocation";
import { useWalkieRecorder } from "../hooks/useWalkieRecorder";
import CreateGroupSheet from "../components/CreateGroupSheet";
import GroupManageSheet from "../components/GroupManageSheet";
import type { WalkieGroup } from "../types";

export default function FriendsScreen({ onLocateFriend }: { onLocateFriend: (friendId: string) => void }) {
  const { friends, groups, toggleFavorite, sendGroupMessage } = useApp();
  const { position } = useGeolocation();
  const [lastSentLabel, setLastSentLabel] = useState<string | null>(null);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<WalkieGroup | null>(null);

  const notify = (label: string) => {
    setLastSentLabel(label);
    setTimeout(() => setLastSentLabel(null), 2200);
  };

  const { recordingFor, start, stop } = useWalkieRecorder((targetId) => {
    if (targetId.startsWith("g-")) {
      const group = groups.find((g) => g.id === targetId);
      sendGroupMessage(targetId);
      notify(`לקבוצה "${group?.name ?? ""}"`);
    } else {
      const friend = friends.find((f) => f.id === targetId);
      notify(friend?.name ?? "");
    }
  });

  const friendById = (id: string) => friends.find((f) => f.id === id);
  const favoriteCount = friends.filter((f) => f.favorite).length;

  const handleToggleFavorite = (id: string) => {
    const ok = toggleFavorite(id);
    if (!ok) {
      setFavoriteNotice(`ניתן לבחור עד ${MAX_FAVORITE_FRIENDS} חברים מועדפים`);
      setTimeout(() => setFavoriteNotice(null), 2200);
    }
  };

  // GroupManageSheet needs the live group object, not a stale snapshot from open-time
  const liveManageGroup = manageGroup ? groups.find((g) => g.id === manageGroup.id) ?? null : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-6 pb-4 safe-top">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-neutral-50">חברים</h1>
        <button className="w-10 h-10 rounded-xl bg-bg-panel border border-bg-border flex items-center justify-center">
          <UserPlus size={18} className="text-neutral-300" />
        </button>
      </div>
      <p className="text-xs text-neutral-400 mb-5">ראו איפה החברים שלכם נמצאים על המפה, ושלחו הודעת ווקי-טוקי מיידית</p>

      {lastSentLabel && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-300 text-sm font-semibold text-center">
          ההודעה הקולית נשלחה {lastSentLabel} 🎙️
        </div>
      )}
      {favoriteNotice && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-semibold text-center">
          {favoriteNotice}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-neutral-100">הקבוצות שלי</h2>
        <button
          onClick={() => setCreateGroupOpen(true)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-light active:scale-95 transition"
        >
          <Plus size={14} />
          קבוצה חדשה
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {groups.length === 0 && (
          <div className="p-4 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-center text-xs text-neutral-500">
            אין לך עדיין קבוצות. צרו קבוצה כדי לשלוח הודעת ווקי-טוקי לכמה חברים בבת אחת.
          </div>
        )}
        {groups.map((g) => {
          const accepted = g.members.filter((m) => m.status === "accepted");
          const pending = g.members.filter((m) => m.status === "pending");
          const recording = recordingFor === g.id;
          const canSend = accepted.length > 0;
          return (
            <div key={g.id} className="p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2 rtl:space-x-reverse shrink-0">
                  {g.members.slice(0, 4).map((m) => (
                    <span
                      key={m.friendId}
                      className="w-9 h-9 rounded-full bg-bg-panel border-2 border-bg-panel2 flex items-center justify-center text-base"
                    >
                      {friendById(m.friendId)?.avatarEmoji ?? "🙂"}
                    </span>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-neutral-50">{g.name}</div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <Users size={11} />
                    <span>{accepted.length} חברים</span>
                    {pending.length > 0 && (
                      <>
                        <span className="mx-1">·</span>
                        <Clock size={11} className="text-amber-400" />
                        <span className="text-amber-400">{pending.length} ממתינים לאישור</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setManageGroup(g)}
                  className="shrink-0 w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
                  title="ניהול קבוצה"
                >
                  <Settings2 size={15} className="text-neutral-300" />
                </button>
                <button
                  onMouseDown={() => canSend && start(g.id)}
                  onMouseUp={() => recording && stop(g.id)}
                  onTouchStart={() => canSend && start(g.id)}
                  onTouchEnd={() => recording && stop(g.id)}
                  disabled={!canSend}
                  className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center border active:scale-95 transition disabled:opacity-30 ${
                    recording ? "bg-red-500 border-red-400 animate-pulseRing" : "bg-brand/15 border-brand/50"
                  }`}
                  title="החזיקו כדי לשלוח הודעה קולית לכל הקבוצה"
                >
                  {recording ? <Square size={16} className="text-white fill-white" /> : <Mic size={18} className="text-brand-light" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-neutral-100">כל החברים</h2>
        <span className="text-[11px] text-neutral-500">
          <Star size={11} className="inline mb-0.5" /> {favoriteCount}/{MAX_FAVORITE_FRIENDS} מועדפים
        </span>
      </div>
      <div className="space-y-3">
        {friends.map((f) => {
          const dist = distanceMeters(position, f.position);
          const recording = recordingFor === f.id;
          return (
            <div key={f.id} className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border">
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center text-2xl">{f.avatarEmoji}</div>
                <span
                  className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-bg-panel2 ${f.online ? "bg-green-500" : "bg-neutral-600"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-50">{f.name}</div>
                <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                  {f.shareLocation ? (
                    <>
                      <MapPin size={11} />
                      <span>{formatDistance(dist)} ממך</span>
                    </>
                  ) : (
                    <span>מיקום לא משותף</span>
                  )}
                  <span className="mx-1">·</span>
                  <span className="text-brand-light font-semibold">{f.points} נק'</span>
                </div>
              </div>
              <button
                onClick={() => handleToggleFavorite(f.id)}
                className="shrink-0 w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
                title="הוספה למועדפים"
              >
                <Star size={15} className={f.favorite ? "text-amber-400 fill-amber-400" : "text-neutral-500"} />
              </button>
              {f.shareLocation && (
                <button
                  onClick={() => onLocateFriend(f.id)}
                  className="shrink-0 w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
                  title="איתור על המפה"
                >
                  <Navigation size={15} className="text-brand-light" />
                </button>
              )}
              {f.allowWalkie ? (
                <button
                  onMouseDown={() => start(f.id)}
                  onMouseUp={() => recording && stop(f.id)}
                  onTouchStart={() => start(f.id)}
                  onTouchEnd={() => recording && stop(f.id)}
                  className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center border active:scale-95 transition ${
                    recording ? "bg-red-500 border-red-400 animate-pulseRing" : "bg-brand/15 border-brand/50"
                  }`}
                  title="החזיקו כדי לשלוח הודעה קולית מתפרצת"
                >
                  {recording ? <Square size={16} className="text-white fill-white" /> : <Mic size={18} className="text-brand-light" />}
                </button>
              ) : (
                <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-bg-panel border border-bg-border opacity-40">
                  <Mic size={18} className="text-neutral-500" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 p-4 rounded-2xl bg-bg-panel2 border border-bg-border flex items-start gap-3">
        <Radio size={18} className="text-brand-light shrink-0 mt-0.5" />
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          ווקי-טוקי: החזיקו את כפתור המיקרופון ליד שם חבר (או ליד קבוצה) כדי לשלוח הודעה קולית שתישמע מיד גם אם הטלפון נעול, בכפוף
          להרשאת "הודעות מתפרצות" שאושרה מראש.
        </p>
      </div>

      <CreateGroupSheet open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
      <GroupManageSheet group={liveManageGroup} onClose={() => setManageGroup(null)} />
    </div>
  );
}
