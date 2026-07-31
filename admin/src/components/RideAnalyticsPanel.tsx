import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { Gauge, Clock, MapPinned } from "lucide-react";
import type { ProfileRow, RideLogRow } from "../lib/types";
import { pathDistanceMeters } from "../lib/geo";
import { Card } from "./Card";

const VEHICLE_LABELS: Record<string, string> = { scooter: "קורקינט", ebike: "אופניים חשמליים", emotorcycle: "אופנוע חשמלי" };
const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ISRAEL_CENTER: [number, number] = [31.5, 34.9];

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 13, { duration: 0.7 });
  }, [target, map]);
  return null;
}

export default function RideAnalyticsPanel({ rides, profiles }: { rides: RideLogRow[]; profiles: ProfileRow[] }) {
  const vehicleFor = (uid: string) => profiles.find((p) => p.id === uid)?.vehicle_type;

  const speedByVehicle = useMemo(() => {
    const sums: Record<string, { totalKmh: number; count: number }> = {};
    for (const r of rides) {
      // Prefer the speed computed client-side from real GPS deltas during the
      // ride (schema_v4+) - only reconstruct it from the path/duration for
      // older rows that predate that column.
      let kmh: number;
      if (r.avg_speed_kmh != null) {
        kmh = r.avg_speed_kmh;
      } else {
        const path = r.path ?? [];
        if (path.length < 2) continue;
        const hours = (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 3_600_000;
        if (hours <= 0) continue;
        const km = pathDistanceMeters(path) / 1000;
        kmh = km / hours;
      }
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
    const clusters: Record<string, { lat: number; lng: number; count: number }> = {};
    for (const r of rides) {
      const start = r.path?.[0];
      if (!start) continue;
      const key = `${start.lat.toFixed(2)},${start.lng.toFixed(2)}`;
      clusters[key] ??= { lat: start.lat, lng: start.lng, count: 0 };
      clusters[key].count += 1;
    }
    return Object.entries(clusters)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [rides]);

  const areasKey = popularAreas.map((a) => a.key).join(",");
  const [cityNames, setCityNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<[number, number] | null>(null);

  // Nominatim's fair-use policy caps free usage at ~1 request/sec, so these are
  // looked up one at a time with a small delay rather than in parallel - fine
  // here since it's a handful of clusters, not a per-render live lookup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const area of popularAreas) {
        if (cancelled || cityNames[area.key]) continue;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${area.lat}&lon=${area.lng}&zoom=12&addressdetails=1`,
            { headers: { Accept: "application/json" } }
          );
          const data = await res.json();
          const addr = data?.address ?? {};
          const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.county || "אזור לא מזוהה";
          if (!cancelled) setCityNames((prev) => ({ ...prev, [area.key]: city }));
        } catch {
          // offline or rate-limited - the row just falls back to raw coordinates below
        }
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areasKey]);

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
        {popularAreas.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">אין עדיין מספיק נתונים</p>
        ) : (
          <>
            <div className="space-y-1.5 mb-3">
              {popularAreas.map((area) => (
                <button
                  key={area.key}
                  onClick={() => setSelected([area.lat, area.lng])}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition ${
                    selected && selected[0] === area.lat && selected[1] === area.lng
                      ? "bg-brand/15 border-brand/50"
                      : "bg-bg-panel border-bg-border active:bg-bg-panel2"
                  }`}
                >
                  <span className="text-neutral-200 font-medium">{cityNames[area.key] ?? "מאתר עיר..."}</span>
                  <span className="text-brand-light font-semibold">{area.count} נסיעות</span>
                </button>
              ))}
            </div>
            <div className="h-64 rounded-xl overflow-hidden border border-bg-border">
              <MapContainer center={ISRAEL_CENTER} zoom={7} className="w-full h-full">
                <TileLayer url={TILES} />
                <FlyTo target={selected} />
                {popularAreas.map((area) => (
                  <CircleMarker
                    key={area.key}
                    center={[area.lat, area.lng]}
                    radius={6 + Math.min(area.count, 10)}
                    pathOptions={{ color: "#7c3aed", fillColor: "#7c3aed", fillOpacity: 0.35, weight: 2 }}
                    eventHandlers={{ click: () => setSelected([area.lat, area.lng]) }}
                  >
                    <Popup>
                      <div style={{ direction: "rtl" }}>
                        <strong>{cityNames[area.key] ?? "אזור"}</strong>
                        <br />
                        {area.count} נסיעות יצאו מכאן
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
