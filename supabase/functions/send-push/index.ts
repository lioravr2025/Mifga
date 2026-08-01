// Direct push send, called straight from the app right after an event that
// deserves a nudge (friend request received, group invite received, etc.) -
// no queueing, just "send this now to these users". Requires a valid user
// JWT (supabase-js attaches this automatically), same as any other RPC-style
// call from the client.
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

/** Exchanges the service account's signed JWT for a short-lived (1h) OAuth2 access token scoped to FCM send - FCM's v1 API has no simpler "server key" option anymore. */
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

async function sendFcmMessage(projectId: string, accessToken: string, token: string, title: string, body: string, data?: Record<string, string>) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: data ?? {}, android: { priority: "high" } } }),
  });
  // FCM returns 404/400 for tokens from an uninstalled app or a stale
  // registration - worth cleaning those up rather than retrying forever.
  const invalid = res.status === 404 || res.status === 400;
  return { token, ok: res.ok, status: res.status, invalid };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  try {
    const { userIds, title, body, data } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0 || typeof title !== "string" || typeof body !== "string") {
      return new Response(JSON.stringify({ error: "userIds (array), title, body required" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: tokenRows, error } = await supabase.from("push_tokens").select("token").in("user_id", userIds);
    if (error) throw error;
    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
    }

    const account: ServiceAccount = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!);
    const accessToken = await getFcmAccessToken(account);
    const results = await Promise.all(tokenRows.map((r) => sendFcmMessage(account.project_id, accessToken, r.token, title, body, data)));

    const deadTokens = results.filter((r) => r.invalid).map((r) => r.token);
    if (deadTokens.length > 0) await supabase.from("push_tokens").delete().in("token", deadTokens);

    return new Response(JSON.stringify({ sent: results.filter((r) => r.ok).length, total: tokenRows.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push failed", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
