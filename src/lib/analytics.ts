import { supabase } from "./supabaseClient";

let currentUserId: string | null = null;

export function setAnalyticsUser(uid: string | null) {
  currentUserId = uid;
}

/** Fire-and-forget usage tracking for the admin dashboard's "most-used buttons" panel. Never throws. */
export function trackClick(element: string, screen?: string) {
  if (!supabase) return;
  supabase
    .from("ui_click_events")
    .insert({ user_id: currentUserId, element, screen })
    .then(({ error }) => {
      if (error) console.error("Mifga: trackClick failed", error);
    });
}
