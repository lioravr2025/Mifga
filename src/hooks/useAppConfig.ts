import { useEffect, useState } from "react";
import { isBackendConfigured, supabase } from "../lib/supabaseClient";

interface AppConfig {
  minRequiredVersion: string | null;
  latestVersion: string | null;
  updateMessage: string | null;
}

const EMPTY: AppConfig = { minRequiredVersion: null, latestVersion: null, updateMessage: null };

/** Admin-controlled remote config (version gating, etc.) - see admin/ dashboard's VersionConfigPanel. */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(EMPTY);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) return;
    const apply = (row: { min_required_version: string | null; latest_version: string | null; update_message: string | null } | null) => {
      if (!row) return;
      setConfig({ minRequiredVersion: row.min_required_version, latestVersion: row.latest_version, updateMessage: row.update_message });
    };
    supabase.from("app_config").select("*").maybeSingle().then(({ data }) => apply(data));
    const channel = supabase
      .channel("app-config-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_config" }, (payload) => apply(payload.new as never))
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  return config;
}
