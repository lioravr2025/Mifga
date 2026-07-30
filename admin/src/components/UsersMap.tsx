import { useState } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import type { ProfileRow, HazardRow, PrizeRow } from "../lib/types";
import { Card } from "./Card";
import { Map as MapIcon, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_LABELS, hazardMapIcon } from "../lib/hazardTypes";
import { prizeMapIcon } from "../lib/prizeIcon";

const TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ISRAEL_CENTER: [number, number] = [31.5, 34.9];

function isRecentlyActive(lastActiveAt: string | null) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60_000;
}

function RemoveHazardButton({ id, onRemoved }: { id: string; onRemoved?: () => void }) {
  const [state, setState] = useState<"idle" | "removing" | "error">("idle");

  const remove = async () => {
    setState("removing");
    const { error } = await supabase.rpc("admin_remove_hazard", { p_hazard_id: id });
    if (error) {
      setState("error");
      return;
    }
    onRemoved?.();
  };

  return (
    <button
      onClick={remove}
      disabled={state === "removing"}
      style={{
        marginTop: 8,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(220,38,38,0.12)",
        border: "1px solid rgba(220,38,38,0.4)",
        color: "#dc2626",
        fontWeight: 700,
        fontSize: 12,
        cursor: state === "removing" ? "default" : "pointer",
      }}
    >
      {state === "removing" ? "מסיר..." : state === "error" ? "שגיאה - נסו שוב" : "הסרת מפגע"}
    </button>
  );
}

function RemovePrizeButton({ id, onRemoved }: { id: string; onRemoved?: () => void }) {
  const [state, setState] = useState<"idle" | "removing" | "error">("idle");

  const remove = async () => {
    setState("removing");
    const { error } = await supabase.rpc("admin_remove_prize", { p_prize_id: id });
    if (error) {
      setState("error");
      return;
    }
    onRemoved?.();
  };

  return (
    <button
      onClick={remove}
      disabled={state === "removing"}
      style={{
        marginTop: 8,
        width: "100%",
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(220,38,38,0.12)",
        border: "1px solid rgba(220,38,38,0.4)",
        color: "#dc2626",
        fontWeight: 700,
        fontSize: 12,
        cursor: state === "removing" ? "default" : "pointer",
      }}
    >
      {state === "removing" ? "מסיר..." : state === "error" ? "שגיאה - נסו שוב" : "הסרת פרס"}
    </button>
  );
}

export default function UsersMap({
  profiles,
  hazards,
  prizes = [],
  onHazardRemoved,
}: {
  profiles: ProfileRow[];
  hazards: HazardRow[];
  prizes?: PrizeRow[];
  onHazardRemoved?: () => void;
}) {
  const located = profiles.filter((p) => p.live_lat != null && p.live_lng != null);

  return (
    <Card
      title="מפת משתמשים ומפגעים"
      icon={<MapIcon size={16} className="text-brand-light" />}
      action={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-400">
            מספר מפגעים כעת: <span className="text-neutral-200 font-semibold">{hazards.length}</span>
          </span>
          <span className="text-[11px] text-neutral-400">
            פרסים פעילים: <span className="text-neutral-200 font-semibold">{prizes.length}</span>
          </span>
          <button
            onClick={() => onHazardRemoved?.()}
            className="w-6 h-6 rounded-lg bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition"
            title="רענון"
          >
            <RefreshCw size={11} className="text-neutral-400" />
          </button>
        </div>
      }
    >
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
            <Marker key={h.id} position={[h.lat, h.lng]} icon={hazardMapIcon(h.type)}>
              <Popup>
                <div style={{ direction: "rtl", minWidth: 140 }}>
                  <strong>{HAZARD_TYPE_LABELS[h.type] ?? h.type}</strong> - {h.reporter_name}
                  <br />+{h.confirmations} / -{h.denials}
                  <RemoveHazardButton id={h.id} onRemoved={onHazardRemoved} />
                </div>
              </Popup>
            </Marker>
          ))}
          {prizes.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={prizeMapIcon(p.icon, p.icon_image_url)}>
              <Popup>
                <div style={{ direction: "rtl", minWidth: 140 }}>
                  <strong>פרס · {p.points} נק'</strong>
                  <RemovePrizeButton id={p.id} onRemoved={onHazardRemoved} />
                </div>
              </Popup>
            </Marker>
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
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500" />
          פרס
        </span>
      </div>
    </Card>
  );
}
