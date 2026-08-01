import { supabase } from "../supabaseClient";
import { hazardFromRow, type HazardRow } from "./types";
import { uploadDataUrl } from "./storage";
import { isValidIsraelLandPoint } from "../israelBounds";
import type { HazardReport, HazardTypeId, LatLng } from "../../types";

export async function fetchHazards(): Promise<HazardReport[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("hazards").select("*").eq("removed", false).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as HazardRow[]).map(hazardFromRow);
}

/** Full report history for one reporter, including removed/expired ones - for the profile screen's own "my reports" view (fetchHazards() above deliberately excludes those, since it's for the live map). */
export async function fetchMyReports(uid: string): Promise<HazardReport[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("hazards").select("*").eq("reporter_id", uid).order("created_at", { ascending: false });
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
  // A real rider's own GPS position is essentially never going to fail this
  // (they're standing somewhere real), but it's a cheap guard against GPS
  // glitches/spoofing placing a report in the sea or outside the country -
  // checked before the photo upload so a bad position doesn't waste it.
  if (!isValidIsraelLandPoint(input.position)) {
    throw new Error("המיקום שדווח אינו בשטח ישראל");
  }
  const photoUrl = input.photoDataUrl ? await uploadDataUrl("hazard-photos", input.reporterId, input.photoDataUrl) : null;
  const { data, error } = await supabase
    .from("hazards")
    .insert({
      type: input.type,
      lat: input.position.lat,
      lng: input.position.lng,
      reporter_id: input.reporterId,
      reporter_name: input.reporterName,
      has_photo: !!input.photoDataUrl,
      photo_url: photoUrl,
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
