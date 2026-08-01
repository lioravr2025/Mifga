// Shared FCM HTTP v1 sending logic, used by both send-push and
// meetup-reminders. FCM's legacy server-key API is deprecated - v1 requires
// a proper OAuth2 access token minted from the service account's private
// key, which is what getAccessToken() below does by hand-signing a JWT with
// Deno's built-in Web Crypto (no external JWT library needed for this one
// grant type).

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

/** Exchanges the service account's signed JWT for a short-lived (1h) OAuth2 access token scoped to FCM send. */
export async function getFcmAccessToken(account: ServiceAccount): Promise<string> {
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

export interface SendResult {
  token: string;
  ok: boolean;
  status: number;
  /** true when FCM says this token is dead (app uninstalled, etc.) - caller should delete it. */
  invalid: boolean;
}

export async function sendFcmMessage(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<SendResult> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: data ?? {},
        android: { priority: "high" },
      },
    }),
  });
  // FCM returns 404/400 with an UNREGISTERED error for tokens from an
  // uninstalled app or a stale registration - worth cleaning those up rather
  // than retrying them forever.
  const invalid = res.status === 404 || res.status === 400;
  return { token, ok: res.ok, status: res.status, invalid };
}

export function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT secret not set");
  return JSON.parse(raw);
}
