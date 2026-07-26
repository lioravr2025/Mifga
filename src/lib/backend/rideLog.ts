import { supabase } from "../supabaseClient";
import { rideLogFromRow, type RideLogRow } from "./types";
import type { RideLogEntry } from "../../types";

export async function fetchRideLog(uid: string): Promise<RideLogEntry[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("ride_log")
    .select("*")
    .eq("user_id", uid)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data as RideLogRow[]).map(rideLogFromRow);
}

export async function insertRideLogEntry(uid: string, entry: Omit<RideLogEntry, "id">): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("ride_log").insert({
    user_id: uid,
    started_at: new Date(entry.startedAt).toISOString(),
    ended_at: new Date(entry.endedAt).toISOString(),
    hazards_avoided: entry.hazardsAvoided,
    path: entry.path ?? [],
  });
  if (error) throw error;
}
