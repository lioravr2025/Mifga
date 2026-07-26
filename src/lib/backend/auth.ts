import { supabase } from "../supabaseClient";
import { profileFromRow, type ProfileRow } from "./types";
import type { UserProfile } from "../../types";

/**
 * Anonymous auth: creates a real Supabase auth.users row + session with no
 * email/password/SMS - the right fit for a small side-loaded beta group.
 * Trade-off (documented in README): there's no password recovery, so
 * uninstalling the app or clearing site data loses that identity. Fine for
 * beta testing; phone-OTP (needs an SMS provider configured in Supabase) is
 * the natural upgrade path before a wider release.
 */
export async function ensureSession(): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session) return existing.session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.session) throw error ?? new Error("Anonymous sign-in failed");
  return data.session.user.id;
}

export async function fetchOwnProfile(uid: string): Promise<UserProfile | null> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data as ProfileRow) : null;
}

export async function isUsernameTakenRemote(username: string, excludeUid?: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase not configured");
  let query = supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("username", username);
  if (excludeUid) query = query.neq("id", excludeUid);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}
