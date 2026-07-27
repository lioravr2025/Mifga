import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

export type AdminAuthStatus = "loading" | "signed-out" | "not-admin" | "admin";

export function useAdminAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AdminAuthStatus>("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setStatus((prev) => (prev === "loading" ? "signed-out" : prev === "admin" || prev === "not-admin" ? "signed-out" : prev));
      return;
    }
    let cancelled = false;
    setStatus("loading");
    supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setStatus(data ? "admin" : "not-admin");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email: string, password: string) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();

  return { session, status, signIn, signUp, signOut };
}
