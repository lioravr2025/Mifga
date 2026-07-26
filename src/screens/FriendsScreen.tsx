import { useState } from "react";
import { Check, Clock, MapPin, Mic, Navigation, Plus, Radio, Search, Settings2, Square, Star, UserPlus, Users, X } from "lucide-react";
import { useApp, MAX_FAVORITE_FRIENDS } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { formatDistance, distanceMeters } from "../lib/geo";
import { useGeolocation } from "../hooks/useGeolocation";
import { useWalkieRecorder } from "../hooks/useWalkieRecorder";
import CreateGroupSheet from "../components/CreateGroupSheet";
import GroupManageSheet from "../components/GroupManageSheet";
import AddFriendSheet from "../components/AddFriendSheet";
import InviteFriendButton from "../components/InviteFriendButton";
import Avatar from "../components/Avatar";
import type { WalkieGroup } from "../types";

export default function FriendsScreen({ onLocateFriend }: { onLocateFriend: (friendId: string) => void }) {
  const {
    friends,
    groups,
    toggleFavorite,
    sendGroupMessage,
    sendFriendMessage,
    incomingFriendRequests,
    incomingGroupInvites,
    respondFriendRequest,
    respondGroupInvite,
  } = useApp();
  const { position } = useGeolocation();
  const [lastSentLabel, setLastSentLabel] = useState<string | null>(null);
  const [favoriteNotice, setFavoriteNotice] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<WalkieGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [recError, setRecError] = useState<string | null>(null);

  const notify = (label: string) => {
    setLastSentLabel(label);
    setTimeout(() => setLastSentLabel(null), 2200);
  };

  const notifyError = (reason?: string) => {
    // Shown to the user (not just logged) so a bug report can include the exact
    // reason instead of everyone having to guess - reason is a DOMException
    // name like NotAllowedError (permission denied) / NotFoundError (no mic).
    setRecError(`לא הצלחנו להקליט - בדקו הרשאת מיקרופון בהגדרות המכשיר${reason ? ` (${reason})` : ""}`);
    setTimeout(() => setRecError(null), 5000);
  };

  const { recordingFor, start, stop, cancel } = useWalkieRecorder((targetId, blob, errorReason) => {
    if (isBackendConfigured && !blob) {
      notifyError(errorReason);
      return;
    }
    if (targetId.startsWith("g-")) {
      const group = groups.find((g) => g.id === targetId);
      sendGroupMessage(targetId, blob);
      notify(`לקבוצה "${group?.name ?? ""}"`);
    } else {
      const friend = friends.find((f) => f.id === targetId);
      sendFriendMessage(targetId, blob);
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

  const query = searchQuery.trim().toLowerCase();
  const visibleFriends = query
    ? friends.filter((f) => f.username.toLowerCase().includes(query) || f.name.toLowerCase().includes(query))
    : friends;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-6 pb-4 safe-top">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-neutral-50">חברים</h1>
        <InviteFriendButton variant="compact" label="הזמנת חבר" />
      </div>
      <p className="text-xs text-neutral-400 mb-4">ראו איפה החברים שלכם נמצאים על המפה, ושלחו הודעת ווקי-טוקי מיידית</p>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border">
          <Search size={15} className="text-neutral-400 shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש בין החברים שלי"
            dir="ltr"
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500 text-right"
          />
        </div>
        {isBackendConfigured && (
          <button
            onClick={() => setAddFriendOpen(true)}
            className="shrink-0 w-11 h-11 rounded-2xl bg-brand/15 border border-brand/50 flex items-center justify-center active:scale-95 transition"
            title="הוספת חבר"
          >
            <UserPlus size={18} className="text-brand-light" />
          </button>
        )}
      </div>

      <div className="mb-5">
        <InviteFriendButton />
      </div>

      {isBackendConfigured && (incomingFriendRequests.length > 0 || incomingGroupInvites.length > 0) && (
        <div className="space-y-2 mb-6">
          {incomingFriendRequests.map((r) => (
            <div key={r.friendshipId} className="flex items-center gap-3 p-3.5 rounded-2xl bg-brand/10 border border-brand/40">
              <Avatar emoji={r.fromAvatarEmoji} photoUrl={r.fromAvatarPhoto} size={36} className="border border-bg-border" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-50">{r.fromName}</div>
                <div className="text-[11px] text-neutral-400">רוצה להתחבר אליך</div>
              </div>
              <button
                onClick={() => respondFriendRequest(r.friendshipId, true)}
                className="w-9 h-9 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center active:scale-95 transition"
                title="אישור"
              >
                <Check size={15} className="text-green-400" />
              </button>
              <button
                onClick={() => respondFriendRequest(r.friendshipId, false)}
                className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center active:scale-95 transition"
                title="דחייה"
              >
                <X size={15} className="text-red-400" />
              </button>
            </div>
          ))}
          {incomingGroupInvites.map((inv) => (
            <div key={inv.groupId} className="flex items-center gap-3 p-3.5 rounded-2xl bg-brand/10 border border-brand/40">
              <span className="w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center shrink-0">
                <Users size={16} className="text-brand-light" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-50">{inv.groupName}</div>
                <div className="text-[11px] text-neutral-400">הוזמנת להצטרף לקבוצת ווקי-טוקי</div>
              </div>
              <button
                onClick={() => respondGroupInvite(inv.groupId, true)}
                className="w-9 h-9 rounded-full bg-green-500/15 border border-green-500/40 flex items-center justify-center active:scale-95 transition"
                title="הצטרפות"
              >
                <Check size={15} className="text-green-400" />
              </button>
              <button
                onClick={() => respondGroupInvite(inv.groupId, false)}
                className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center active:scale-95 transition"
                title="דחייה"
              >
                <X size={15} className="text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}

      {lastSentLabel && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-green-500/15 border border-green-500/40 text-green-300 text-sm font-semibold text-center">
          ההודעה הקולית נשלחה {lastSentLabel} 🎙️
        </div>
      )}
      {recError && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-sm font-semibold text-center">
          {recError}
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
                    <Avatar
                      key={m.friendId}
                      emoji={friendById(m.friendId)?.avatarEmoji ?? "🙂"}
                      photoUrl={friendById(m.friendId)?.avatarPhoto}
                      size={36}
                      className="border-2 border-bg-panel2"
                    />
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
                  onMouseLeave={() => recording && stop(g.id)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (canSend) start(g.id);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (recording) stop(g.id);
                  }}
                  onTouchCancel={() => cancel(g.id)}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={!canSend}
                  style={{ touchAction: "none" }}
                  className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center border active:scale-95 transition disabled:opacity-30 select-none ${
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
      {visibleFriends.length === 0 && (
        <div className="p-4 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-center text-xs text-neutral-500">
          לא נמצא חבר בשם המשתמש "{searchQuery}"
        </div>
      )}
      <div className="space-y-3">
        {visibleFriends.map((f) => {
          const dist = distanceMeters(position, f.position);
          const recording = recordingFor === f.id;
          return (
            <div key={f.id} className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border">
              <div className="relative shrink-0">
                <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={48} className="border border-bg-border" />
                <span
                  className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-bg-panel2 ${f.online ? "bg-green-500" : "bg-neutral-600"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-neutral-50">{f.name}</span>
                  <span className="text-[11px] text-neutral-500" dir="ltr">
                    @{f.username}
                  </span>
                </div>
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
                  onMouseLeave={() => recording && stop(f.id)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    start(f.id);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (recording) stop(f.id);
                  }}
                  onTouchCancel={() => cancel(f.id)}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ touchAction: "none" }}
                  className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center border active:scale-95 transition select-none ${
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
      <AddFriendSheet open={addFriendOpen} onClose={() => setAddFriendOpen(false)} />
    </div>
  );
}
