import { useState } from "react";
import { Check, Clock, Mail, Play, Plus, UserMinus, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import Avatar from "./Avatar";
import { useApp } from "../context/AppContext";
import { timeAgo } from "../lib/geo";
import { playAudioUrl } from "../lib/nativeMic";
import type { WalkieGroup } from "../types";

export default function GroupManageSheet({ group, onClose }: { group: WalkieGroup | null; onClose: () => void }) {
  const { friends, addMembersToGroup, removeMemberFromGroup } = useApp();
  const [addMode, setAddMode] = useState(false);

  if (!group) return null;

  const friendById = (id: string) => friends.find((f) => f.id === id);
  const memberIds = new Set(group.members.map((m) => m.friendId));
  const addable = friends.filter((f) => !memberIds.has(f.id));
  const messages = group.messages ?? [];
  const lastMessage = messages[messages.length - 1];

  const close = () => {
    setAddMode(false);
    onClose();
  };

  const lastSeenLabel = (friendId: string) => {
    const f = friendById(friendId);
    if (!f) return "";
    return f.online ? "מחובר עכשיו" : `מחובר לאחרונה ${timeAgo(f.lastSeenAt)}`;
  };

  return (
    <BottomSheet open={!!group} onClose={close} maxHeight="85%">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-50">ניהול "{group.name}"</h2>
        <button onClick={close} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-neutral-100">חברים בקבוצה</h3>
        <button
          onClick={() => setAddMode((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-brand-light active:scale-95 transition"
        >
          <Plus size={14} />
          הוספת חברים
        </button>
      </div>

      <div className="space-y-2 mb-4">
        {group.members.length === 0 && <div className="text-xs text-neutral-500 text-center py-3">אין עדיין חברים בקבוצה</div>}
        {group.members.map((m) => {
          const f = friendById(m.friendId);
          if (!f) return null;
          return (
            <div key={m.friendId} className="flex items-center gap-3 p-3 rounded-2xl bg-bg-panel2 border border-bg-border">
              <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={36} className="border border-bg-border" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{f.name}</div>
                <div className="text-[11px] text-neutral-400">{lastSeenLabel(m.friendId)}</div>
              </div>
              {m.status === "pending" ? (
                <span className="flex items-center gap-1 text-[11px] text-amber-400 font-semibold shrink-0">
                  <Clock size={12} />
                  ממתין לאישור
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] text-green-400 font-semibold shrink-0">
                  <Check size={12} />
                  בקבוצה
                </span>
              )}
              <button
                onClick={() => removeMemberFromGroup(group.id, m.friendId)}
                className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 active:scale-95 transition"
                title="הסרה מהקבוצה"
              >
                <UserMinus size={14} className="text-red-400" />
              </button>
            </div>
          );
        })}
      </div>

      {addMode && (
        <div className="mb-5">
          <h3 className="text-sm font-bold text-neutral-100 mb-2">הוספת חברים</h3>
          <div className="space-y-2">
            {addable.length === 0 && <div className="text-xs text-neutral-500 text-center py-3">כל החברים כבר בקבוצה</div>}
            {addable.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  addMembersToGroup(group.id, [f.id]);
                  setAddMode(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-bg-panel2 border border-bg-border active:scale-95 transition"
              >
                <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={36} className="border border-bg-border" />
                <span className="flex-1 text-right text-sm font-medium text-neutral-100">{f.name}</span>
                <Plus size={16} className="text-brand-light" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Mail size={15} className="text-brand-light" />
        <h3 className="text-sm font-bold text-neutral-100">ההודעה האחרונה</h3>
      </div>
      {!lastMessage ? (
        <div className="text-xs text-neutral-500 text-center py-3">עדיין לא נשלחה הודעת ווקי-טוקי לקבוצה</div>
      ) : (
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-neutral-400">נשלחה {timeAgo(lastMessage.sentAt)}</div>
            {lastMessage.audioUrl && (
              <button
                onClick={() => lastMessage.audioUrl && playAudioUrl(lastMessage.audioUrl).catch(() => {})}
                className="flex items-center gap-1 text-[11px] font-semibold text-brand-light active:scale-95 transition"
              >
                <Play size={12} className="fill-current" />
                השמעה
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {lastMessage.receipts.map((r) => {
              const f = friendById(r.friendId);
              return (
                <div key={r.friendId} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-200">{f?.avatarEmoji} {f?.name}</span>
                  {r.deliveredAt ? (
                    <span className="flex items-center gap-1 text-green-400">
                      <Check size={12} />
                      התקבל {timeAgo(r.deliveredAt)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-neutral-500">
                      <Clock size={12} />
                      נשלח, ממתין
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
