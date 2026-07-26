import { supabase } from "../supabaseClient";
import { profileFromRow, type ProfileRow } from "./types";
import type { UserProfile } from "../../types";

interface NewProfileInput {
  id: string;
  name: string;
  username: string;
  phone?: string;
  vehicleType?: string | null;
  vehicleModel?: string | null;
  avatarPhoto?: string | null;
}

export async function insertProfile(input: NewProfileInput): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: input.id,
      name: input.name,
      username: input.username,
      phone: input.phone ?? null,
      vehicle_type: input.vehicleType ?? null,
      vehicle_model: input.vehicleModel ?? null,
      avatar_photo_url: input.avatarPhoto ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return profileFromRow(data as ProfileRow);
}

export interface ProfilePatch {
  name?: string;
  avatarPhoto?: string | null;
  vehicleType?: string | null;
  vehicleModel?: string | null;
  phone?: string | null;
  username?: string | null;
}

export async function updateProfileRemote(uid: string, patch: ProfilePatch): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.avatarPhoto !== undefined) row.avatar_photo_url = patch.avatarPhoto;
  if (patch.vehicleType !== undefined) row.vehicle_type = patch.vehicleType;
  if (patch.vehicleModel !== undefined) row.vehicle_model = patch.vehicleModel;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.username !== undefined) row.username = patch.username;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from("profiles").update(row).eq("id", uid);
  if (error) throw error;
}

export async function awardPointsRemote(uid: string, pointsDelta: number, withPhoto: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("award_report_points", { p_uid: uid, p_points: pointsDelta, p_with_photo: withPhoto });
  if (error) throw error;
}
