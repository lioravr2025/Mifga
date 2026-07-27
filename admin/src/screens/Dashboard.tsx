import { useEffect, useState } from "react";
import { LogOut, RefreshCw, ShieldCheck, Users, Zap, Route as RouteIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import type { FeedbackRow, HazardRow, ProfileRow, RideLogRow } from "../lib/types";
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

function isRecentlyActive(lastActiveAt: string | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60_000;
}

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
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
  }, []);

  const activeCount = profiles.filter((p) => isRecentlyActive(p.last_active_at)).length;
  const ridingCount = profiles.filter((p) => p.riding_since).length;

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

      <main className="max-w-5xl mx-auto px-5 py-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="חשבונות שנרשמו" value={profiles.length} icon={<Users size={17} className="text-brand-light" />} />
          <StatCard label="פעילים כרגע (5 דק')" value={activeCount} icon={<Zap size={17} className="text-sky-400" />} accent="#38bdf8" />
          <StatCard label="בנסיעה כרגע" value={ridingCount} icon={<RouteIcon size={17} className="text-green-400" />} accent="#22c55e" />
          <StatCard label="דיווחי מפגעים" value={hazards.length} icon={<ShieldCheck size={17} className="text-amber-400" />} accent="#f59e0b" />
        </div>

        <UsersMap profiles={profiles} hazards={hazards} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HazardsPanel hazards={hazards} />
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
      </main>
    </div>
  );
}
