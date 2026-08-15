import { useEffect, useState } from "react";
import { isBackendConfigured, supabase } from "../lib/supabaseClient";
import type { LatLng } from "../types";

interface AppConfig {
  minRequiredVersion: string | null;
  latestVersion: string | null;
  updateMessage: string | null;
  /** Pilot-launch geofence - see admin dashboard's ServiceAreaPanel. Editable/removable live, no app release needed. */
  serviceAreaEnabled: boolean;
  serviceAreaCityName: string;
  serviceAreaCenter: LatLng;
  serviceAreaRadiusKm: number;
  serviceAreaMessage: string;
}

// serviceAreaEnabled defaults to false here on purpose: local/demo mode
// (no backend configured) should never restrict reporting, only a real
// remote-configured pilot should.
const EMPTY: AppConfig = {
  minRequiredVersion: null,
  latestVersion: null,
  updateMessage: null,
  serviceAreaEnabled: false,
  serviceAreaCityName: "",
  serviceAreaCenter: { lat: 0, lng: 0 },
  serviceAreaRadiusKm: 0,
  serviceAreaMessage: "",
};

interface AppConfigRow {
  min_required_version: string | null;
  latest_version: string | null;
  update_message: string | null;
  service_area_enabled: boolean;
  service_area_city_name: string;
  service_area_lat: number;
  service_area_lng: number;
  service_area_radius_km: number;
  service_area_message: string;
}

/** Admin-controlled remote config (version gating, service-area geofence) - see admin/ dashboard. */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(EMPTY);

  useEffect(() => {
    if (!isBackendConfigured || !supabase) return;
    const apply = (row: AppConfigRow | null) => {
      if (!row) return;
      setConfig({
        minRequiredVersion: row.min_required_version,
        latestVersion: row.latest_version,
        updateMessage: row.update_message,
        serviceAreaEnabled: row.service_area_enabled,
        serviceAreaCityName: row.service_area_city_name,
        serviceAreaCenter: { lat: row.service_area_lat, lng: row.service_area_lng },
        serviceAreaRadiusKm: row.service_area_radius_km,
        serviceAreaMessage: row.service_area_message,
      });
    };
    supabase.from("app_config").select("*").maybeSingle().then(({ data }) => apply(data as AppConfigRow | null));
    const channel = supabase
      .channel("app-config-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_config" }, (payload) => apply(payload.new as AppConfigRow))
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, []);

  return config;
}
