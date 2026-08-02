import { useEffect, useRef, useState } from "react";
import { Map, AdvancedMarker, Polyline as GPolyline, useMapsLibrary } from "@vis.gl/react-google-maps";
import { AlertTriangle, Loader2, Locate, Shield, ShieldCheck, Siren, Square, Volume2, VolumeX } from "lucide-react";
import { useApp } from "../context/AppContext";
import ScooterIcon from "../components/ScooterIcon";
import PulseRing from "../components/PulseRing";
import GoogleAddressAutocomplete from "../components/GoogleAddressAutocomplete";
import GoogleNavigationBanner from "../components/GoogleNavigationBanner";
import ReportFlow from "../components/ReportFlow";
import { AutoFollow, CenterTracker, RecenterController } from "../components/GoogleMapView";
import { trackClick } from "../lib/analytics";
import { fetchGoogleRoute, minDistanceToPath, remainingDistanceAlongPath, estimateDurationS, type RouteResult } from "../lib/googleRouting";
import { formatDistance } from "../lib/geo";
import { speak } from "../lib/speech";
import { playRouteRecalculating } from "../lib/sound";
import { useGoogleTurnByTurn } from "../hooks/useGoogleTurnByTurn";
import { getHazardType } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { HazardIcon } from "../components/HazardIcon";
import type { RideMonitor } from "../hooks/useRideMonitor";
import type { HazardTypeId, LatLng } from "../types";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;
const HAZARD_ALERT_RADIUS_M = 120;
const VOICE_FAR_M = 250;
const VOICE_NEAR_M = 40;
const OFF_ROUTE_THRESHOLD_M = 45;

export default function GoogleRouteScreen({ position, ride, active }: { position: LatLng; ride: RideMonitor; active: boolean }) {
  const { hazards, settings, user, addReport } = useApp();
  const routesLib = useMapsLibrary("routes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [destPoint, setDestPoint] = useState<LatLng | null>(null);
  const [destLabel, setDestLabel] = useState("");
  const [remainingM, setRemainingM] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [presetType, setPresetType] = useState<HazardTypeId | null>(null);
  const [reportStep, setReportStep] = useState<"type" | "more">("more");
  const [isPicking, setIsPicking] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<LatLng | null>(null);

  const hazardsOnRoute = route ? hazards.filter((h) => minDistanceToPath(h.position, route.points) <= HAZARD_ALERT_RADIUS_M) : [];

  const nav = useGoogleTurnByTurn(position, route?.steps ?? []);
  const navigating = ride.rideActive && !!route && !!nav.upcoming && !nav.isArrived;

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

  const planRouteTo = async (dest: LatLng, label: string) => {
    if (!routesLib) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    setDestPoint(dest);
    setDestLabel(label);
    try {
      const r = await fetchGoogleRoute(routesLib, position, dest);
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

  const reroutingRef = useRef(false);
  useEffect(() => {
    if (!ride.rideActive || !route || !destPoint || !routesLib || reroutingRef.current) return;
    if (minDistanceToPath(position, route.points) <= OFF_ROUTE_THRESHOLD_M) return;
    reroutingRef.current = true;
    playRouteRecalculating();
    fetchGoogleRoute(routesLib, position, destPoint)
      .then((r) => {
        if (r) setRoute(r);
      })
      .catch(() => {})
      .finally(() => {
        reroutingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, ride.rideActive, route, destPoint, routesLib]);

  const announcedFarRef = useRef<Set<number>>(new Set());
  const announcedNearRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    announcedFarRef.current = new Set();
    announcedNearRef.current = new Set();
  }, [route]);
  useEffect(() => {
    if (!navigating || !voiceEnabled || !nav.upcoming) return;
    const idx = nav.activeIndex;
    const instruction = nav.upcoming.instruction;
    if (nav.distanceToUpcomingM <= VOICE_NEAR_M && !announcedNearRef.current.has(idx)) {
      announcedNearRef.current.add(idx);
      speak(`${instruction}, עכשיו`, settings.voiceURI);
    } else if (nav.distanceToUpcomingM <= VOICE_FAR_M && !announcedFarRef.current.has(idx)) {
      announcedFarRef.current.add(idx);
      speak(`בעוד ${Math.round(nav.distanceToUpcomingM / 10) * 10} מטר, ${instruction}`, settings.voiceURI);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, voiceEnabled, nav.activeIndex, nav.distanceToUpcomingM]);

  useEffect(() => {
    if (!ride.rideActive || !route) {
      setRemainingM(null);
      return;
    }
    setRemainingM(remainingDistanceAlongPath(position, route.points));
  }, [position, ride.rideActive, route]);

  const totalDurationS = route ? estimateDurationS(route.distanceM, user.vehicleType) : null;
  const remainingDurationS = remainingM !== null ? estimateDurationS(remainingM, user.vehicleType) : null;
  const etaLabel =
    remainingDurationS !== null ? new Date(Date.now() + remainingDurationS * 1000).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col safe-top">
      <div
        className={`shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          ride.rideActive ? "max-h-0 opacity-0 -translate-y-4 pointer-events-none" : "max-h-[320px] opacity-100 translate-y-0 px-5 pt-6 pb-4"
        }`}
      >
        <h1 className="text-xl font-bold text-neutral-50 mb-4">תכנון מסלול בטוח ממפגעים</h1>
        <GoogleAddressAutocomplete
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
        <Map
          mapId={MAP_ID}
          defaultCenter={{ lat: position.lat, lng: position.lng }}
          defaultZoom={13}
          renderingType="VECTOR"
          colorScheme={settings.theme === "dark" ? "DARK" : "LIGHT"}
          disableDefaultUI
          gestureHandling="greedy"
          className="w-full h-full"
        >
          <RecenterController target={position} signal={recenterSignal} />
          {isPicking && <CenterTracker onChange={setPickedCenter} />}
          {ride.rideActive && <AutoFollow position={position} zoom={17} />}

          <AdvancedMarker position={{ lat: position.lat, lng: position.lng }}>
            <div className="relative">
              <span className="absolute inset-0 rounded-full border-2 border-brand animate-pulseRing" />
              <div
                className="relative rounded-full flex items-center justify-center border-[3px] border-white"
                style={{ width: 26, height: 26, background: "#7c3aed", boxShadow: "0 0 10px 2px rgba(124,58,237,0.8)" }}
              />
            </div>
          </AdvancedMarker>

          {destPoint && (
            <AdvancedMarker position={{ lat: destPoint.lat, lng: destPoint.lng }}>
              <svg width="30" height="40" viewBox="0 0 30 40">
                <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.3-6.7-15-15-15z" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                <circle cx="15" cy="15" r="5.5" fill="white" />
              </svg>
            </AdvancedMarker>
          )}

          {route && <GPolyline path={route.points.map((p) => ({ lat: p.lat, lng: p.lng }))} strokeColor="#7c3aed" strokeWeight={5} strokeOpacity={0.85} />}

          {hazards.map((h) => {
            const def = getHazardType(h.type);
            const hex = HAZARD_COLOR_HEX[def.color] ?? "#38bdf8";
            const size = def.highPriority ? 44 : 38;
            return (
              <AdvancedMarker key={h.id} position={{ lat: h.position.lat, lng: h.position.lng }}>
                <div className="relative" style={{ width: size, height: size }}>
                  {def.highPriority && <span className="absolute inset-0 rounded-full border-2 animate-pulseRing" style={{ borderColor: hex }} />}
                  <div
                    className="absolute inset-0 rounded-full flex items-center justify-center"
                    style={{ background: "#0f1830", border: `2px solid ${hex}`, boxShadow: `0 0 12px -1px ${hex}` }}
                  >
                    <HazardIcon name={def.icon} color={hex} size={def.highPriority ? 22 : 18} strokeWidth={2.4} />
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>

        {isPicking && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center -translate-y-4">
              <div className="w-4 h-4 rounded-full bg-brand border-2 border-white shadow-glow shadow-brand" />
              <div className="w-0.5 h-5 bg-brand" />
            </div>
          </div>
        )}

        {navigating && nav.upcoming && <GoogleNavigationBanner step={nav.upcoming} distanceM={nav.distanceToUpcomingM} isArrived={nav.isArrived} />}

        {/* Anchored to the top (not bottom-left like the main map tab) - the
            bottom-left corner here is always claimed by the ride button/ETA
            panel, whose height changes depending on ride state and whether a
            route exists, so a fixed bottom offset kept overlapping it. */}
        {!isPicking && (
          <button
            onClick={() => setRecenterSignal((s) => s + 1)}
            className="absolute top-24 left-4 z-[700] w-11 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg flex items-center justify-center active:scale-95"
          >
            <Locate size={20} className="text-brand-light" />
          </button>
        )}

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
              <span className="text-white text-base font-bold">{ride.rideActive ? "סיום נסיעה" : route ? "תחילת נסיעה במסלול" : "תחילת נסיעה"}</span>
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
                      {voiceEnabled ? <Volume2 size={14} className="text-brand-light" /> : <VolumeX size={14} className="text-neutral-500" />}
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
