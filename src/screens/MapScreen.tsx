import { useEffect, useState } from "react";
import { Locate, Mic, Plus, Square, Star } from "lucide-react";
import MapView from "../components/MapView";
import TopBar from "../components/TopBar";
import ReportFlow from "../components/ReportFlow";
import HazardDetailSheet from "../components/HazardDetailSheet";
import MyProfileCard from "../components/MyProfileCard";
import PointsToast from "../components/PointsToast";
import Confetti from "../components/Confetti";
import { HazardIcon } from "../components/HazardIcon";
import { PRIMARY_HAZARD_TYPES } from "../data/hazardTypes";
import { HAZARD_COLOR_HEX } from "../lib/colors";
import { useGeolocation } from "../hooks/useGeolocation";
import { useWalkieRecorder } from "../hooks/useWalkieRecorder";
import { useApp } from "../context/AppContext";
import type { HazardTypeId, LatLng } from "../types";

export default function MapScreen({
  onGoRoute,
  onGoFriends,
  onGoProfile,
  onOpenSettings,
  focusFriendId,
  onConsumeFocusFriend,
}: {
  onGoRoute: () => void;
  onGoFriends: () => void;
  onGoProfile: () => void;
  onOpenSettings: () => void;
  focusFriendId: string | null;
  onConsumeFocusFriend: () => void;
}) {
  const { position } = useGeolocation();
  const { hazards, friends, settings, lastAwardedPoints, clearLastAwarded } = useApp();
  const friendsInMotionCount = friends.filter((f) => f.online && f.shareLocation).length;
  const favoriteFriends = friends.filter((f) => f.favorite);

  const [reportOpen, setReportOpen] = useState(false);
  const [presetType, setPresetType] = useState<HazardTypeId | null>(null);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [selfCardOpen, setSelfCardOpen] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [cameraTarget, setCameraTarget] = useState<LatLng | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [pickedCenter, setPickedCenter] = useState<LatLng | null>(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [walkieSentLabel, setWalkieSentLabel] = useState<string | null>(null);

  const openReport = (type?: HazardTypeId) => {
    setPresetType(type ?? null);
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

  const { recordingFor, start: startWalkie, stop: stopWalkie } = useWalkieRecorder((friendId) => {
    const friend = friends.find((f) => f.id === friendId);
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
          friends={friends}
          showFriends
          theme={settings.theme}
          onSelectHazard={(h) => setSelectedHazardId(h.id)}
          onSelectSelf={() => setSelfCardOpen(true)}
          pickingLocation={isPicking}
          onPickedCenterChange={setPickedCenter}
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
          onMenu={onOpenSettings}
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

        <PointsToast points={lastAwardedPoints} onDone={clearLastAwarded} />
        <Confetti trigger={confettiTrigger} />
      </div>

      {!isPicking && (
        <div className="shrink-0 bg-bg-panel border-t border-bg-border px-4 pt-3 pb-2">
          <div className="flex flex-col items-center -mt-9 mb-2">
            <span className="text-[11px] text-neutral-400 mb-1">דיווח בקליק!</span>
            <button
              onClick={() => openReport()}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-brand to-brand-light flex items-center justify-center shadow-glow shadow-brand border-4 border-bg-panel active:scale-95 transition"
            >
              <Plus size={26} className="text-white" strokeWidth={2.6} />
            </button>
            <span className="text-sm font-bold text-neutral-50 mt-1">דווח מפגע</span>
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
            <button onClick={() => openReport()} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
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
            <button
              onClick={onGoFriends}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-bg-panel2 border border-dashed border-bg-border text-neutral-400 text-sm active:scale-[0.98] transition"
            >
              <Star size={16} />
              <span>סמנו עד 3 חברים מועדפים בטאב חברים כדי לראות אותם כאן</span>
            </button>
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
                        <span className="w-8 h-8 rounded-full bg-bg-panel border border-bg-border flex items-center justify-center text-base">
                          {f.avatarEmoji}
                        </span>
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
                        onTouchStart={() => startWalkie(f.id)}
                        onTouchEnd={() => recording && stopWalkie(f.id)}
                        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center border active:scale-95 transition ${
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
      )}

      <ReportFlow
        open={reportOpen}
        userPosition={position}
        onClose={() => setReportOpen(false)}
        onStartPicking={() => setIsPicking(true)}
        onStopPicking={() => setIsPicking(false)}
        pickedCenter={pickedCenter}
        isPicking={isPicking}
        initialType={presetType}
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
