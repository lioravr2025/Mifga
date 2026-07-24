import { useState } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import { AlertTriangle, Loader2, MapPin, Navigation, Search, ShieldCheck, Square } from "lucide-react";
import { useApp } from "../context/AppContext";
import ScooterIcon from "../components/ScooterIcon";
import PulseRing from "../components/PulseRing";
import { fetchRoute, geocode, minDistanceToPath } from "../lib/routing";
import { formatDistance } from "../lib/geo";
import { getHazardType } from "../data/hazardTypes";
import { destinationDivIcon, hazardDivIcon, selfDivIcon } from "../lib/mapIcons";
import type { RideMonitor } from "../hooks/useRideMonitor";
import type { LatLng } from "../types";

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const HAZARD_ALERT_RADIUS_M = 120;

export default function RouteScreen({ position, ride }: { position: LatLng; ride: RideMonitor }) {
  const { hazards, settings, user } = useApp();
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<{ points: LatLng[]; distanceM: number; durationS: number } | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);

  const hazardsOnRoute = route ? hazards.filter((h) => minDistanceToPath(h.position, route.points) <= HAZARD_ALERT_RADIUS_M) : [];

  const planRoute = async () => {
    if (!destination.trim()) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    try {
      const dest = await geocode(destination, position);
      if (!dest) {
        setError("לא הצלחנו למצוא את הכתובת. נסו לנסח אחרת.");
        return;
      }
      setDestPoint(dest);
      const r = await fetchRoute(position, dest);
      if (!r) {
        setError("לא נמצא מסלול נסיעה בין הנקודות.");
        return;
      }
      setRoute(r);
    } catch {
      setError("אין חיבור לאינטרנט כרגע - ניווט זקוק לרשת.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col safe-top">
      <div className="px-5 pt-6 pb-4 shrink-0">
        <h1 className="text-xl font-bold text-neutral-50 mb-4">תכנון מסלול בטוח ממפגעים</h1>
        <div className="flex items-center gap-2 mb-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
          <MapPin size={16} className="text-brand-light shrink-0" />
          <span className="text-sm text-neutral-300">המיקום הנוכחי שלי</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && planRoute()}
            placeholder="לאן נוסעים? (כתובת או מקום)"
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
          />
        </div>
        <button
          onClick={planRoute}
          disabled={loading || !destination.trim()}
          className="w-full mt-3 py-3 rounded-2xl bg-brand text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
          {loading ? "מחשב מסלול..." : "מצא מסלול"}
        </button>
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 relative">
        <MapContainer center={[position.lat, position.lng]} zoom={13} zoomControl={false} className="w-full h-full">
          <TileLayer url={settings.theme === "dark" ? DARK_TILES : LIGHT_TILES} attribution="&copy; OpenStreetMap &copy; CARTO" />
          {ride.rideActive && (
            <Circle
              center={[position.lat, position.lng]}
              radius={settings.rideAlertRadiusM}
              pathOptions={{ color: "#7c3aed", weight: 2, fillColor: "#7c3aed", fillOpacity: 0.08 }}
              interactive={false}
            />
          )}
          <Marker position={[position.lat, position.lng]} icon={selfDivIcon(user.vehicleType)} />
          {destPoint && <Marker position={[destPoint.lat, destPoint.lng]} icon={destinationDivIcon()} />}
          {route && <Polyline positions={route.points.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#7c3aed", weight: 5, opacity: 0.85 }} />}
          {hazardsOnRoute.map((h) => (
            <Marker key={h.id} position={[h.position.lat, h.position.lng]} icon={hazardDivIcon(getHazardType(h.type))} />
          ))}
        </MapContainer>

        <div className="absolute bottom-3 inset-x-3 z-[500] flex flex-col gap-2">
          <div className="relative">
            {ride.rideActive && <PulseRing color="#ef4444" />}
            <button
              onClick={() => (ride.rideActive ? ride.stopRide() : ride.startRide())}
              className={`relative w-full flex items-center justify-center gap-2 py-3.5 rounded-full shadow-lg border-4 border-bg-panel active:scale-95 transition ${
                ride.rideActive ? "bg-gradient-to-br from-red-600 to-red-500" : "bg-gradient-to-br from-green-600 to-green-500"
              }`}
            >
              {ride.rideActive ? <Square size={18} className="text-white fill-white" /> : <ScooterIcon size={20} color="white" />}
              <span className="text-white text-base font-bold">{ride.rideActive ? "הפסקת נסיעה" : "תחילת נסיעה"}</span>
            </button>
          </div>

          {route && (
            <div className="bg-bg-panel/95 backdrop-blur border border-bg-border rounded-2xl p-4 shadow-2xl max-h-[40%] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-neutral-50">{Math.round(route.durationS / 60)} דק'</div>
                  <div className="text-xs text-neutral-400">{formatDistance(route.distanceM)}</div>
                </div>
                {hazardsOnRoute.length === 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-semibold">
                    <ShieldCheck size={14} />
                    אין מפגעים ידועים בדרך
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold">
                    <AlertTriangle size={14} />
                    {hazardsOnRoute.length} מפגעים בדרך
                  </div>
                )}
              </div>
              {hazardsOnRoute.length > 0 && (
                <div className="space-y-2">
                  {hazardsOnRoute.map((h) => {
                    const def = getHazardType(h.type);
                    return (
                      <div key={h.id} className="flex items-center gap-2 text-xs text-neutral-300">
                        <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                        {def.label}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-neutral-500 pt-1">
                    עקיפה אוטומטית של מפגעים בתכנון המסלול תתווסף בגרסה הבאה - כרגע אנו רק מתריעים על מפגעים שדווחו לאורך הדרך.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
