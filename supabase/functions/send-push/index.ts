// Direct push send, called straight from the app right after an event that
// deserves a nudge (friend request received, group invite received, etc.) -
// no queueing, just "send this now to these users". Requires a valid user
// JWT (supabase-js attaches this automatically), same as any other RPC-style
// call from the client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFcmAccessToken, getServiceAccount, sendFcmMessage } from "../_shared/fcm.ts";

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

    const account = getServiceAccount();
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
