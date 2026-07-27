import { createClient } from "@supabase/supabase-js";

// Same project as the mobile app. This is the public anon/publishable key -
// safe to ship in a client bundle (same convention as .github/workflows/android-build.yml
// and the mobile app's .env.example) - real access control is Postgres RLS
// (is_admin() checks), not keeping this value hidden.
const SUPABASE_URL = "https://tmmyimiubfnpkujulqll.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2yytuXb8y5nQGCZqd5bquQ_t-ZEY7j7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
