import { useState } from "react";
import {
  Check,
  Clock,
  Instagram,
  MapPin,
  Mic,
  Music2,
  Navigation,
  Pin,
  Plus,
  Radio,
  Settings2,
  Square,
  Trophy,
  Users,
  X,
} from "lucide-react";
import ScooterIcon from "../components/ScooterIcon";
import { useApp, MAX_FAVORITE_FRIENDS, MAX_PINNED_GROUPS } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { formatDistance, distanceMeters } from "../lib/geo";
import { useGeolocation } from "../hooks/useGeolocation";
import { useWalkieRecorder } from "../hooks/useWalkieRecorder";
import CreateGroupSheet from "../components/CreateGroupSheet";
import GroupManageSheet from "../components/GroupManageSheet";
import AddFriendInline from "../components/AddFriendInline";
import InviteFriendButton from "../components/InviteFriendButton";
import Avatar from "../components/Avatar";
import FriendProfileSheet from "../components/FriendProfileSheet";
import type { Friend, WalkieGroup } from "../types";

type Tab = "friends" | "groups";

export default function FriendsScreen({ onLocateFriend }: { onLocateFriend: (friendId: string) => void }) {
  const {
    friends,
    groups,
    toggleFavorite,
    toggleGroupPin,
    sendGroupMessage,
    sendFriendMessage,
    incomingFriendRequests,
    incomingGroupInvites,
    respondFriendRequest,
    respondGroupInvite,
    settings,
    updateSettings,
  } = useApp();
  const { position } = useGeolocation();
  const [tab, setTab] = useState<Tab>("friends");
  const [lastSentLabel, setLastSentLabel] = useState<string | null>(null);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [manageGroup, setManageGroup] = useState<WalkieGroup | null>(null);
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);

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
  const pinnedFriendCount = friends.filter((f) => f.favorite).length;
  const pinnedGroupCount = groups.filter((g) => g.pinned).length;
  // Pinned first, otherwise keep the order the backend/local store already gave us.
  const sortedFriends = [...friends].sort((a, b) => Number(b.favorite) - Number(a.favorite));
  const sortedGroups = [...groups].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  // Friends-only leaderboard on purpose - competing against people you know
  // beats a faceless global one. Hidden entirely if nobody's reported anything.
  const topReporters = [...friends]
    .filter((f) => f.reportsCount > 0)
    .sort((a, b) => b.reportsCount - a.reportsCount)
    .slice(0, 3);
  const ridingFriends = friends.filter((f) => f.riding);

  const handleTogglePinFriend = (id: string) => {
    const ok = toggleFavorite(id);
    if (!ok) {
      setPinNotice(`ניתן לנעוץ עד ${MAX_FAVORITE_FRIENDS} חברים`);
      setTimeout(() => setPinNotice(null), 2200);
    }
  };

  const handleTogglePinGroup = (id: string) => {
    const ok = toggleGroupPin(id);
    if (!ok) {
      setPinNotice(`ניתן לנעוץ עד ${MAX_PINNED_GROUPS} קבוצות`);
      setTimeout(() => setPinNotice(null), 2200);
    }
  };

  // GroupManageSheet needs the live group object, not a stale snapshot from open-time
  const liveManageGroup = manageGroup ? groups.find((g) => g.id === manageGroup.id) ?? null : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-6 pb-4 safe-top">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-neutral-50">חברים</h1>
        <InviteFriendButton variant="compact" label="הזמנת חבר" />
      </div>
      <p className="text-xs text-neutral-400 mb-4">ראו איפה החברים שלכם נמצאים על המפה, ושלחו הודעת ווקי-טוקי מיידית</p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("friends")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition ${
            tab === "friends" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
          }`}
        >
          החברים שלי
          {incomingFriendRequests.length > 0 && (
            <span className="w-[18px] h-[18px] min-w-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {incomingFriendRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("groups")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-semibold transition ${
            tab === "groups" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
          }`}
        >
          הקבוצות שלי
          {incomingGroupInvites.length > 0 && (
            <span className="w-[18px] h-[18px] min-w-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {incomingGroupInvites.length}
            </span>
          )}
        </button>
      </div>

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
      {pinNotice && (
        <div className="mb-4 px-4 py-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-sm font-semibold text-center">
          {pinNotice}
        </div>
      )}

      {tab === "friends" ? (
        <>
          {isBackendConfigured && incomingFriendRequests.length > 0 && (
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
            </div>
          )}

          {isBackendConfigured && <AddFriendInline />}

          {ridingFriends.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-bold text-neutral-100 mb-2.5 flex items-center gap-1.5">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-green-500 animate-ping" />
                  <span className="relative w-2 h-2 rounded-full bg-green-500" />
                </span>
                רוכבים עכשיו
              </h2>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {ridingFriends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => (f.shareLocation ? onLocateFriend(f.id) : setViewingFriend(f))}
                    className="flex flex-col items-center gap-1 shrink-0 active:scale-95 transition"
                  >
                    <div className="relative">
                      <span className="absolute -inset-1 rounded-full border-2 border-green-500 animate-pulseRing" />
                      <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={48} className="border-2 border-green-500" />
                      <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 rounded-full bg-green-500 border-2 border-bg flex items-center justify-center">
                        <ScooterIcon size={11} color="white" />
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-neutral-200 max-w-[56px] truncate">{f.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {topReporters.length > 0 && (
            <div className="mb-5 p-4 rounded-2xl bg-bg-panel2 border border-bg-border">
              <h2 className="text-sm font-bold text-neutral-100 mb-3 flex items-center gap-1.5">
                <Trophy size={15} className="text-amber-400" />
                אלופי הדיווח בין החברים שלך
              </h2>
              <div className="space-y-2.5">
                {topReporters.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2.5">
                    <span
                      className={`w-6 text-center text-sm font-extrabold shrink-0 ${
                        i === 0 ? "text-amber-400" : i === 1 ? "text-neutral-300" : "text-amber-700"
                      }`}
                    >
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                    </span>
                    <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={32} className="border border-bg-border shrink-0" />
                    <span className="flex-1 text-sm font-semibold text-neutral-100 truncate">{f.name}</span>
                    <span className="text-xs font-bold text-brand-light shrink-0">{f.reportsCount} דיווחים</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-neutral-100">כל החברים</h2>
            <span className="text-[11px] text-neutral-500">
              <Pin size={11} className="inline mb-0.5" /> {pinnedFriendCount}/{MAX_FAVORITE_FRIENDS} נעוצים
            </span>
          </div>
          {friends.length === 0 && (
            <div className="p-4 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-center text-xs text-neutral-500 mb-6">
              עדיין אין לך חברים. חפשו למעלה לפי שם משתמש כדי להוסיף חבר ראשון.
            </div>
          )}
          <div className="space-y-3 mb-6">
            {sortedFriends.map((f) => {
              const dist = distanceMeters(position, f.position);
              const recording = recordingFor === f.id;
              return (
                <div key={f.id} className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-bg-panel2 border border-bg-border">
                  <button onClick={() => setViewingFriend(f)} className="relative shrink-0 active:scale-95 transition">
                    <Avatar
                      emoji={f.avatarEmoji}
                      photoUrl={f.avatarPhoto}
                      size={48}
                      className={f.riding ? "border-2 border-green-500" : "border border-bg-border"}
                    />
                    {f.riding ? (
                      <span className="absolute bottom-0 left-0 w-4 h-4 rounded-full bg-green-500 border-2 border-bg-panel2 flex items-center justify-center">
                        <ScooterIcon size={9} color="white" />
                      </span>
                    ) : (
                      <span
                        className={`absolute bottom-0 left-0 w-3.5 h-3.5 rounded-full border-2 border-bg-panel2 ${f.online ? "bg-green-500" : "bg-neutral-600"}`}
                      />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-neutral-50">{f.name}</span>
                      <span className="text-[11px] text-neutral-500" dir="ltr">
                        @{f.username}
                      </span>
                      {f.instagram && (
                        <a
                          href={`https://instagram.com/${f.instagram}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neutral-400 active:text-brand-light"
                          title={`@${f.instagram} באינסטגרם`}
                        >
                          <Instagram size={13} />
                        </a>
                      )}
                      {f.tiktok && (
                        <a
                          href={`https://tiktok.com/@${f.tiktok}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neutral-400 active:text-brand-light"
                          title={`@${f.tiktok} בטיקטוק`}
                        >
                          <Music2 size={13} />
                        </a>
                      )}
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
                    onClick={() => handleTogglePinFriend(f.id)}
                    className="shrink-0 w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
                    title="נעיצה"
                  >
                    <Pin size={15} className={f.favorite ? "text-amber-400 fill-amber-400" : "text-neutral-500"} />
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

          <InviteFriendButton />
        </>
      ) : (
        <>
          {isBackendConfigured && incomingGroupInvites.length > 0 && (
            <div className="space-y-2 mb-6">
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

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-neutral-100">
              כל הקבוצות
              <span className="mr-2 text-[11px] text-neutral-500 font-normal">
                <Pin size={11} className="inline mb-0.5" /> {pinnedGroupCount}/{MAX_PINNED_GROUPS} נעוצות
              </span>
            </h2>
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
            {sortedGroups.map((g) => {
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
                      onClick={() => handleTogglePinGroup(g.id)}
                      className="shrink-0 w-9 h-9 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
                      title="נעיצה"
                    >
                      <Pin size={15} className={g.pinned ? "text-amber-400 fill-amber-400" : "text-neutral-500"} />
                    </button>
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
        </>
      )}

      {!settings.walkieTipDismissed && (
        <div className="p-4 rounded-2xl bg-bg-panel2 border border-bg-border flex items-start gap-3">
          <Radio size={18} className="text-brand-light shrink-0 mt-0.5" />
          <p className="flex-1 text-[11px] text-neutral-400 leading-relaxed">
            ווקי-טוקי: החזיקו את כפתור המיקרופון ליד שם חבר (או ליד קבוצה) כדי לשלוח הודעה קולית שתישמע מיד גם אם הטלפון נעול, בכפוף
            להרשאת "הודעות מתפרצות" שאושרה מראש.
          </p>
          <button
            onClick={() => updateSettings({ walkieTipDismissed: true })}
            className="shrink-0 text-neutral-500 active:text-neutral-300"
            title="סגירה"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <CreateGroupSheet open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
      <GroupManageSheet group={liveManageGroup} onClose={() => setManageGroup(null)} />
      <FriendProfileSheet friend={viewingFriend} onClose={() => setViewingFriend(null)} />
    </div>
  );
}
