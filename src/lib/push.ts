import { PushNotifications } from "@capacitor/push-notifications";
import { isNative } from "./nativeMic";
import { supabase } from "./supabaseClient";
import { logClientError } from "./errorLogger";

/**
 * Registers this device for push (requests OS permission if not yet
 * decided, gets an FCM token, upserts it against the rider's own account) -
 * no-op on web/dev, since Web Push would need its own separate setup and
 * this app is native-first. Safe to call every app start: registering again
 * with an unchanged token is just a harmless upsert.
 *
 * Every branch below also reports through logClientError (-> client_error_logs)
 * on top of console.error, since a rider's device console isn't reachable
 * without a USB debug session - this is how registration failures get
 * diagnosed remotely from the Supabase Table Editor instead.
 */
export async function registerPush(uid: string): Promise<void> {
  if (!isNative() || !supabase) return;
  logClientError("push: registerPush started", { context: { uid } });
  try {
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt") {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== "granted") {
      logClientError("push: permission not granted", { context: { uid, receive: status.receive } });
      return;
    }

    await PushNotifications.addListener("registration", async (token) => {
      logClientError("push: got FCM token, saving", { context: { uid, tokenPrefix: token.value.slice(0, 12) } });
      const { error } = await supabase!
        .from("push_tokens")
        .upsert({ user_id: uid, token: token.value, platform: "android", updated_at: new Date().toISOString() }, { onConflict: "user_id,token" });
      if (error) {
        console.error("Mifga: saving push token failed", error);
        logClientError("push: saving token failed", { context: { uid, error: JSON.stringify(error) } });
      } else {
        logClientError("push: token saved OK", { context: { uid } });
      }
    });
    PushNotifications.addListener("registrationError", (err) => {
      console.error("Mifga: push registration failed", err);
      logClientError("push: registrationError event", { context: { uid, error: JSON.stringify(err) } });
    });

    await PushNotifications.register();
  } catch (err) {
    console.error("Mifga: registerPush failed", err);
    logClientError("push: registerPush threw", { stack: err instanceof Error ? err.stack : undefined, context: { uid, error: String(err) } });
  }
}

/**
 * Best-effort cleanup on logout so a signed-out session doesn't keep
 * receiving pushes for an account it no longer represents. The plugin only
 * ever hands back a token via the registration event, not a getter, so this
 * clears every token row tied to the account rather than just this one
 * device - on a shared/borrowed device that's exactly what you want, and on
 * a personal one it's a no-op cost since the next app open just re-registers.
 */
export async function unregisterPush(uid: string): Promise<void> {
  if (!isNative() || !supabase) return;
  try {
    await supabase.from("push_tokens").delete().eq("user_id", uid);
  } catch (err) {
    console.error("Mifga: unregisterPush failed", err);
  }
}

/**
 * Fire-and-forget push send via the send-push Edge Function - not gated on
 * isNative() (unlike register/unregister above), since this just makes an
 * HTTP call and the recipient's own device is what matters, not the
 * sender's. Best-effort: a failure here never blocks the action that
 * triggered it (the friend request/invite itself already succeeded).
 */
export async function sendPushToUsers(userIds: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
  if (!supabase || userIds.length === 0) return;
  try {
    await supabase.functions.invoke("send-push", { body: { userIds, title, body, data } });
  } catch (err) {
    console.error("Mifga: sendPushToUsers failed", err);
  }
}
