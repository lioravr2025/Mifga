import { supabase } from "../supabaseClient";
import { uploadDataUrl } from "./storage";
import type { MeetupRow, ProfileRow } from "./types";
import type { Meetup, LatLng } from "../../types";

function meetupFromRow(row: MeetupRow, host: ProfileRow | undefined, attendeeCount: number, isAttending: boolean): Meetup {
  return {
    id: row.id,
    hostId: row.host_id,
    hostName: host?.name ?? "",
    hostAvatarEmoji: host?.avatar_emoji ?? "🙂",
    hostAvatarPhoto: host?.avatar_photo_url ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    locationText: row.location_text,
    position: row.lat != null && row.lng != null ? { lat: row.lat, lng: row.lng } : undefined,
    coverPhotoUrl: row.cover_photo_url ?? undefined,
    startsAt: new Date(row.starts_at).getTime(),
    endsAt: row.ends_at ? new Date(row.ends_at).getTime() : undefined,
    privacy: row.privacy as "public" | "private",
    capacity: row.capacity ?? undefined,
    attendeeCount,
    isAttending,
    createdAt: new Date(row.created_at).getTime(),
  };
}

/** Fetches every meetup visible to `uid` (RLS already scopes private ones to the host + existing RSVPs) along with attendee counts and whether `uid` itself is going. */
export async function fetchMeetups(uid: string): Promise<Meetup[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rows, error } = await supabase.from("meetups").select("*").eq("removed", false).order("starts_at", { ascending: true });
  if (error) throw error;
  const meetups = rows as MeetupRow[];
  if (meetups.length === 0) return [];

  const hostIds = [...new Set(meetups.map((m) => m.host_id))];
  const meetupIds = meetups.map((m) => m.id);
  const [{ data: hosts, error: hErr }, { data: rsvps, error: rErr }] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_emoji, avatar_photo_url").in("id", hostIds),
    supabase.from("meetup_rsvps").select("meetup_id, user_id").in("meetup_id", meetupIds),
  ]);
  if (hErr) throw hErr;
  if (rErr) throw rErr;

  const hostById = new Map((hosts as ProfileRow[]).map((h) => [h.id, h]));
  const rsvpRows = rsvps as { meetup_id: string; user_id: string }[];
  const countByMeetup = new Map<string, number>();
  const attendingSet = new Set<string>();
  for (const r of rsvpRows) {
    countByMeetup.set(r.meetup_id, (countByMeetup.get(r.meetup_id) ?? 0) + 1);
    if (r.user_id === uid) attendingSet.add(r.meetup_id);
  }

  return meetups.map((m) => meetupFromRow(m, hostById.get(m.host_id), countByMeetup.get(m.id) ?? 0, attendingSet.has(m.id)));
}

export interface MeetupAttendee {
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
}

export async function fetchMeetupAttendees(meetupId: string): Promise<MeetupAttendee[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rsvps, error } = await supabase.from("meetup_rsvps").select("user_id").eq("meetup_id", meetupId);
  if (error) throw error;
  const ids = (rsvps as { user_id: string }[]).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*").in("id", ids);
  if (pErr) throw pErr;
  return (profiles as ProfileRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    username: p.username,
    avatarEmoji: p.avatar_emoji,
    avatarPhoto: p.avatar_photo_url ?? undefined,
    points: p.points,
    vehicleType: p.vehicle_type ?? undefined,
    vehicleModel: p.vehicle_model ?? undefined,
    instagram: p.instagram ?? undefined,
    tiktok: p.tiktok ?? undefined,
  }));
}

export interface NewMeetupInput {
  hostId: string;
  title: string;
  description?: string;
  locationText: string;
  position?: LatLng;
  coverPhotoDataUrl?: string;
  startsAt: number;
  endsAt?: number;
  privacy: "public" | "private";
  capacity?: number;
}

export async function createMeetup(input: NewMeetupInput): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const coverUrl = input.coverPhotoDataUrl ? await uploadDataUrl("meetup-covers", input.hostId, input.coverPhotoDataUrl) : null;
  const { error } = await supabase.from("meetups").insert({
    host_id: input.hostId,
    title: input.title,
    description: input.description ?? null,
    location_text: input.locationText,
    lat: input.position?.lat ?? null,
    lng: input.position?.lng ?? null,
    cover_photo_url: coverUrl,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
    privacy: input.privacy,
    capacity: input.capacity ?? null,
  });
  if (error) throw error;
}

export async function deleteMeetupRemote(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("meetups").delete().eq("id", id);
  if (error) throw error;
}

export async function rsvpToMeetup(meetupId: string, uid: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("meetup_rsvps").insert({ meetup_id: meetupId, user_id: uid });
  if (error && error.code !== "23505") throw error; // 23505 = already RSVP'd, treat as a no-op success
}

export async function cancelMeetupRsvp(meetupId: string, uid: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("meetup_rsvps").delete().eq("meetup_id", meetupId).eq("user_id", uid);
  if (error) throw error;
}

export async function incrementMeetupViews(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("increment_meetup_views", { p_meetup_id: id });
  if (error) throw error;
}
