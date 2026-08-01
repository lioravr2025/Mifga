// Scheduled (via pg_cron, once daily) - finds meetups happening today and
// pushes a reminder to everyone who both RSVP'd "going" AND has push
// enabled (has a stored token at all - that's the closest server-side
// signal available, since the granular per-category notification
// preference currently only lives in the app's local device storage, never
// synced to the backend). Not reachable by a normal client call: gated by a
// shared secret only the cron job knows, so this can't be abused to mass-
// notify every rider on demand.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getFcmAccessToken, getServiceAccount, sendFcmMessage } from "../_shared/fcm.ts";

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

    const account = getServiceAccount();
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
