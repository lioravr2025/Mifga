import { useState } from "react";
import { AlertTriangle, DollarSign, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { Card } from "./Card";

// Admin-adjustable "start worrying" line - purely a visual cue in this
// panel, doesn't touch the real Cloud Console Budget Alert (which is what
// actually emails you, and is the real safety net regardless of what this
// shows).
const WARN_AT_USD = 20;
const DANGER_AT_USD = 50;

interface ServiceUsage {
  label: string;
  requests: number;
  freeQuota: number;
  billableRequests: number;
  estimatedUsd: number;
}

interface UsageResponse {
  periodStart: string;
  asOf: string;
  services: ServiceUsage[];
  totalEstimatedUsd: number;
}

export default function GoogleMapsUsagePanel() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("google-maps-usage");
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      setData(result as UsageResponse);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("GOOGLE_MAPS_SERVICE_ACCOUNT")
          ? "לא הוגדר עדיין Service Account לפאנל הזה (ראו הערה למטה)."
          : "טעינת נתוני השימוש נכשלה - " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  };

  const severity = !data ? "ok" : data.totalEstimatedUsd >= DANGER_AT_USD ? "danger" : data.totalEstimatedUsd >= WARN_AT_USD ? "warn" : "ok";
  const severityColor = severity === "danger" ? "#ef4444" : severity === "warn" ? "#f59e0b" : "#22c55e";

  return (
    <Card
      title="עלויות Google Maps החודש (הערכה)"
      icon={<DollarSign size={16} className="text-brand-light" />}
      action={
        <button
          onClick={load}
          disabled={loading}
          className="w-8 h-8 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
          title="רענון"
        >
          <RefreshCw size={13} className={`text-neutral-300 ${loading ? "animate-spin" : ""}`} />
        </button>
      }
    >
      {!data && !loading && !error && (
        <div className="text-center py-4">
          <p className="text-xs text-neutral-500 mb-3">לוחצים רענון כדי לטעון נתוני שימוש חיים מ-Google Cloud.</p>
          <button onClick={load} className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold active:scale-95 transition">
            טען נתונים
          </button>
        </div>
      )}
      {loading && <p className="text-xs text-neutral-500 text-center py-4">טוען...</p>}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {data && (
        <div className="space-y-3">
          <div className="rounded-xl p-3.5 border" style={{ background: `${severityColor}15`, borderColor: `${severityColor}40` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-neutral-400">הערכת עלות בפועל מתחילת החודש</span>
              <span className="text-[10px] text-neutral-500">
                נכון ל-{new Date(data.asOf).toLocaleString("he-IL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="text-2xl font-extrabold tabular-nums" style={{ color: severityColor }}>
              ${data.totalEstimatedUsd.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-500 mt-1">
              {data.totalEstimatedUsd === 0
                ? "כל השירותים עדיין בתוך המכסה החינמית החודשית של Google - עדיין לא משלמים בפועל."
                : "כולל רק קריאות שכבר חרגו מהמכסה החינמית של כל שירות - זה מה שבאמת ייגבה."}
            </div>
          </div>

          <div className="space-y-1.5">
            {data.services.map((s) => {
              const pctOfQuota = Math.min(100, Math.round((s.requests / s.freeQuota) * 100));
              const overQuota = s.billableRequests > 0;
              return (
                <div key={s.label} className="px-3 py-2 rounded-lg bg-bg-panel border border-bg-border text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">{s.label}</span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="text-neutral-500">
                        {s.requests.toLocaleString("he-IL")} / {s.freeQuota.toLocaleString("he-IL")} חינם
                      </span>
                      <span className={`font-semibold ${overQuota ? "text-neutral-100" : "text-neutral-600"}`}>${s.estimatedUsd.toFixed(2)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pctOfQuota}%`, background: overQuota ? "#ef4444" : "#22c55e" }}
                    />
                  </div>
                  {overQuota && (
                    <div className="text-[10px] text-red-300">
                      חרג מהמכסה ב-{s.billableRequests.toLocaleString("he-IL")} קריאות - אלו אלו שנגבות בפועל.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-neutral-500 leading-relaxed">
            המכסה החינמית (10,000 קריאות/שירות בחודש, Essentials tier) והתעריפים לאחריה מבוססים על מחירון Google הידוע בזמן כתיבת הפאנל
            הזה - ולא על החיוב הרשמי. המספר הרשמי תמיד ב-Google Cloud Console → Billing. ה-Budget Alert שהוגדר שם הוא רשת הביטחון האמיתית,
            לא הפאנל הזה.
          </p>
        </div>
      )}
    </Card>
  );
}
