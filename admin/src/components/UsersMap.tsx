import { useState } from "react";
import { AdvancedMarker, InfoWindow, Map } from "@vis.gl/react-google-maps";
import type { ProfileRow, HazardRow, PrizeRow } from "../lib/types";
import { Card } from "./Card";
import { Map as MapIcon, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { HAZARD_TYPE_LABELS, HazardMarkerGlyph } from "../lib/hazardTypes";
import { PrizeMarkerGlyph } from "../lib/prizeIcon";

// Same Map ID the mobile app uses (VITE_GOOGLE_MAPS_MAP_ID) - required for
// AdvancedMarker/vector rendering; without it the map still works but shows
// Google's "for development purposes only" watermark.
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
const ISRAEL_CENTER = { lat: 31.5, lng: 34.9 };

type Selected = { kind: "user" | "hazard" | "prize"; id: string } | null;

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
  const [selected, setSelected] = useState<Selected>(null);

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
        {/* No renderingType/colorScheme here on purpose: forcing "VECTOR"
            requires WebGL, and when it's unavailable (older GPU drivers,
            hardware acceleration off, some VM/remote-desktop setups) Google
            shows a "degraded map" warning dialog instead of just falling back
            - confirmed via the dialog's own DOM class, CizjDb-degraded-map-dialog-view.
            Advanced Markers work fine in raster mode too, so just pass mapId
            (required for them) and let Google pick whichever mode the
            browser actually supports. */}
        <Map mapId={MAP_ID} defaultCenter={ISRAEL_CENTER} defaultZoom={8} className="w-full h-full">
          {located.map((p) => {
            const color = p.riding_since ? "#22c55e" : isRecentlyActive(p.last_active_at) ? "#38bdf8" : "#64748b";
            return (
              <AdvancedMarker key={p.id} position={{ lat: p.live_lat!, lng: p.live_lng! }} onClick={() => setSelected({ kind: "user", id: p.id })}>
                <div style={{ width: 12, height: 12, borderRadius: "9999px", background: color, border: "2px solid white", boxShadow: "0 0 4px -1px rgba(0,0,0,0.6)" }} />
              </AdvancedMarker>
            );
          })}
          {selected?.kind === "user" &&
            (() => {
              const p = located.find((x) => x.id === selected.id);
              if (!p) return null;
              return (
                <InfoWindow position={{ lat: p.live_lat!, lng: p.live_lng! }} onCloseClick={() => setSelected(null)}>
                  <div style={{ direction: "rtl" }}>
                    <strong>{p.name}</strong> (@{p.username})
                    <br />
                    {p.riding_since ? "בנסיעה כעת" : isRecentlyActive(p.last_active_at) ? "פעיל עכשיו" : "לא פעיל"}
                  </div>
                </InfoWindow>
              );
            })()}

          {hazards.map((h) => (
            <AdvancedMarker key={h.id} position={{ lat: h.lat, lng: h.lng }} onClick={() => setSelected({ kind: "hazard", id: h.id })}>
              <HazardMarkerGlyph type={h.type} />
            </AdvancedMarker>
          ))}
          {selected?.kind === "hazard" &&
            (() => {
              const h = hazards.find((x) => x.id === selected.id);
              if (!h) return null;
              return (
                <InfoWindow position={{ lat: h.lat, lng: h.lng }} onCloseClick={() => setSelected(null)}>
                  <div style={{ direction: "rtl", minWidth: 140 }}>
                    <strong>{HAZARD_TYPE_LABELS[h.type] ?? h.type}</strong> - {h.reporter_name}
                    <br />+{h.confirmations} / -{h.denials}
                    <RemoveHazardButton
                      id={h.id}
                      onRemoved={() => {
                        setSelected(null);
                        onHazardRemoved?.();
                      }}
                    />
                  </div>
                </InfoWindow>
              );
            })()}

          {prizes.map((p) => (
            <AdvancedMarker key={p.id} position={{ lat: p.lat, lng: p.lng }} onClick={() => setSelected({ kind: "prize", id: p.id })}>
              <PrizeMarkerGlyph icon={p.icon} imageUrl={p.icon_image_url} />
            </AdvancedMarker>
          ))}
          {selected?.kind === "prize" &&
            (() => {
              const p = prizes.find((x) => x.id === selected.id);
              if (!p) return null;
              return (
                <InfoWindow position={{ lat: p.lat, lng: p.lng }} onCloseClick={() => setSelected(null)}>
                  <div style={{ direction: "rtl", minWidth: 140 }}>
                    <strong>פרס · {p.points} נק'</strong>
                    <RemovePrizeButton
                      id={p.id}
                      onRemoved={() => {
                        setSelected(null);
                        onHazardRemoved?.();
                      }}
                    />
                  </div>
                </InfoWindow>
              );
            })()}
        </Map>
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
