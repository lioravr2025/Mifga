import { useEffect, useState } from "react";
import { Instagram, MapPin, Music2, Route, Star, Trash2, Trophy, UserCheck, UserPlus, UserX, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { fetchFriendRideCount } from "../lib/backend/friends";
import { isBackendConfigured } from "../lib/supabaseClient";
import { VEHICLE_DEFS } from "./VehicleIcons";
import { formatDistance, distanceMeters } from "../lib/geo";
import { useGeolocation } from "../hooks/useGeolocation";
import type { LatLng } from "../types";

/** A looser shape than the full Friend type - lets this sheet show anyone's card (e.g. a meetup attendee who isn't a friend yet), not just existing friends. */
export interface ProfileCardData {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string;
  avatarPhoto?: string;
  points: number;
  vehicleType?: string;
  vehicleModel?: string;
  instagram?: string;
  tiktok?: string;
  online?: boolean;
  position?: LatLng;
  shareLocation?: boolean;
  favorite?: boolean;
  /** set only when this person is already an accepted friend - drives whether "add friend" or "remove friend" shows */
  friendshipId?: string;
}

export default function FriendProfileSheet({ friend, onClose }: { friend: ProfileCardData | null; onClose: () => void }) {
  const { removeFriend, toggleFavorite, addFriendByUid } = useApp();
  const { position } = useGeolocation();
  const [rideCount, setRideCount] = useState<number | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [addingFriend, setAddingFriend] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!friend) {
      setRideCount(null);
      setConfirmingRemove(false);
      setAdded(false);
      return;
    }
    if (!isBackendConfigured) return;
    fetchFriendRideCount(friend.id)
      .then(setRideCount)
      .catch((err) => console.error("Mifga: fetchFriendRideCount failed", err));
  }, [friend]);

  if (!friend) return null;

  const vehicleDef = VEHICLE_DEFS.find((v) => v.id === friend.vehicleType);
  const dist = friend.shareLocation && friend.position ? distanceMeters(position, friend.position) : null;
  const isFriend = !!friend.friendshipId;

  const remove = async () => {
    setRemoving(true);
    await removeFriend(friend.id);
    setRemoving(false);
    onClose();
  };

  const addFriend = async () => {
    setAddingFriend(true);
    try {
      await addFriendByUid(friend.id);
      setAdded(true);
    } catch (err) {
      console.error("Mifga: addFriendByUid failed", err);
    } finally {
      setAddingFriend(false);
    }
  };

  return (
    <BottomSheet open={!!friend} onClose={onClose} maxHeight="80%">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-neutral-50">פרופיל</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-col items-center mb-5">
        <span className="relative mb-3">
          {friend.avatarPhoto ? (
            <img src={friend.avatarPhoto} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-brand shadow-glow shadow-brand" />
          ) : (
            <span className="w-24 h-24 rounded-full bg-bg-panel2 border-2 border-brand flex items-center justify-center text-5xl shadow-glow shadow-brand">
              {friend.avatarEmoji}
            </span>
          )}
          {friend.online !== undefined && (
            <span
              className={`absolute bottom-1 left-1 w-4 h-4 rounded-full border-2 border-bg-panel ${friend.online ? "bg-green-500" : "bg-neutral-600"}`}
            />
          )}
        </span>
        <span className="text-lg font-bold text-neutral-50">{friend.name}</span>
        <span className="text-xs text-neutral-500" dir="ltr">
          @{friend.username}
        </span>

        {(friend.instagram || friend.tiktok) && (
          <div className="flex items-center gap-3 mt-2.5">
            {friend.instagram && (
              <a
                href={`https://instagram.com/${friend.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-neutral-300 active:text-brand-light"
              >
                <Instagram size={14} />@{friend.instagram}
              </a>
            )}
            {friend.tiktok && (
              <a
                href={`https://tiktok.com/@${friend.tiktok}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-neutral-300 active:text-brand-light"
              >
                <Music2 size={14} />@{friend.tiktok}
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-3 text-center">
          <Trophy size={16} className="text-brand-light mx-auto mb-1" />
          <div className="text-base font-extrabold text-neutral-50 tabular-nums">{friend.points}</div>
          <div className="text-[10px] text-neutral-500">נקודות</div>
        </div>
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-3 text-center">
          <Route size={16} className="text-brand-light mx-auto mb-1" />
          <div className="text-base font-extrabold text-neutral-50 tabular-nums">{rideCount ?? "-"}</div>
          <div className="text-[10px] text-neutral-500">נסיעות</div>
        </div>
        <div className="rounded-2xl bg-bg-panel2 border border-bg-border p-3 text-center">
          {vehicleDef ? <vehicleDef.Icon size={16} color="#a78bfa" /> : <MapPin size={16} className="text-brand-light mx-auto" />}
          <div className="text-[11px] font-bold text-neutral-50 mt-1 truncate">{vehicleDef?.label ?? "לא צוין"}</div>
          <div className="text-[10px] text-neutral-500 truncate">{friend.vehicleModel || "כלי"}</div>
        </div>
      </div>

      {dist != null && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-panel2 border border-bg-border mb-5 text-xs text-neutral-300">
          <MapPin size={14} className="text-brand-light shrink-0" />
          {formatDistance(dist)} ממך כרגע
        </div>
      )}

      {isFriend ? (
        <>
          <div className="flex gap-2.5 mb-3">
            <button
              onClick={() => toggleFavorite(friend.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl border text-sm font-semibold active:scale-95 transition ${
                friend.favorite ? "bg-amber-500/15 border-amber-500/40 text-amber-300" : "bg-bg-panel2 border-bg-border text-neutral-300"
              }`}
            >
              <Star size={15} className={friend.favorite ? "fill-amber-400" : ""} />
              {friend.favorite ? "מועדף" : "הוספה למועדפים"}
            </button>
          </div>

          {!confirmingRemove ? (
            <button
              onClick={() => setConfirmingRemove(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-300 text-sm font-semibold active:scale-95 transition"
            >
              <UserX size={15} />
              הסרת חבר
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-xs text-red-300 font-semibold">להסיר את {friend.name} מרשימת החברים?</span>
              <button
                onClick={remove}
                disabled={removing}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500 text-white text-xs font-bold active:scale-95 transition disabled:opacity-40"
              >
                <Trash2 size={13} />
                {removing ? "מסיר..." : "כן, הסרה"}
              </button>
              <button
                onClick={() => setConfirmingRemove(false)}
                disabled={removing}
                className="px-3 py-2.5 rounded-xl bg-bg-panel2 border border-bg-border text-neutral-300 text-xs font-semibold active:scale-95 transition"
              >
                ביטול
              </button>
            </div>
          )}
        </>
      ) : (
        <button
          onClick={addFriend}
          disabled={addingFriend || added}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-brand text-white text-sm font-semibold active:scale-95 transition disabled:opacity-60"
        >
          {added ? <UserCheck size={15} /> : <UserPlus size={15} />}
          {added ? "בקשת חברות נשלחה" : addingFriend ? "שולח..." : "הוספת חבר"}
        </button>
      )}
    </BottomSheet>
  );
}
