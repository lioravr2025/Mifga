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

/**
 * Re-attaches an old account's entire history (points, reports, friendships,
 * groups, ride log...) onto the current anonymous session, verified by phone
 * + the 6-digit code the rider picked for themselves at signup. See recover_account() in
 * supabase/schema_admin.sql for why this is a data-ownership transfer rather
 * than true re-authentication as the same Supabase identity (no SMS-OTP
 * provider configured, and a service-role key can't safely live in this
 * client). Throws with a message meant to be shown directly to the user.
 */
export async function recoverAccount(phone: string, code: string): Promise<UserProfile | null> {
  if (!supabase) throw new Error("Supabase not configured");
  const uid = await ensureSession();
  const { error } = await supabase.rpc("recover_account", { p_phone: phone, p_code: code });
  if (error) throw error;
  return fetchOwnProfile(uid);
}

/** "Forgot my recovery code" fallback - visible to the admin dashboard's SupportTicketsPanel. */
export async function submitSupportTicket(phone: string | null, message: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("support_tickets").insert({ phone, message });
  if (error) throw error;
}

export async function isUsernameTakenRemote(username: string, excludeUid?: string): Promise<boolean> {
  if (!supabase) throw new Error("Supabase not configured");
  let query = supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("username", username);
  if (excludeUid) query = query.neq("id", excludeUid);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}
