import { supabase } from "../supabaseClient";
import { hazardFromRow, type HazardRow } from "./types";
import type { HazardReport, HazardTypeId, LatLng } from "../../types";

export async function fetchHazards(): Promise<HazardReport[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("hazards").select("*").eq("removed", false).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as HazardRow[]).map(hazardFromRow);
}

interface NewHazardInput {
  type: HazardTypeId;
  position: LatLng;
  reporterId: string;
  reporterName: string;
  photoDataUrl?: string;
  nickname?: string;
}

export async function insertHazard(input: NewHazardInput): Promise<HazardReport> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("hazards")
    .insert({
      type: input.type,
      lat: input.position.lat,
      lng: input.position.lng,
      reporter_id: input.reporterId,
      reporter_name: input.reporterName,
      has_photo: !!input.photoDataUrl,
      photo_url: input.photoDataUrl ?? null,
      nickname: input.nickname?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return hazardFromRow(data as HazardRow);
}

export async function confirmHazardRemote(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("confirm_hazard", { p_hazard_id: id });
  if (error) throw error;
}

export async function denyHazardRemote(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("deny_hazard", { p_hazard_id: id });
  if (error) throw error;
}

/** Live updates for every insert/update on the hazards table - lets every connected tester see reports and votes as they happen. */
export function subscribeHazards(onChange: (hazard: HazardReport) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("hazards-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "hazards" }, (payload) => {
      onChange(hazardFromRow(payload.new as HazardRow));
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hazards" }, (payload) => {
      onChange(hazardFromRow(payload.new as HazardRow));
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
