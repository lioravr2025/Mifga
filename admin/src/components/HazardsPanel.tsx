import { useEffect, useState } from "react";
import { AlertTriangle, Gift, ThumbsDown, ThumbsUp, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_LABELS } from "../lib/hazardTypes";
import type { HazardRow, PrizeRow } from "../lib/types";
import { Card } from "./Card";

// Groups by rounded coordinate (~1.1km buckets) so a cluster in the same
// area shares one Nominatim lookup instead of one per row - same tradeoff
// RideAnalyticsPanel's "popular areas" makes, and for the same reason
// (Nominatim's free tier is ~1 request/sec).
function bucketKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function useCityLookup(points: { lat: number; lng: number }[]) {
  const [cityByBucket, setCityByBucket] = useState<Record<string, string>>({});
  const bucketsKey = [...new Set(points.map((p) => bucketKey(p.lat, p.lng)))].join(",");

  useEffect(() => {
    let cancelled = false;
    const buckets = [...new Set(points.map((p) => bucketKey(p.lat, p.lng)))];
    (async () => {
      for (const key of buckets) {
        if (cancelled || cityByBucket[key]) continue;
        const [lat, lng] = key.split(",").map(Number);
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`, {
            headers: { Accept: "application/json" },
          });
          const data = await res.json();
          const addr = data?.address ?? {};
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || "אזור לא מזוהה";
          if (!cancelled) setCityByBucket((prev) => ({ ...prev, [key]: city }));
        } catch {
          // offline/rate-limited - that row's city column just stays blank
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucketsKey]);

  return (lat: number, lng: number) => cityByBucket[bucketKey(lat, lng)] ?? null;
}

export default function HazardsPanel({
  hazards,
  prizes,
  onChanged,
}: {
  hazards: HazardRow[];
  prizes: PrizeRow[];
  onChanged?: () => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const cityFor = useCityLookup(hazards.map((h) => ({ lat: h.lat, lng: h.lng })));

  const [prizeBulkRunning, setPrizeBulkRunning] = useState(false);
  const [confirmingAllPrizes, setConfirmingAllPrizes] = useState(false);
  const [prizeCityFilter, setPrizeCityFilter] = useState<string | null>(null);
  const prizeCityFor = useCityLookup(prizes.map((p) => ({ lat: p.lat, lng: p.lng })));

  const byType = hazards.reduce<Record<string, number>>((acc, h) => {
    acc[h.type] = (acc[h.type] ?? 0) + 1;
    return acc;
  }, {});

  const availableCities = [...new Set(hazards.map((h) => cityFor(h.lat, h.lng)).filter((c): c is string => !!c))].sort();
  const filtered = cityFilter ? hazards.filter((h) => cityFor(h.lat, h.lng) === cityFilter) : hazards;
  const sorted = [...filtered].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 25);

  const availablePrizeCities = [...new Set(prizes.map((p) => prizeCityFor(p.lat, p.lng)).filter((c): c is string => !!c))].sort();
  const filteredPrizes = prizeCityFilter ? prizes.filter((p) => prizeCityFor(p.lat, p.lng) === prizeCityFilter) : prizes;

  const remove = async (id: string) => {
    setRemovingId(id);
    const { error } = await supabase.rpc("admin_remove_hazard", { p_hazard_id: id });
    setRemovingId(null);
    if (!error) onChanged?.();
  };

  const removeCity = async () => {
    if (!cityFilter) return;
    const ids = hazards.filter((h) => cityFor(h.lat, h.lng) === cityFilter).map((h) => h.id);
    if (ids.length === 0) return;
    setBulkRunning(true);
    const { error } = await supabase.rpc("admin_remove_hazards", { p_ids: ids });
    setBulkRunning(false);
    if (!error) {
      setCityFilter(null);
      onChanged?.();
    }
  };

  const removeAll = async () => {
    setBulkRunning(true);
    const { error } = await supabase.rpc("admin_remove_all_hazards");
    setBulkRunning(false);
    setConfirmingAll(false);
    if (!error) onChanged?.();
  };

  const removePrizeCity = async () => {
    if (!prizeCityFilter) return;
    const ids = prizes.filter((p) => prizeCityFor(p.lat, p.lng) === prizeCityFilter).map((p) => p.id);
    if (ids.length === 0) return;
    setPrizeBulkRunning(true);
    const { error } = await supabase.rpc("admin_remove_prizes", { p_ids: ids });
    setPrizeBulkRunning(false);
    if (!error) {
      setPrizeCityFilter(null);
      onChanged?.();
    }
  };

  const removeAllPrizes = async () => {
    setPrizeBulkRunning(true);
    const { error } = await supabase.rpc("admin_remove_all_prizes");
    setPrizeBulkRunning(false);
    setConfirmingAllPrizes(false);
    if (!error) onChanged?.();
  };

  return (
    <Card title={`דיווחי מפגעים (${hazards.length})`} icon={<AlertTriangle size={16} className="text-amber-400" />}>
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(byType)
          .sort((a, b) => b[1] - a[1])
          .map(([type, count]) => (
            <span key={type} className="px-2.5 py-1 rounded-full bg-bg-panel border border-bg-border text-[11px] text-neutral-300">
              {HAZARD_TYPE_LABELS[type] ?? type}: {count}
            </span>
          ))}
      </div>

      {availableCities.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <select
            value={cityFilter ?? ""}
            onChange={(e) => setCityFilter(e.target.value || null)}
            className="flex-1 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
          >
            <option value="">כל הערים</option>
            {availableCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {cityFilter && (
            <button
              onClick={removeCity}
              disabled={bulkRunning}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold active:scale-95 transition disabled:opacity-40"
            >
              <Trash2 size={12} />
              מחיקת כל {filtered.length} מ{cityFilter}
            </button>
          )}
        </div>
      )}

      <div className="space-y-1.5 max-h-72 overflow-y-auto mb-3">
        {sorted.map((h) => (
          <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs">
            <span className="flex-1 text-neutral-200 truncate">
              {HAZARD_TYPE_LABELS[h.type] ?? h.type} · {h.reporter_name}
              {cityFor(h.lat, h.lng) && <span className="text-neutral-500"> · {cityFor(h.lat, h.lng)}</span>}
            </span>
            <span className="flex items-center gap-1 text-green-400 shrink-0">
              <ThumbsUp size={11} />
              {h.confirmations}
            </span>
            <span className="flex items-center gap-1 text-red-400 shrink-0">
              <ThumbsDown size={11} />
              {h.denials}
            </span>
            <span className="text-neutral-500 shrink-0">{new Date(h.created_at).toLocaleDateString("he-IL")}</span>
            <button
              onClick={() => remove(h.id)}
              disabled={removingId === h.id}
              className="shrink-0 w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center active:scale-95 transition disabled:opacity-40"
              title="הסרת מפגע"
            >
              <X size={11} className="text-red-400" />
            </button>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-bg-border mb-4">
        <div className="text-[11px] text-neutral-500 mb-2">מפגעים</div>
        {!confirmingAll ? (
          <button
            onClick={() => setConfirmingAll(true)}
            disabled={hazards.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold active:scale-95 transition disabled:opacity-40"
          >
            <Trash2 size={12} />
            מחיקת כל המפגעים
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-300 font-semibold">בטוחים? זה ימחק את כל {hazards.length} המפגעים.</span>
            <button
              onClick={removeAll}
              disabled={bulkRunning}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold active:scale-95 transition disabled:opacity-40"
            >
              {bulkRunning ? "מוחק..." : "כן, מחיקה"}
            </button>
            <button
              onClick={() => setConfirmingAll(false)}
              disabled={bulkRunning}
              className="px-3 py-1.5 rounded-lg bg-bg-panel border border-bg-border text-neutral-300 text-xs font-semibold active:scale-95 transition"
            >
              ביטול
            </button>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-bg-border">
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mb-2">
          <Gift size={12} />
          פרסים ({prizes.length})
        </div>

        {availablePrizeCities.length > 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <select
              value={prizeCityFilter ?? ""}
              onChange={(e) => setPrizeCityFilter(e.target.value || null)}
              className="flex-1 px-3 py-2 rounded-xl bg-bg-panel border border-bg-border text-xs text-neutral-100 outline-none focus:border-brand"
            >
              <option value="">כל הערים</option>
              {availablePrizeCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {prizeCityFilter && (
              <button
                onClick={removePrizeCity}
                disabled={prizeBulkRunning}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold active:scale-95 transition disabled:opacity-40"
              >
                <Trash2 size={12} />
                מחיקת כל {filteredPrizes.length} מ{prizeCityFilter}
              </button>
            )}
          </div>
        )}

        {!confirmingAllPrizes ? (
          <button
            onClick={() => setConfirmingAllPrizes(true)}
            disabled={prizes.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs font-semibold active:scale-95 transition disabled:opacity-40"
          >
            <Trash2 size={12} />
            מחיקת כל הפרסים
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-300 font-semibold">בטוחים? זה ימחק את כל {prizes.length} הפרסים.</span>
            <button
              onClick={removeAllPrizes}
              disabled={prizeBulkRunning}
              className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold active:scale-95 transition disabled:opacity-40"
            >
              {prizeBulkRunning ? "מוחק..." : "כן, מחיקה"}
            </button>
            <button
              onClick={() => setConfirmingAllPrizes(false)}
              disabled={prizeBulkRunning}
              className="px-3 py-1.5 rounded-lg bg-bg-panel border border-bg-border text-neutral-300 text-xs font-semibold active:scale-95 transition"
            >
              ביטול
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
