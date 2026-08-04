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
  if (existing.session) {
    // getSession() returns whatever's in storage without checking whether
    // the access token has actually expired - Supabase's silent auto-refresh
    // only runs via a timer while the app is alive, so a session that sat in
    // storage while the app was fully killed for a while (e.g. reopened from
    // a push notification tap after being swiped away) can come back with an
    // already-expired token. Used as-is, the very next authenticated request
    // (fetchOwnProfile below) 401s and throws, which left onboardingComplete
    // stuck at its default false - showing the registration screen for an
    // already-registered rider. Refresh proactively whenever it's expired or
    // about to be.
    const expiresAt = existing.session.expires_at;
    const isStale = expiresAt != null && expiresAt * 1000 < Date.now() + 60_000;
    if (!isStale) return existing.session.user.id;
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) return refreshed.session.user.id;
    // Refresh token itself is dead (revoked/too old) - fall through to a
    // fresh anonymous sign-in rather than getting stuck either way.
  }

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
  // profiles_public, not profiles - checking another rider's username can't
  // depend on being able to read their full row (see schema_v8.sql).
  let query = supabase.from("profiles_public").select("id", { count: "exact", head: true }).ilike("username", username);
  if (excludeUid) query = query.neq("id", excludeUid);
  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Ends the current anonymous session - the profile row itself is untouched, so "logging back in" later is exactly the existing phone+code recovery flow. */
export async function signOutSession(): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Self-service account deletion (delete_own_profile is scoped to auth.uid() server-side - can never target anyone else). */
export async function deleteOwnProfile(): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("delete_own_profile");
  if (error) throw error;
}
