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

function rowToConfig(row: AppConfigRow): AppConfig {
  return {
    minRequiredVersion: row.min_required_version,
    latestVersion: row.latest_version,
    updateMessage: row.update_message,
    serviceAreaEnabled: row.service_area_enabled,
    serviceAreaCityName: row.service_area_city_name,
    serviceAreaCenter: { lat: row.service_area_lat, lng: row.service_area_lng },
    serviceAreaRadiusKm: row.service_area_radius_km,
    serviceAreaMessage: row.service_area_message,
  };
}

// Module-level singleton: exactly one real fetch + one Realtime subscription
// for the whole app lifetime, no matter how many components call
// useAppConfig() (App.tsx, MapScreen, ReportFlow, ...). Supabase's
// `.channel(name)` returns the *same* channel object for a repeated name,
// and calling `.on()` on a channel that's already `.subscribe()`d throws -
// so multiple hook instances each opening "app-config-live" independently
// crashed with "cannot add postgres_changes callbacks ... after subscribe()".
// Every consumer now just registers as a listener on one shared subscription
// instead.
let sharedConfig: AppConfig = EMPTY;
let subscribed = false;
const listeners = new Set<(config: AppConfig) => void>();

function notifyAll(config: AppConfig) {
  sharedConfig = config;
  listeners.forEach((l) => l(config));
}

function ensureSubscribed() {
  if (subscribed || !isBackendConfigured || !supabase) return;
  subscribed = true;
  const apply = (row: AppConfigRow | null) => {
    if (row) notifyAll(rowToConfig(row));
  };
  supabase
    .from("app_config")
    .select("*")
    .maybeSingle()
    .then(({ data }) => apply(data as AppConfigRow | null));
  supabase
    .channel("app-config-live")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "app_config" }, (payload) => apply(payload.new as AppConfigRow))
    .subscribe();
}

/** Admin-controlled remote config (version gating, service-area geofence) - see admin/ dashboard. Safe to call from any number of components. */
export function useAppConfig(): AppConfig {
  const [config, setConfig] = useState<AppConfig>(sharedConfig);

  useEffect(() => {
    ensureSubscribed();
    listeners.add(setConfig);
    setConfig(sharedConfig); // pick up a value that may have arrived between module load and this mount
    return () => {
      listeners.delete(setConfig);
    };
  }, []);

  return config;
}
