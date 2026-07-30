import { useEffect, useMemo, useState } from "react";
import { LogOut, RefreshCw, ShieldCheck, Users, Zap, Route as RouteIcon, LayoutGrid, Shuffle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { FeedbackRow, HazardRow, ProfileRow, RideLogRow } from "../lib/types";
import { isHazardExpired } from "../lib/hazardTypes";
import { StatCard } from "../components/Card";
import UsersMap from "../components/UsersMap";
import HazardsPanel from "../components/HazardsPanel";
import FeedbackPanel from "../components/FeedbackPanel";
import RideAnalyticsPanel from "../components/RideAnalyticsPanel";
import ClickAnalyticsPanel from "../components/ClickAnalyticsPanel";
import ErrorLogsPanel from "../components/ErrorLogsPanel";
import SupportTicketsPanel from "../components/SupportTicketsPanel";
import BroadcastPanel from "../components/BroadcastPanel";
import VersionConfigPanel from "../components/VersionConfigPanel";
import SeedPanel from "../components/SeedPanel";

function isRecentlyActive(lastActiveAt: string | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60_000;
}

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<"overview" | "seed">("overview");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [hazards, setHazards] = useState<HazardRow[]>([]);
  const [rides, setRides] = useState<RideLogRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [profilesRes, hazardsRes, ridesRes, feedbackRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("hazards").select("*").order("created_at", { ascending: false }),
      supabase.from("ride_log").select("*").order("started_at", { ascending: false }).limit(500),
      supabase.from("feedback").select("*"),
    ]);
    setProfiles((profilesRes.data as ProfileRow[]) ?? []);
    setHazards((hazardsRes.data as HazardRow[]) ?? []);
    setRides((ridesRes.data as RideLogRow[]) ?? []);
    setFeedback((feedbackRes.data as FeedbackRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();

    // Live updates for the map + counts: profiles ping every ~25s while the app
    // is open (position/riding state), so a debounce collapses bursts from many
    // riders into one refetch instead of hammering the DB per row change.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(loadAll, 1500);
    };
    const channel = supabase
      .channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "hazards" }, scheduleReload)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  // Re-evaluate every 30s so a police/inspector hazard actually drops off once
  // its 20-minute silent window elapses, not only on the next unrelated refetch.
  const [expiryTick, setExpiryTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setExpiryTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  const visibleHazards = useMemo(() => hazards.filter((h) => !h.removed && !isHazardExpired(h)), [hazards, expiryTick]);

  const activeCount = profiles.filter((p) => isRecentlyActive(p.last_active_at)).length;
  // riding_since alone isn't enough - if a ride is abandoned (app killed/crashed,
  // uninstalled) without ever calling stopRide(), it stays set forever. Requiring
  // a recent presence heartbeat too means a stale flag stops counting once the
  // app stops actively pinging, without needing the DB to know a ride "ended".
  const ridingCount = profiles.filter((p) => p.riding_since && isRecentlyActive(p.last_active_at)).length;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-bg-border px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-brand-light" />
          <h1 className="text-base font-bold text-neutral-50">ניהול Mifga</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-bg-panel2 border border-bg-border flex items-center justify-center active:scale-95 transition"
            title="רענון"
          >
            <RefreshCw size={15} className={`text-neutral-300 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onSignOut}
            className="w-9 h-9 rounded-xl bg-bg-panel2 border border-bg-border flex items-center justify-center active:scale-95 transition"
            title="התנתקות"
          >
            <LogOut size={15} className="text-neutral-300" />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 pt-4 flex gap-2">
        <button
          onClick={() => setTab("overview")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition ${
            tab === "overview" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
          }`}
        >
          <LayoutGrid size={14} />
          סקירה
        </button>
        <button
          onClick={() => setTab("seed")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition ${
            tab === "seed" ? "bg-brand/15 border-brand text-brand-light" : "bg-bg-panel2 border-bg-border text-neutral-400"
          }`}
        >
          <Shuffle size={14} />
          פיזור
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-5 py-5 space-y-4">
        {tab === "overview" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="חשבונות שנרשמו" value={profiles.length} icon={<Users size={17} className="text-brand-light" />} />
              <StatCard label="פעילים כרגע (5 דק')" value={activeCount} icon={<Zap size={17} className="text-sky-400" />} accent="#38bdf8" />
              <StatCard label="בנסיעה כרגע" value={ridingCount} icon={<RouteIcon size={17} className="text-green-400" />} accent="#22c55e" />
              <StatCard label="דיווחי מפגעים" value={visibleHazards.length} icon={<ShieldCheck size={17} className="text-amber-400" />} accent="#f59e0b" />
            </div>

            <UsersMap profiles={profiles} hazards={visibleHazards} onHazardRemoved={loadAll} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <HazardsPanel hazards={visibleHazards} onChanged={loadAll} />
              <FeedbackPanel feedback={feedback} profiles={profiles} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <RideAnalyticsPanel rides={rides} profiles={profiles} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ClickAnalyticsPanel />
              <ErrorLogsPanel />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SupportTicketsPanel />
              <VersionConfigPanel />
            </div>

            <BroadcastPanel />
          </>
        ) : (
          <SeedPanel />
        )}
      </main>
    </div>
  );
}
