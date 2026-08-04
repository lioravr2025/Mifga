import { useEffect, useRef, useState } from "react";
import { AttributionControl, Circle, MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import { AlertTriangle, Loader2, Locate, Shield, ShieldCheck, Siren, Square, Volume2, VolumeX } from "lucide-react";
import { useApp } from "../context/AppContext";
import ScooterIcon from "../components/ScooterIcon";
import PulseRing from "../components/PulseRing";
import AddressAutocomplete from "../components/AddressAutocomplete";
import NavigationBanner from "../components/NavigationBanner";
import ReportFlow from "../components/ReportFlow";
import { AutoFollow, CenterTracker, MapResizeHandler, RecenterController } from "../components/MapView";
import { trackClick } from "../lib/analytics";
import {
  planSafeRoute,
  minDistanceToPath,
  remainingDistanceAlongPath,
  describeManeuver,
  estimateDurationS,
  type RouteResult,
} from "../lib/routing";
import { formatDistance } from "../lib/geo";
import { speak } from "../lib/speech";
import { playRouteRecalculating } from "../lib/sound";
import { useTurnByTurn } from "../hooks/useTurnByTurn";
import { getHazardType } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { destinationDivIcon, hazardDivIcon, selfDivIcon } from "../lib/mapIcons";
import type { RideMonitor } from "../hooks/useRideMonitor";
import type { HazardTypeId, LatLng } from "../types";

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILES = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const HAZARD_ALERT_RADIUS_M = 120;
// Two-stage announcement per maneuver, same shape Waze uses: a heads-up
// while there's still real distance to cover, then a sharp "now" cue right
// before it.
const VOICE_FAR_M = 250;
const VOICE_NEAR_M = 40;
// How far off the planned path counts as "actually left the route" (not
// just GPS jitter) before triggering a Waze-style recalculation.
const OFF_ROUTE_THRESHOLD_M = 45;

export default function RouteScreen({ position, ride, active }: { position: LatLng; ride: RideMonitor; active: boolean }) {
  const { hazards, settings, user, addReport } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);
  const [destLabel, setDestLabel] = useState("");
  const [remainingM, setRemainingM] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [recenterSignal, setRecenterSignal] = useState(0);
  // "···" more-hazards report flow (same component the main map tab uses),
  // including its own manual-pin picking cycle for this screen's own map.
  const [reportOpen, setReportOpen] = useState(false);
  const [presetType, setPresetType] = useState<HazardTypeId | null>(null);
  const [reportStep, setReportStep] = useState<"type" | "more">("more");
  const [isPicking, setIsPicking] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<LatLng | null>(null);

  const hazardsOnRoute = route ? hazards.filter((h) => minDistanceToPath(h.position, route.points) <= HAZARD_ALERT_RADIUS_M) : [];

  const nav = useTurnByTurn(position, route?.steps ?? []);
  const navigating = active && ride.rideActive && !!route && !!nav.upcoming && !nav.isArrived;

  // Instant one-tap police/inspector report while riding, no location/nickname/
  // photo step - parity with the same buttons on the main map tab.
  const quickAddWhileRiding = (type: "police" | "inspector") => {
    trackClick(`report_quick_instant_${type}`, "route");
    addReport({ type, position });
  };

  const openMoreReport = () => {
    trackClick("report_more", "route");
    setPresetType(null);
    setReportStep("more");
    setReportOpen(true);
  };

  // Waze-style auto-reroute: once actually off the planned path (not just GPS
  // jitter) during an active ride, recompute from the current position to the
  // same destination and swap the route in, with a short recalculating chime.
  // Never clears the displayed route while the new one is in flight, so the
  // polyline doesn't flash empty mid-ride.
  const reroutingRef = useRef(false);
  useEffect(() => {
    // `active` matters here because this screen stays mounted (just hidden)
    // while another tab is open - without it, a route planned earlier and
    // then abandoned (switched to the main tab and started a plain,
    // destination-less ride from there) kept silently auto-rerouting and
    // chiming toward that stale destination in the background.
    if (!active || !ride.rideActive || !route || !destPoint || reroutingRef.current) return;
    if (minDistanceToPath(position, route.points) <= OFF_ROUTE_THRESHOLD_M) return;
    reroutingRef.current = true;
    playRouteRecalculating();
    planSafeRoute(
      position,
      destPoint,
      hazards.map((h) => h.position)
    )
      .then((r) => {
        if (r) setRoute(r);
      })
      .catch(() => {
        // transient network hiccup - keep showing the previous route rather than clearing it
      })
      .finally(() => {
        reroutingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, ride.rideActive, route, destPoint]);

  // Voice announcements - one "heads up" per maneuver as it comes within
  // VOICE_FAR_M, one sharper "now" cue within VOICE_NEAR_M. Tracked by step
  // index so each maneuver only gets each announcement once, no matter how
  // many position ticks land inside those ranges.
  const announcedFarRef = useRef<Set<number>>(new Set());
  const announcedNearRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    announcedFarRef.current = new Set();
    announcedNearRef.current = new Set();
  }, [route]);
  useEffect(() => {
    if (!navigating || !voiceEnabled || !nav.upcoming) return;
    const idx = nav.activeIndex;
    const instruction = describeManeuver(nav.upcoming);
    if (nav.distanceToUpcomingM <= VOICE_NEAR_M && !announcedNearRef.current.has(idx)) {
      announcedNearRef.current.add(idx);
      speak(`${instruction}, עכשיו`, settings.voiceURI);
    } else if (nav.distanceToUpcomingM <= VOICE_FAR_M && !announcedFarRef.current.has(idx)) {
      announcedFarRef.current.add(idx);
      speak(`בעוד ${Math.round(nav.distanceToUpcomingM / 10) * 10} מטר, ${instruction}`, settings.voiceURI);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, voiceEnabled, nav.activeIndex, nav.distanceToUpcomingM]);

  // Live "how much is left" while riding this specific route - the shared ride
  // monitor already handles hazard-proximity audio alerts and path logging
  // (same instance as the home tab, so alerts fire no matter which tab is
  // open) - this just adds the route-progress figure on top of it.
  useEffect(() => {
    if (!ride.rideActive || !route) {
      setRemainingM(null);
      return;
    }
    setRemainingM(remainingDistanceAlongPath(position, route.points));
  }, [position, ride.rideActive, route]);

  const planRouteTo = async (dest: LatLng, label: string) => {
    setLoading(true);
    setError(null);
    setRoute(null);
    setDestPoint(dest);
    setDestLabel(label);
    try {
      const r = await planSafeRoute(
        position,
        dest,
        hazards.map((h) => h.position)
      );
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

  // Duration/ETA is computed from real route distance and the rider's actual
  // vehicle (estimateDurationS), not OSRM's own route.duration - that's tuned
  // for whichever profile served the route (car or generic bicycle), neither
  // of which matches an e-scooter/e-bike's real average speed.
  const totalDurationS = route ? estimateDurationS(route.distanceM, user.vehicleType) : null;
  const remainingDurationS = remainingM !== null ? estimateDurationS(remainingM, user.vehicleType) : null;
  const etaLabel =
    remainingDurationS !== null ? new Date(Date.now() + remainingDurationS * 1000).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col safe-top">
      {/* Slides up and fades out on ride start, like the home tab's bottom panel, so the map gets most of the screen. */}
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          ride.rideActive ? "max-h-0 opacity-0 -translate-y-4 pointer-events-none" : "max-h-[320px] opacity-100 translate-y-0 px-5 pt-6 pb-4"
        }`}
      >
        <h1 className="text-xl font-bold text-neutral-50 mb-4">תכנון מסלול בטוח ממפגעים</h1>
        {/* Navigation is always from the current position, same as Waze - one box, no separate "from" field. */}
        <AddressAutocomplete
          biasNear={position}
          placeholder="לאן נוסעים? הקלידו כתובת או יישוב"
          onSelect={(s) => planRouteTo(s.position, s.label)}
          highlight={active}
        />
        {loading && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-400">
            <Loader2 size={13} className="animate-spin" />
            מחשב מסלול בטוח ל{destLabel}...
          </div>
        )}
        {error && <div className="mt-2 text-xs text-red-400">{error}</div>}
      </div>

      <div className="flex-1 min-h-0 relative isolate">
        <MapContainer center={[position.lat, position.lng]} zoom={13} zoomControl={false} attributionControl={false} className="w-full h-full">
          <MapResizeHandler />
          <RecenterController target={position} signal={recenterSignal} />
          {isPicking && <CenterTracker onChange={setPickedCenter} />}
          {ride.rideActive && <AutoFollow position={position} zoom={17} />}
          <AttributionControl position="bottomright" prefix={false} />
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
          {/* every nearby hazard, same as the home map - not just ones near the planned route */}
          {hazards.map((h) => (
            <Marker key={h.id} position={[h.position.lat, h.position.lng]} icon={hazardDivIcon(getHazardType(h.type))} />
          ))}
        </MapContainer>

        {isPicking && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center -translate-y-4">
              <div className="w-4 h-4 rounded-full bg-brand border-2 border-white shadow-glow shadow-brand" />
              <div className="w-0.5 h-5 bg-brand" />
            </div>
          </div>
        )}

        {navigating && nav.upcoming && <NavigationBanner step={nav.upcoming} distanceM={nav.distanceToUpcomingM} />}

        {!isPicking && (
          <button
            onClick={() => setRecenterSignal((s) => s + 1)}
            className="absolute bottom-4 left-4 z-[500] w-11 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg flex items-center justify-center active:scale-95"
          >
            <Locate size={20} className="text-brand-light" />
          </button>
        )}

        {/* Parity with the main map tab's ride-mode quick-report strip - one tap
            adds a police/inspector report at the current position instantly, no
            location/nickname/photo step; "···" opens the full hazard-type grid. */}
        {ride.rideActive && !isPicking && (
          <div className="absolute top-24 right-4 z-[500] flex flex-col gap-3">
            <button
              onClick={() => quickAddWhileRiding("police")}
              className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition shadow-lg"
              style={{ background: "#0f1830", border: `2px solid ${HAZARD_COLOR_HEX.police}`, boxShadow: `0 0 12px -2px ${HAZARD_COLOR_HEX.police}` }}
              title="שוטר"
            >
              <Siren size={22} color={HAZARD_COLOR_HEX.police} />
            </button>
            <button
              onClick={() => quickAddWhileRiding("inspector")}
              className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition shadow-lg"
              style={{ background: "#0f1830", border: `2px solid ${HAZARD_COLOR_HEX.inspector}`, boxShadow: `0 0 12px -2px ${HAZARD_COLOR_HEX.inspector}` }}
              title="פקח"
            >
              <Shield size={22} color={HAZARD_COLOR_HEX.inspector} />
            </button>
            <button
              onClick={openMoreReport}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-bg-panel/90 backdrop-blur border border-bg-border active:scale-95 transition shadow-lg"
              title="עוד"
            >
              <span className="text-lg leading-none text-neutral-300">···</span>
            </button>
          </div>
        )}

        <div className="absolute bottom-3 inset-x-3 z-[500] flex flex-col gap-2">
          <div className="relative">
            {ride.rideActive && <PulseRing color="#ef4444" />}
            <button
              onClick={() => {
                trackClick(ride.rideActive ? "ride_stop" : "ride_start", "route");
                ride.rideActive ? ride.stopRide() : ride.startRide();
              }}
              className={`relative w-full flex items-center justify-center gap-2 py-3.5 rounded-full shadow-lg border-4 border-bg-panel active:scale-95 transition ${
                ride.rideActive ? "bg-gradient-to-br from-red-600 to-red-500" : "bg-gradient-to-br from-green-600 to-green-500"
              }`}
            >
              {ride.rideActive ? <Square size={18} className="text-white fill-white" /> : <ScooterIcon size={20} color="white" />}
              <span className="text-white text-base font-bold">
                {ride.rideActive ? "סיום נסיעה" : route ? "תחילת נסיעה במסלול" : "תחילת נסיעה"}
              </span>
            </button>
          </div>

          {route && (
            <div className="bg-bg-panel/95 backdrop-blur border border-bg-border rounded-2xl p-4 shadow-2xl max-h-[40%] overflow-y-auto no-scrollbar">
              {ride.rideActive ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-neutral-50 tabular-nums">
                      {remainingM !== null ? formatDistance(remainingM) : formatDistance(route.distanceM)}
                    </span>
                    <span className="text-xs text-neutral-400">נותרו</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {remainingDurationS !== null && (
                      <div className="text-left">
                        <div className="text-sm font-bold text-neutral-100 tabular-nums">{Math.max(0, Math.round(remainingDurationS / 60))} דק'</div>
                        {etaLabel && <div className="text-[10px] text-neutral-500 tabular-nums">הגעה {etaLabel}</div>}
                      </div>
                    )}
                    <button
                      onClick={() => setVoiceEnabled((v) => !v)}
                      className="w-8 h-8 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center active:scale-95 transition shrink-0"
                      title={voiceEnabled ? "השתקת הנחיות קוליות" : "הפעלת הנחיות קוליות"}
                    >
                      {voiceEnabled ? (
                        <Volume2 size={14} className="text-brand-light" />
                      ) : (
                        <VolumeX size={14} className="text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-neutral-50">{Math.round((totalDurationS ?? route.durationS) / 60)} דק'</div>
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
              )}
              {!ride.rideActive && hazardsOnRoute.length > 0 && (
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
                    ברגע שתלחצו "תחילת נסיעה" תקבלו הנחיות ניווט קוליות ותתריעו על כל מפגע לאורך הדרך - כמו בעמוד הראשי.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <ReportFlow
          open={reportOpen}
          userPosition={position}
          onClose={() => setReportOpen(false)}
          onStartPicking={() => setIsPicking(true)}
          onStopPicking={() => setIsPicking(false)}
          pickedCenter={pickedCenter}
          isPicking={isPicking}
          initialType={presetType}
          initialStep={reportStep}
        />
      </div>
    </div>
  );
}
