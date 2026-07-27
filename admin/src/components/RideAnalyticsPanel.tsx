import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Gauge, Clock, MapPinned } from "lucide-react";
import type { ProfileRow, RideLogRow } from "../lib/types";
import { pathDistanceMeters } from "../lib/geo";
import { Card } from "./Card";

const VEHICLE_LABELS: Record<string, string> = { scooter: "קורקינט", ebike: "אופניים חשמליים", emotorcycle: "אופנוע חשמלי" };

export default function RideAnalyticsPanel({ rides, profiles }: { rides: RideLogRow[]; profiles: ProfileRow[] }) {
  const vehicleFor = (uid: string) => profiles.find((p) => p.id === uid)?.vehicle_type;

  const speedByVehicle = useMemo(() => {
    const sums: Record<string, { totalKmh: number; count: number }> = {};
    for (const r of rides) {
      const path = r.path ?? [];
      if (path.length < 2) continue;
      const hours = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 3_600_000;
      if (hours <= 0) continue;
      const km = pathDistanceMeters(path) / 1000;
      const kmh = km / hours;
      if (!isFinite(kmh) || kmh <= 0 || kmh > 80) continue; // discard bad GPS outliers
      const vt = vehicleFor(r.user_id) ?? "unknown";
      sums[vt] ??= { totalKmh: 0, count: 0 };
      sums[vt].totalKmh += kmh;
      sums[vt].count += 1;
    }
    return Object.entries(sums).map(([vt, s]) => ({ vehicle: VEHICLE_LABELS[vt] ?? vt, avgKmh: Math.round((s.totalKmh / s.count) * 10) / 10, rides: s.count }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rides, profiles]);

  const hourHistogram = useMemo(() => {
    const counts = new Array(24).fill(0);
    for (const r of rides) counts[new Date(r.started_at).getHours()]++;
    return counts.map((count, hour) => ({ hour: `${hour}:00`, count }));
  }, [rides]);

  const popularAreas = useMemo(() => {
    const clusters: Record<string, number> = {};
    for (const r of rides) {
      const start = r.path?.[0];
      if (!start) continue;
      const key = `${start.lat.toFixed(2)},${start.lng.toFixed(2)}`;
      clusters[key] = (clusters[key] ?? 0) + 1;
    }
    return Object.entries(clusters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [rides]);

  return (
    <>
      <Card title="מהירות ממוצעת לפי כלי" icon={<Gauge size={16} className="text-brand-light" />}>
        {speedByVehicle.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">אין עדיין מספיק נתוני מסלול</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {speedByVehicle.map((v) => (
              <div key={v.vehicle} className="rounded-xl bg-bg-panel border border-bg-border p-3 text-center">
                <div className="text-lg font-extrabold text-neutral-50 tabular-nums">{v.avgKmh}</div>
                <div className="text-[10px] text-neutral-500">קמ"ש · {v.vehicle}</div>
                <div className="text-[9px] text-neutral-600 mt-0.5">{v.rides} נסיעות</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="שעות רכיבה נפוצות" icon={<Clock size={16} className="text-brand-light" />}>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourHistogram}>
              <CartesianGrid strokeDasharray="3 3" stroke="#243250" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#131c2e", border: "1px solid #243250", fontSize: 12 }} labelStyle={{ color: "#e2e8f0" }} />
              <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="אזורי יציאה פופולריים" icon={<MapPinned size={16} className="text-brand-light" />}>
        <p className="text-[10px] text-neutral-500 mb-2">מבוסס על קיבוץ קואורדינטות (לא שמות רחוב מדויקים)</p>
        {popularAreas.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">אין עדיין מספיק נתונים</p>
        ) : (
          <div className="space-y-1.5">
            {popularAreas.map(([coords, count]) => (
              <div key={coords} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-bg-panel border border-bg-border text-xs">
                <span className="text-neutral-300" dir="ltr">
                  {coords}
                </span>
                <span className="text-brand-light font-semibold">{count} נסיעות</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
