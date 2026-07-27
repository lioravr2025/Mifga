import { supabase } from "./supabaseClient";

let currentUserId: string | null = null;

/** Called once the signed-in user's id is known, so later crash reports can be tied to an account. */
export function setErrorLogUser(uid: string | null) {
  currentUserId = uid;
}

/** Fire-and-forget: logs to the console always, and to Supabase when configured. Never throws - a broken error logger must not itself crash the app. */
export function logClientError(message: string, extra?: { stack?: string; context?: Record<string, unknown> }) {
  console.error("Mifga error:", message, extra);
  if (!supabase) return;
  supabase
    .from("client_error_logs")
    .insert({
      user_id: currentUserId,
      message: message.slice(0, 2000),
      stack: extra?.stack?.slice(0, 4000) ?? null,
      context: extra?.context ?? null,
      app_version: __APP_VERSION__,
      platform: navigator.userAgent,
    })
    .then(({ error }) => {
      if (error) console.error("Mifga: failed to log error remotely", error);
    });
}

/** Catches errors that never reach a React error boundary - a syntax error in an event handler, a rejected promise nobody awaited. */
export function installGlobalErrorLogging() {
  window.addEventListener("error", (event) => {
    logClientError(event.message, {
      stack: event.error?.stack,
      context: { source: event.filename, line: event.lineno, col: event.colno },
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    logClientError(message, {
      stack: reason instanceof Error ? reason.stack : undefined,
      context: { type: "unhandledrejection" },
    });
  });
}
