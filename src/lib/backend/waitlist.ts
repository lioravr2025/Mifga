import { supabase } from "../supabaseClient";

/** "Notify me" signup for riders outside the current pilot service area - phone+city only, city is what tells the admin where to open next. */
export async function submitWaitlistSignup(phone: string, city: string, source: string = "app_out_of_area"): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("waitlist_signups").insert({ phone, city, source });
  if (error) throw error;
}
