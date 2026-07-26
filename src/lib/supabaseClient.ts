import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * True once a real backend is configured (VITE_SUPABASE_URL/ANON_KEY set -
 * see .env.example and DEPLOYMENT.md). When false, AppContext falls back to
 * the original localStorage-only demo mode so `npm run dev` keeps working
 * with zero setup.
 */
export const isBackendConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isBackendConfigured ? createClient(url as string, anonKey as string) : null;
