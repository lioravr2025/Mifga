// Live Google Maps Platform usage for the admin dashboard's cost-monitoring
// panel. Self-contained (not importing shared/fcm.ts) for the same reason
// send-push/index.ts is - pasteable directly into the Supabase Dashboard's
// Edge Function editor without the CLI's multi-file bundling.
//
// This can only ever be an ESTIMATE, not a real bill: Cloud Monitoring gives
// real request counts per API, but converting that to a dollar figure means
// hardcoding Google's per-1000-request rates ourselves (PRICING_USD_PER_1000
// below), and those rates vary by exact SKU/feature/region and change over
// time. The authoritative number is always Cloud Console > Billing - this
// panel exists so the admin doesn't have to go check that page constantly,
// not to replace it. The Budget Alert already configured in Cloud Console is
// still the real safety net if this estimate ever drifts from reality.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Called directly from the admin dashboard in a browser (unlike send-push,
// which is only ever called from the mobile app), so it needs explicit CORS
// headers or the browser blocks the response before supabase-js ever sees it.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function signJwt(account: ServiceAccount, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: account.client_email,
    scope,
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

/** Exchanges the service account's signed JWT for a short-lived (1h) OAuth2 access token scoped to read-only Cloud Monitoring data. */
async function getMonitoringAccessToken(account: ServiceAccount): Promise<string> {
  const jwt = await signJwt(account, "https://www.googleapis.com/auth/monitoring.read");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

// Which "consumed_api" services we care about, a rough $/1000-request rate
// for each, and the monthly free quota Google grants per SKU on the
// Essentials tier - sourced from the Cloud Billing SKU list at the time this
// was written (10,000 free calls/month for all three as of writing). Verify
// against https://developers.google.com/maps/billing-and-pricing/pricing
// before trusting this for anything beyond a rough heads-up: Places in
// particular bundles several sub-SKUs (Text Search, Nearby Search, Place
// Details, ...) at different real prices under one Cloud Monitoring metric,
// so usdPer1000 here is a blended approximation, not any single SKU's exact rate.
const TRACKED_SERVICES: { service: string; label: string; usdPer1000: number; freeQuota: number }[] = [
  { service: "maps-backend.googleapis.com", label: "Dynamic Maps (טעינות מפה)", usdPer1000: 7, freeQuota: 10000 },
  { service: "places-backend.googleapis.com", label: "Places (חיפוש/פרטי מקום)", usdPer1000: 17, freeQuota: 10000 },
  { service: "directions-backend.googleapis.com", label: "Directions (חישוב מסלול)", usdPer1000: 5, freeQuota: 10000 },
];

interface TimeSeriesPoint {
  resource?: { labels?: Record<string, string> };
  points?: { value?: { int64Value?: string } }[];
}

async function fetchServiceUsage(projectId: string, accessToken: string, service: string, startTime: string, endTime: string): Promise<number> {
  const filter = `metric.type="serviceruntime.googleapis.com/api/request_count" AND resource.type="consumed_api" AND resource.label.service="${service}"`;
  const params = new URLSearchParams({
    filter,
    "interval.startTime": startTime,
    "interval.endTime": endTime,
    "aggregation.alignmentPeriod": "2592000s", // one month - just sum the whole window into one point
    "aggregation.perSeriesAligner": "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
    view: "FULL",
  });
  const res = await fetch(`https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Monitoring API failed for ${service}: ${JSON.stringify(data)}`);
  const series = (data.timeSeries ?? []) as TimeSeriesPoint[];
  let total = 0;
  for (const ts of series) {
    for (const p of ts.points ?? []) {
      total += Number(p.value?.int64Value ?? 0);
    }
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Admin-only: verify the caller's own session (not the service role) is
    // a member of admin_users, the same gate every admin-only RPC uses.
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), { status: 401, headers: corsHeaders });
    const { data: adminRow } = await callerClient.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!adminRow) return new Response(JSON.stringify({ error: "NOT_ADMIN" }), { status: 403, headers: corsHeaders });

    const account: ServiceAccount = JSON.parse(Deno.env.get("GOOGLE_MAPS_SERVICE_ACCOUNT")!);
    const accessToken = await getMonitoringAccessToken(account);

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const periodEnd = now.toISOString();

    const services = await Promise.all(
      TRACKED_SERVICES.map(async (s) => {
        const requests = await fetchServiceUsage(account.project_id, accessToken, s.service, periodStart, periodEnd);
        // Only requests past the free monthly quota are ever actually billed.
        // listPriceUsd ignores the free quota entirely - "what this volume
        // would cost with no free tier at all" - kept alongside estimatedUsd
        // (the real, post-quota number) so the admin can see both: how close
        // they are to the quota mattering, and what's actually charged today.
        const billableRequests = Math.max(0, requests - s.freeQuota);
        return {
          label: s.label,
          requests,
          freeQuota: s.freeQuota,
          billableRequests,
          listPriceUsd: Math.round((requests / 1000) * s.usdPer1000 * 100) / 100,
          estimatedUsd: Math.round((billableRequests / 1000) * s.usdPer1000 * 100) / 100,
        };
      })
    );

    const totalEstimatedUsd = Math.round(services.reduce((sum, s) => sum + s.estimatedUsd, 0) * 100) / 100;
    const totalListPriceUsd = Math.round(services.reduce((sum, s) => sum + s.listPriceUsd, 0) * 100) / 100;

    return new Response(JSON.stringify({ periodStart, asOf: periodEnd, services, totalEstimatedUsd, totalListPriceUsd }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-maps-usage failed", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
