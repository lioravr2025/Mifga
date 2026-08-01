// Scheduled (via pg_cron, once daily) - finds meetups happening today and
// pushes a reminder to everyone who both RSVP'd "going" AND has push
// enabled (has a stored token at all - that's the closest server-side
// signal available, since the granular per-category notification
// preference currently only lives in the app's local device storage, never
// synced to the backend). Not reachable by a normal client call: gated by a
// shared secret only the cron job knows, so this can't be abused to mass-
// notify every rider on demand.
//
// Self-contained on purpose (not importing shared/fcm.ts) so this file can
// be pasted directly into the Supabase Dashboard's Edge Function editor
// without needing the CLI's multi-file bundling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function base64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const raw = typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  let str = "";
  raw.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function signJwt(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const pem = account.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(signature)}`;
}

async function getFcmAccessToken(account: ServiceAccount): Promise<string> {
  const jwt = await signJwt(account);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`FCM auth failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

async function sendFcmMessage(projectId: string, accessToken: string, token: string, title: string, body: string) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body }, android: { priority: "high" } } }),
  });
  const invalid = res.status === 404 || res.status === 400;
  return { token, ok: res.ok, status: res.status, invalid };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60_000);

    const { data: meetups, error: meetupsErr } = await supabase
      .from("meetups")
      .select("id, title, location_text")
      .eq("removed", false)
      .gte("starts_at", startOfToday.toISOString())
      .lt("starts_at", startOfTomorrow.toISOString());
    if (meetupsErr) throw meetupsErr;
    if (!meetups || meetups.length === 0) {
      return new Response(JSON.stringify({ meetups: 0, sent: 0 }), { status: 200 });
    }

    const account: ServiceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
    const accessToken = await getFcmAccessToken(account);
    let totalSent = 0;
    const deadTokens: string[] = [];

    for (const meetup of meetups) {
      const { data: rsvps, error: rsvpErr } = await supabase.from("meetup_rsvps").select("user_id").eq("meetup_id", meetup.id);
      if (rsvpErr) throw rsvpErr;
      const attendeeIds = (rsvps ?? []).map((r) => r.user_id as string);
      if (attendeeIds.length === 0) continue;

      const { data: tokenRows, error: tokenErr } = await supabase.from("push_tokens").select("token").in("user_id", attendeeIds);
      if (tokenErr) throw tokenErr;
      if (!tokenRows || tokenRows.length === 0) continue;

      const title = "המפגש שלך היום!";
      const body = `${meetup.title} מתקיים היום ב${meetup.location_text} - לא תפספסו`;
      const results = await Promise.all(tokenRows.map((r) => sendFcmMessage(account.project_id, accessToken, r.token, title, body)));
      totalSent += results.filter((r) => r.ok).length;
      results.filter((r) => r.invalid).forEach((r) => deadTokens.push(r.token));
    }

    if (deadTokens.length > 0) await supabase.from("push_tokens").delete().in("token", deadTokens);

    return new Response(JSON.stringify({ meetups: meetups.length, sent: totalSent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("meetup-reminders failed", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
