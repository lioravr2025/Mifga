import { useEffect, useRef } from "react";
import { MapContainer, Polyline, TileLayer, CircleMarker, useMap } from "react-leaflet";
import type { Map as LeafletMap, LatLngBoundsExpression } from "leaflet";
import { Flag, MapPin, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { useApp } from "../context/AppContext";
import { distanceMeters, formatDistance, timeAgo } from "../lib/geo";
import type { RideLogEntry } from "../types";

function totalPathDistance(path: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1], path[i]);
  return total;
}

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

function FitToPath({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length < 2) return;
    map.fitBounds(positions as LatLngBoundsExpression, { padding: [32, 32] });
  }, [map, positions]);
  return null;
}

export default function RideRouteSheet({ ride, onClose }: { ride: RideLogEntry | null; onClose: () => void }) {
  const { settings } = useApp();
  const mapRef = useRef<LeafletMap | null>(null);
  if (!ride) return null;

  const path = ride.path ?? [];
  const positions: [number, number][] = path.map((p) => [p.lat, p.lng]);
  const minutes = Math.max(1, Math.round((ride.endedAt - ride.startedAt) / 60000));
  const distance = totalPathDistance(path);
  const start = positions[0];
  const end = positions[positions.length - 1];

  return (
    <BottomSheet open={!!ride} onClose={onClose} maxHeight="88%">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-50">נסיעה {timeAgo(ride.startedAt)}</h2>
          <p className="text-xs text-neutral-400">
            {minutes} דק' · {formatDistance(distance)} · {ride.hazardsAvoided} מפגעים נחסכו
          </p>
        </div>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      {positions.length < 2 ? (
        <div className="h-56 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border flex items-center justify-center text-center px-6">
          <p className="text-xs text-neutral-500">הנסיעה הייתה קצרה מדי כדי לשמור מסלול - רק נקודת ההתחלה נרשמה.</p>
        </div>
      ) : (
        <div className="h-72 rounded-2xl overflow-hidden border border-bg-border mb-3">
          <MapContainer center={start} zoom={16} zoomControl={false} attributionControl={false} className="w-full h-full" ref={mapRef}>
            <TileLayer url={settings.theme === "dark" ? DARK_TILES : LIGHT_TILES} />
            <Polyline positions={positions} pathOptions={{ color: "#7c3aed", weight: 4, opacity: 0.85 }} />
            <CircleMarker center={start} radius={7} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }} />
            <CircleMarker center={end} radius={7} pathOptions={{ color: "#f43f5e", fillColor: "#f43f5e", fillOpacity: 1, weight: 2 }} />
            <FitToPath positions={positions} />
          </MapContainer>
        </div>
      )}

      <div className="flex items-center gap-6 justify-center text-xs text-neutral-300">
        <span className="flex items-center gap-1.5">
          <MapPin size={13} className="text-green-400" />
          התחלה
        </span>
        <span className="flex items-center gap-1.5">
          <Flag size={13} className="text-red-400" />
          סיום
        </span>
      </div>
    </BottomSheet>
  );
}
