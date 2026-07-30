import { useEffect, useState } from "react";
import { Locate, Mic, Square, Star } from "lucide-react";
import MapView from "../components/MapView";
import TopBar from "../components/TopBar";
import ReportFlow from "../components/ReportFlow";
import HazardDetailSheet from "../components/HazardDetailSheet";
import MyProfileCard from "../components/MyProfileCard";
import PointsToast from "../components/PointsToast";
import Confetti from "../components/Confetti";
import ScooterIcon from "../components/ScooterIcon";
import PulseRing from "../components/PulseRing";
import InviteFriendButton from "../components/InviteFriendButton";
import Avatar from "../components/Avatar";
import { HazardIcon } from "../components/HazardIcon";
import { PRIMARY_HAZARD_TYPES } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { useWalkieRecorder } from "../hooks/useWalkieRecorder";
import { useApp } from "../context/AppContext";
import { isBackendConfigured } from "../lib/supabaseClient";
import { trackClick } from "../lib/analytics";
import type { RideMonitor } from "../hooks/useRideMonitor";
import type { HazardTypeId, LatLng } from "../types";

export default function MapScreen({
  position,
  ride,
  onGoRoute,
  onGoFriends,
  onGoProfile,
  onOpenSettings,
  onOpenMenu,
  focusFriendId,
  onConsumeFocusFriend,
}: {
  position: LatLng;
  ride: RideMonitor;
  onGoRoute: () => void;
  onGoFriends: () => void;
  onGoProfile: () => void;
  onOpenSettings: () => void;
  onOpenMenu: () => void;
  focusFriendId: string | null;
  onConsumeFocusFriend: () => void;
}) {
  const { hazards, prizes, collectPrize, friends, settings, lastAwardedPoints, clearLastAwarded, sendFriendMessage } = useApp();
  const friendsInMotionCount = friends.filter((f) => f.online && f.shareLocation).length;
  const favoriteFriends = friends.filter((f) => f.favorite);

  const [reportOpen, setReportOpen] = useState(false);
  const [presetType, setPresetType] = useState<HazardTypeId | null>(null);
  const [tapPosition, setTapPosition] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState<"type" | "more">("type");
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [selfCardOpen, setSelfCardOpen] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [cameraTarget, setCameraTarget] = useState<LatLng | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<LatLng | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [walkieSentLabel, setWalkieSentLabel] = useState<string | null>(null);

  const openReport = (type?: HazardTypeId, step: "type" | "more" = "type") => {
    trackClick(type ? `report_quick_${type}` : "report_more", "map");
    setPresetType(type ?? null);
    setTapPosition(null);
    setReportStep(step);
    setReportOpen(true);
  };

  /** Tapping a point directly on the map reports at that exact point - skips the location step entirely. */
  const openReportAtPosition = (pos: LatLng) => {
    setPresetType(null);
    setTapPosition(pos);
    setReportStep("type");
    setReportOpen(true);
  };

  const centerOnFriend = (pos: LatLng) => {
    setCameraTarget(pos);
    setRecenterSignal((s) => s + 1);
  };

  useEffect(() => {
    if (!focusFriendId) return;
    const friend = friends.find((f) => f.id === focusFriendId);
    if (friend) centerOnFriend(friend.position);
    onConsumeFocusFriend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusFriendId]);

  useEffect(() => {
    if (lastAwardedPoints !== null) setConfettiTrigger((t) => t + 1);
  }, [lastAwardedPoints]);

  const { recordingFor, start: startWalkie, stop: stopWalkie, cancel: cancelWalkie } = useWalkieRecorder((friendId, blob, errorReason) => {
    if (isBackendConfigured && !blob) {
      setWalkieSentLabel(`לא הצלחנו להקליט - בדקו הרשאת מיקרופון${errorReason ? ` (${errorReason})` : ""}`);
      setTimeout(() => setWalkieSentLabel(null), 5000);
      return;
    }
    const friend = friends.find((f) => f.id === friendId);
    sendFriendMessage(friendId, blob);
    setWalkieSentLabel(friend?.name ?? "");
    setTimeout(() => setWalkieSentLabel(null), 2200);
  });

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div className="relative flex-1 min-h-0">
        <MapView
          userPosition={position}
          cameraTarget={cameraTarget ?? undefined}
          recenterSignal={recenterSignal}
          hazards={hazards}
          prizes={prizes}
          onCollectPrize={(id) => {
            trackClick("prize_collect", "map");
            collectPrize(id);
          }}
          friends={friends}
          showFriends
          theme={settings.theme}
          onSelectHazard={(h) => setSelectedHazardId(h.id)}
          onSelectSelf={() => setSelfCardOpen(true)}
          rideActive={ride.rideActive}
          autoFollow={ride.rideActive}
          pickingLocation={isPicking}
          onPickedCenterChange={setPickedCenter}
          onMapClick={!reportOpen && !isPicking ? openReportAtPosition : undefined}
        />

        {isPicking && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center -translate-y-4">
              <div className="w-4 h-4 rounded-full bg-brand border-2 border-white shadow-glow shadow-brand" />
              <div className="w-0.5 h-5 bg-brand" />
            </div>
          </div>
        )}

        <TopBar
          onMenu={onOpenMenu}
          onBell={onOpenSettings}
          onFriendsInMotion={onGoFriends}
          friendsInMotionCount={friendsInMotionCount}
          notifDot={!settings.notificationsEnabled}
        />

        <button
          onClick={() => {
            setCameraTarget(null);
            setRecenterSignal((s) => s + 1);
          }}
          className="absolute bottom-4 left-4 z-[500] w-11 h-11 rounded-2xl bg-bg-panel/90 backdrop-blur border border-bg-border shadow-lg flex items-center justify-center active:scale-95"
        >
          <Locate size={20} className="text-brand-light" />
        </button>

        {/* Ride mode: map takes over the screen, so quick-report stays reachable as a
            vertical strip on the map itself instead of living in the (now hidden) bottom panel. */}
        {ride.rideActive && (
          <div className="absolute top-24 right-4 z-[500] flex flex-col gap-3">
            {PRIMARY_HAZARD_TYPES.map((h) => (
              <button
                key={h.id}
                onClick={() => openReport(h.id)}
                className="w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition shadow-lg"
                style={{ background: "#0f1830", border: `2px solid ${HAZARD_COLOR_HEX[h.color]}`, boxShadow: `0 0 12px -2px ${HAZARD_COLOR_HEX[h.color]}` }}
                title={h.label}
              >
                <HazardIcon name={h.icon} color={HAZARD_COLOR_HEX[h.color]} size={22} />
              </button>
            ))}
            <button
              onClick={() => openReport(undefined, "more")}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-bg-panel/90 backdrop-blur border border-bg-border active:scale-95 transition shadow-lg"
              title="עוד"
            >
              <span className="text-lg leading-none text-neutral-300">···</span>
            </button>
          </div>
        )}

        {/* The ride button itself always lives here (never inside the collapsible
            bottom panel below, which needs overflow-hidden for its slide animation -
            a button deliberately poking up out of that panel was getting clipped by
            it). Sits flush with the map's own bottom edge, nudged down so it still
            overlaps the panel's top edge the same way it always visually has.
            Deliberately NOT wrapping the text labels below in this same block - a
            flex-col block anchored by its own bottom edge is anchored by whatever
            its LAST child is, so adding the labels here pushed the button itself
            higher than intended instead of straddling the boundary. */}
        {!isPicking && (
          <div className="absolute bottom-0 inset-x-0 z-[600] flex flex-col items-center translate-y-7">
            {/* Riding: the panel is collapsed to nothing, so there's no "below" to put
                these in (that would run past the screen edge, under the bottom nav,
                as translating them further down did) - stack them above the button
                instead. Being earlier in this same flex-col doesn't disturb the
                button's own position, since the button (last child) is still what
                the bottom-0 anchor lines up with. */}
            {ride.rideActive && (
              <div className="flex flex-col items-center gap-0.5 mb-1.5 px-3 py-1 rounded-full bg-black/45 backdrop-blur-sm pointer-events-none">
                <span className="text-[11px] text-neutral-200">נסיעה פעילה - נתריע על מפגעים בדרך</span>
                <span className="text-sm font-bold text-white">הפסקת נסיעה</span>
              </div>
            )}
            <div className="relative w-20 h-20 shrink-0">
              {ride.rideActive && <PulseRing color="#ef4444" />}
              <button
                onClick={() => {
                  trackClick(ride.rideActive ? "ride_stop" : "ride_start", "map");
                  ride.rideActive ? ride.stopRide() : ride.startRide();
                }}
                aria-label={ride.rideActive ? "הפסקת נסיעה" : "תחילת נסיעה"}
                className={`absolute inset-0 rounded-full flex items-center justify-center shadow-glow border-4 border-bg-panel active:scale-95 transition ${
                  ride.rideActive
                    ? "bg-gradient-to-br from-red-600 to-red-500 shadow-red-500"
                    : "bg-gradient-to-br from-green-600 to-green-500 shadow-green-500"
                }`}
              >
                {ride.rideActive ? <Square size={30} className="text-white fill-white" /> : <ScooterIcon size={34} color="white" />}
              </button>
            </div>
          </div>
        )}

        <PointsToast points={lastAwardedPoints} onDone={clearLastAwarded} />
        <Confetti trigger={confettiTrigger} />
      </div>

      {/* Slides down and fades out on ride start instead of just vanishing, and back in on ride end. */}
      <div
        className={`shrink-0 bg-bg-panel border-t border-bg-border px-4 pt-3 pb-2 overflow-hidden transition-all duration-300 ease-in-out ${
          !isPicking && !ride.rideActive ? "max-h-[600px] opacity-100 translate-y-0" : "max-h-0 opacity-0 translate-y-6 pointer-events-none"
        }`}
      >
        {/* Sits right below where the floating ride button (rendered in the map
            area above, so it can't be clipped by this panel's overflow-hidden)
            visually overlaps down into - normal document flow here, so no
            position math needed to line it up with the button above it. */}
        <div className="flex flex-col items-center mb-2 pt-7">
          <span className="text-[11px] text-neutral-400">מוכנים לזוז?</span>
          <span className="text-sm font-bold text-neutral-50">תחילת נסיעה</span>
        </div>

          <div className="flex justify-center gap-5 mb-3">
            {PRIMARY_HAZARD_TYPES.map((h) => (
              <button key={h.id} onClick={() => openReport(h.id)} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
                <span
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: "#0f1830",
                    border: `2px solid ${HAZARD_COLOR_HEX[h.color]}`,
                    boxShadow: `0 0 14px -2px ${HAZARD_COLOR_HEX[h.color]}`,
                  }}
                >
                  <HazardIcon name={h.icon} color={HAZARD_COLOR_HEX[h.color]} size={30} />
                </span>
                <span className="text-xs font-semibold text-neutral-200 text-center leading-tight">{h.label}</span>
              </button>
            ))}
            <button onClick={() => openReport(undefined, "more")} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
              <span className="w-16 h-16 rounded-full flex items-center justify-center bg-bg-panel2 border border-bg-border">
                <span className="text-2xl leading-none text-neutral-300">···</span>
              </span>
              <span className="text-xs font-semibold text-neutral-300">עוד</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Star size={13} className="text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-neutral-200">חברים מועדפים</span>
            </div>
            <button onClick={onGoFriends} className="text-[11px] text-brand-light font-semibold">
              עריכה
            </button>
          </div>
          {walkieSentLabel && (
            <div className="mb-2 px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/40 text-green-300 text-xs font-semibold text-center">
              ההודעה הקולית נשלחה ל{walkieSentLabel} 🎙️
            </div>
          )}
          {favoriteFriends.length === 0 ? (
            <div className="w-full flex items-start gap-3 px-4 py-3 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-neutral-400 text-sm">
              <Star size={16} className="shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <button onClick={onGoFriends} className="underline decoration-dotted underline-offset-2 text-neutral-300">
                  סמנו עד 3 חברים מועדפים בטאב חברים
                </button>{" "}
                כדי לראות אותם כאן, או <InviteFriendButton variant="link" label="הזמינו חברים" />
              </p>
            </div>
          ) : (
            <div className="flex gap-2.5">
              {favoriteFriends.map((f) => {
                const recording = recordingFor === f.id;
                return (
                  <div key={f.id} className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-2xl bg-bg-panel2 border border-bg-border">
                    <button
                      onClick={() => f.shareLocation && centerOnFriend(f.position)}
                      className="flex-1 min-w-0 flex items-center gap-2 active:scale-95 transition"
                    >
                      <span className="relative shrink-0">
                        <Avatar emoji={f.avatarEmoji} photoUrl={f.avatarPhoto} size={32} className="border border-bg-border" />
                        <span
                          className={`absolute -bottom-0.5 -left-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-panel2 ${
                            f.online ? "bg-green-500" : "bg-neutral-600"
                          }`}
                        />
                      </span>
                      <span className="text-xs font-semibold text-neutral-200 truncate">{f.name}</span>
                    </button>
                    {f.allowWalkie && (
                      <button
                        onMouseDown={() => startWalkie(f.id)}
                        onMouseUp={() => recording && stopWalkie(f.id)}
                        onMouseLeave={() => recording && stopWalkie(f.id)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          startWalkie(f.id);
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          if (recording) stopWalkie(f.id);
                        }}
                        onTouchCancel={() => cancelWalkie(f.id)}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ touchAction: "none" }}
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border active:scale-95 transition select-none ${
                          recording ? "bg-red-500 border-red-400 animate-pulseRing" : "bg-brand/15 border-brand/50"
                        }`}
                        title="החזיקו לשליחת הודעה קולית"
                      >
                        {recording ? <Square size={12} className="text-white fill-white" /> : <Mic size={13} className="text-brand-light" />}
                      </button>
                    )}
                  </div>
                );
              })}
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
        initialPosition={tapPosition}
        initialStep={reportStep}
      />
      <HazardDetailSheet hazardId={selectedHazardId} onClose={() => setSelectedHazardId(null)} />
      <MyProfileCard
        open={selfCardOpen}
        onClose={() => setSelfCardOpen(false)}
        onGoProfile={() => {
          setSelfCardOpen(false);
          onGoProfile();
        }}
      />
    </div>
  );
}
