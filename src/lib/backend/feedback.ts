import { supabase } from "../supabaseClient";

export async function insertFeedbackRemote(uid: string, liked: boolean, note: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("feedback").insert({ user_id: uid, liked, note: note.trim() });
  if (error) throw error;
}
