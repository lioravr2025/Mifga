import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { ProfileRow, HazardRow } from "../lib/types";
import { Card } from "./Card";
import { Map as MapIcon } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_LABELS } from "../lib/hazardTypes";

const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ISRAEL_CENTER: [number, number] = [31.5, 34.9];

function isRecentlyActive(lastActiveAt: string | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60_000;
}

export default function UsersMap({ profiles, hazards, onHazardRemoved }: { profiles: ProfileRow[]; hazards: HazardRow[]; onHazardRemoved?: () => void }) {
  const located = profiles.filter((p) => p.live_lat != null && p.live_lng != null);

  const removeHazard = async (id: string) => {
    const { error } = await supabase.rpc("admin_remove_hazard", { p_hazard_id: id });
    if (!error) onHazardRemoved?.();
  };

  return (
    <Card title="מפת משתמשים ומפגעים" icon={<MapIcon size={16} className="text-brand-light" />}>
      <div className="h-[420px] rounded-xl overflow-hidden border border-bg-border">
        <MapContainer center={ISRAEL_CENTER} zoom={8} className="w-full h-full">
          <TileLayer url={TILES} />
          {located.map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.live_lat!, p.live_lng!]}
              radius={6}
              pathOptions={{
                color: p.riding_since ? "#22c55e" : isRecentlyActive(p.last_active_at) ? "#38bdf8" : "#64748b",
                fillColor: p.riding_since ? "#22c55e" : isRecentlyActive(p.last_active_at) ? "#38bdf8" : "#64748b",
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div style={{ direction: "rtl" }}>
                  <strong>{p.name}</strong> (@{p.username})
                  <br />
                  {p.riding_since ? "בנסיעה כעת" : isRecentlyActive(p.last_active_at) ? "פעיל עכשיו" : "לא פעיל"}
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {hazards.map((h) => (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lng]}
              radius={5}
              pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.6, weight: 1 }}
            >
              <Popup>
                <div style={{ direction: "rtl" }}>
                  {HAZARD_TYPE_LABELS[h.type] ?? h.type} - {h.reporter_name}
                  <br />+{h.confirmations} / -{h.denials}
                  <br />
                  <button
                    onClick={() => removeHazard(h.id)}
                    style={{ marginTop: 6, color: "#dc2626", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                  >
                    הסרת מפגע
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 text-[11px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          בנסיעה
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          פעיל
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          לא פעיל
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          מפגע
        </span>
      </div>
    </Card>
  );
}
