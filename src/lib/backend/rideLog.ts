import { supabase } from "../supabaseClient";
import { rideLogFromRow, type RideLogRow } from "./types";
import type { RideLogEntry } from "../../types";

export async function fetchRideLog(uid: string): Promise<RideLogEntry[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("ride_log")
    .select("*")
    .eq("user_id", uid)
    .eq("hidden_from_user", false)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as RideLogRow[]).map(rideLogFromRow);
}

/** "Deletes" a ride from the rider's own view only - the row (and its data for analytics) stays in the database, just flagged hidden. */
export async function hideRideLogEntryRemote(uid: string, entryId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("ride_log").update({ hidden_from_user: true }).eq("id", entryId).eq("user_id", uid);
  if (error) throw error;
}

export async function insertRideLogEntry(uid: string, entry: Omit<RideLogEntry, "id">): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("ride_log").insert({
    user_id: uid,
    started_at: new Date(entry.startedAt).toISOString(),
    ended_at: new Date(entry.endedAt).toISOString(),
    hazards_avoided: entry.hazardsAvoided,
    path: entry.path ?? [],
    avg_speed_kmh: entry.avgSpeedKmh ?? null,
    max_speed_kmh: entry.maxSpeedKmh ?? null,
  });
  if (error) throw error;
}
