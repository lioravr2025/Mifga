import { supabase } from "../supabaseClient";
import type { FriendshipRow, ProfileRow } from "./types";
import type { Friend, IncomingFriendRequest } from "../../types";

const ONLINE_WINDOW_MS = 2 * 60_000;

export interface ProfileSearchResult {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string;
  avatarPhoto?: string;
  points: number;
}

export async function searchProfiles(query: string, excludeUid: string): Promise<ProfileSearchResult[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, avatar_photo_url, points")
    .ilike("username", `%${trimmed}%`)
    .neq("id", excludeUid)
    .limit(20);
  if (error) throw error;
  return (data as Pick<ProfileRow, "id" | "name" | "username" | "avatar_emoji" | "avatar_photo_url" | "points">[]).map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    avatarEmoji: r.avatar_emoji,
    avatarPhoto: r.avatar_photo_url ?? undefined,
    points: r.points,
  }));
}

/** Sends a friend request; if the target already sent *me* one, accepts theirs instead of creating a duplicate. */
export async function sendFriendRequest(myUid: string, targetUid: string): Promise<"requested" | "accepted"> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: reverse, error: rErr } = await supabase
    .from("friendships")
    .select("id")
    .eq("requester_id", targetUid)
    .eq("addressee_id", myUid)
    .eq("status", "pending")
    .maybeSingle();
  if (rErr) throw rErr;
  if (reverse) {
    await respondFriendRequestRemote(reverse.id, true);
    return "accepted";
  }

  const { error } = await supabase.from("friendships").insert({ requester_id: myUid, addressee_id: targetUid });
  if (error) {
    if (error.code === "23505") return "requested"; // already connected/pending - treat as a no-op success
    throw error;
  }
  return "requested";
}

export async function respondFriendRequestRemote(friendshipId: string, accept: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("respond_friend_request", { p_friendship_id: friendshipId, p_accept: accept });
  if (error) throw error;
}

export async function toggleFriendFavoriteRemote(friendshipId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("toggle_friend_favorite", { p_friendship_id: friendshipId });
  if (error) throw error;
}

export async function fetchFriends(uid: string): Promise<Friend[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rows, error } = await supabase
    .from("friendships")
    .select("*")
    .eq("status", "accepted")
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  if (error) throw error;
  const friendships = rows as FriendshipRow[];
  if (friendships.length === 0) return [];

  const otherIds = friendships.map((f) => (f.requester_id === uid ? f.addressee_id : f.requester_id));
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").in("id", otherIds);
  if (pErr) throw pErr;
  const profileById = new Map((profiles as ProfileRow[]).map((p) => [p.id, p]));
  const now = Date.now();

  return friendships.map((f) => {
    const otherId = f.requester_id === uid ? f.addressee_id : f.requester_id;
    const p = profileById.get(otherId);
    const favorite = f.requester_id === uid ? f.favorite_by_requester : f.favorite_by_addressee;
    const lastActive = p?.last_active_at ? new Date(p.last_active_at).getTime() : 0;
    const hasLivePosition = p?.live_lat != null && p?.live_lng != null;
    return {
      id: otherId,
      name: p?.name ?? "",
      username: p?.username ?? "",
      avatarEmoji: p?.avatar_emoji ?? "🙂",
      avatarPhoto: p?.avatar_photo_url ?? undefined,
      online: now - lastActive < ONLINE_WINDOW_MS,
      points: p?.points ?? 0,
      position: hasLivePosition ? { lat: p!.live_lat as number, lng: p!.live_lng as number } : { lat: 0, lng: 0 },
      shareLocation: hasLivePosition,
      allowWalkie: true,
      lastSeenAt: lastActive,
      favorite,
      friendshipId: f.id,
      instagram: p?.instagram ?? undefined,
      tiktok: p?.tiktok ?? undefined,
    };
  });
}

export async function fetchIncomingFriendRequests(uid: string): Promise<IncomingFriendRequest[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rows, error } = await supabase.from("friendships").select("*").eq("addressee_id", uid).eq("status", "pending");
  if (error) throw error;
  const friendships = rows as FriendshipRow[];
  if (friendships.length === 0) return [];

  const ids = friendships.map((f) => f.requester_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, name, username, avatar_emoji, avatar_photo_url")
    .in("id", ids);
  if (pErr) throw pErr;
  const byId = new Map(
    (profiles as Pick<ProfileRow, "id" | "name" | "username" | "avatar_emoji" | "avatar_photo_url">[]).map((p) => [p.id, p])
  );

  return friendships.map((f) => {
    const p = byId.get(f.requester_id);
    return {
      friendshipId: f.id,
      fromUid: f.requester_id,
      fromName: p?.name ?? "",
      fromUsername: p?.username ?? "",
      fromAvatarEmoji: p?.avatar_emoji ?? "🙂",
      fromAvatarPhoto: p?.avatar_photo_url ?? undefined,
      createdAt: new Date(f.created_at).getTime(),
    };
  });
}

/** Any change to a friendship I'm party to - re-fetching the two lists above on each event is simplest and plenty fast at beta scale. */
export function subscribeFriendships(myUid: string, onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("friendships-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, (payload) => {
      const row = (payload.new ?? payload.old) as FriendshipRow;
      if (row.requester_id === myUid || row.addressee_id === myUid) onChange();
    })
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** Pushes this device's live position + activity timestamp - RLS already allows updating your own profile row. */
export async function updatePresence(uid: string, lat: number, lng: number): Promise<void> {
  if (!supabase) return;
  await supabase.from("profiles").update({ live_lat: lat, live_lng: lng, last_active_at: new Date().toISOString() }).eq("id", uid);
}

/** Marks/clears "on a ride right now" for the admin dashboard's live count - set on ride start, cleared on stop. */
export async function setRidingStatus(uid: string, riding: boolean): Promise<void> {
  if (!supabase) return;
  await supabase.from("profiles").update({ riding_since: riding ? new Date().toISOString() : null }).eq("id", uid);
}
