import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { rideAlertKind } from "../data/hazardTypes";
import { distanceMeters } from "../lib/geo";
import { playRideAlert, primeRideAudio } from "../lib/sound";
import { speak } from "../lib/speech";
import { isBackendConfigured } from "../lib/supabaseClient";
import { setRidingStatus } from "../lib/backend/friends";
import { startBackgroundRide, stopBackgroundRide } from "../lib/backgroundRide";
import { fetchMyGoingMeetups, type GoingMeetup } from "../lib/backend/meetups";
import type { HazardReport, LatLng } from "../types";

// Sample the route sparsely (not on every position update) so a long ride
// doesn't build a huge array - a point roughly every 15m moved or 8s elapsed
// is plenty to redraw a recognizable route afterward.
const PATH_MIN_DISTANCE_M = 15;
const PATH_MIN_INTERVAL_MS = 8000;

// "Is the rider actually moving" - net displacement over a rolling window,
// not a single-sample speed check, since GPS jitter alone (5-15m, even
// stationary) can look like movement in one hop but cancels out over time.
// A real ride covers this distance in well under the window even at walking
// pace, so this stays a cheap, false-positive-resistant gate for the
// one-tap police/inspector quick-add (which skips confirmation entirely).
const MOTION_WINDOW_MS = 12_000;
const MOTION_MIN_DISPLACEMENT_M = 20;

// A single GPS jump implying a wildly unrealistic speed (signal bouncing off
// a building, a cold-fix snap) shouldn't count toward the average or spike
// the max - same outlier bar the admin dashboard already applies when it
// derives speed from a path after the fact.
const SPEED_OUTLIER_KMH = 80;

// Both of these are passive "just walk/ride up to it" rewards, independent
// of whether a ride is active - a fixed radius regardless of the (much
// wider, user-configurable) ride hazard alert radius, as close as GPS
// accuracy reasonably allows.
const PRIZE_COLLECT_RADIUS_M = 50;
const MEETUP_ARRIVAL_RADIUS_M = 50;
// A meetup with no ends_at is treated as "still arrivable" for this long
// after it started, so a late arrival still counts without needing an
// explicit end time set by the host.
const MEETUP_ARRIVAL_FALLBACK_WINDOW_MS = 6 * 60 * 60_000;
const GOING_MEETUPS_REFRESH_MS = 3 * 60_000;

/**
 * Drives the "active ride" beep-alert loop: while a ride is on, every time
 * the live position updates we check distance to every hazard and play a
 * type-specific beep the first time one enters the configured radius, so a
 * rider can tell police/inspector/other-hazard apart by ear while moving,
 * without looking at the phone. Also samples a breadcrumb trail of the route
 * so it can be redrawn afterward in the ride log. Lives at the App level
 * (not inside a screen) so it keeps running no matter which tab is open.
 */
export interface RideMonitor {
  rideActive: boolean;
  startRide: () => void;
  stopRide: () => void;
  /** the hazard currently up for a Waze-style "is it still there?" prompt, one at a time even if several triggered close together */
  pendingConfirmHazard: HazardReport | null;
  resolvePendingConfirm: () => void;
  /** net GPS displacement over the last few seconds clears a minimum bar - gates the one-tap quick-add so it can't fire while stopped */
  isMoving: boolean;
}

export function useRideMonitor(position: LatLng): RideMonitor {
  const { hazards, prizes, collectPrize, settings, addRideLogEntry, user, awardMeetupArrivalPoints } = useApp();
  const [rideActive, setRideActive] = useState(false);
  const [pendingConfirmHazard, setPendingConfirmHazard] = useState<HazardReport | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());
  const confirmQueueRef = useRef<HazardReport[]>([]);
  // null (not 0) so "no ride running" is unambiguous - 0 is a valid (if
  // absurd) timestamp and using it as the sentinel risked a falsy-check bug.
  const startedAtRef = useRef<number | null>(null);
  const pathRef = useRef<LatLng[]>([]);
  const lastSampleRef = useRef<{ pos: LatLng; at: number } | null>(null);
  const motionSamplesRef = useRef<{ pos: LatLng; at: number }[]>([]);
  // Set the first moment motion is actually confirmed this ride (not the
  // button-press moment) - null means "pressed start but never moved", which
  // stopRide() treats as nothing to log at all, so a rider who starts the
  // timer standing in their driveway doesn't pollute "popular riding hours"
  // or average-speed analytics with dead time.
  const realRideStartedAtRef = useRef<number | null>(null);
  const lastRawPositionRef = useRef<{ pos: LatLng; at: number } | null>(null);
  const speedStatsRef = useRef<{ totalDistanceM: number; totalTimeMs: number; maxKmh: number }>({
    totalDistanceM: 0,
    totalTimeMs: 0,
    maxKmh: 0,
  });
  const collectedPrizeIdsRef = useRef<Set<string>>(new Set());
  const goingMeetupsRef = useRef<GoingMeetup[]>([]);
  const arrivedMeetupIdsRef = useRef<Set<string>>(new Set());

  const resolvePendingConfirm = () => {
    confirmQueueRef.current.shift();
    setPendingConfirmHazard(confirmQueueRef.current[0] ?? null);
  };

  useEffect(() => {
    if (!rideActive) return;
    for (const h of hazards) {
      if (alertedRef.current.has(h.id)) continue;
      if (distanceMeters(position, h.position) <= settings.rideAlertRadiusM) {
        alertedRef.current.add(h.id);
        playRideAlert(rideAlertKind(h.type));
        confirmQueueRef.current.push(h);
        setPendingConfirmHazard((cur) => cur ?? h);
      }
    }

    const last = lastSampleRef.current;
    const now = Date.now();
    if (!last || distanceMeters(last.pos, position) >= PATH_MIN_DISTANCE_M || now - last.at >= PATH_MIN_INTERVAL_MS) {
      pathRef.current.push(position);
      lastSampleRef.current = { pos: position, at: now };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, rideActive, hazards, settings.rideAlertRadiusM]);

  useEffect(() => {
    if (!rideActive) {
      motionSamplesRef.current = [];
      setIsMoving(false);
      return;
    }
    const now = Date.now();
    const samples = motionSamplesRef.current;
    samples.push({ pos: position, at: now });
    while (samples.length > 1 && now - samples[0].at > MOTION_WINDOW_MS) samples.shift();
    const moving = samples.length > 1 && distanceMeters(samples[0].pos, position) >= MOTION_MIN_DISPLACEMENT_M;
    setIsMoving(moving);
    if (moving && realRideStartedAtRef.current === null) {
      realRideStartedAtRef.current = now;
      lastRawPositionRef.current = { pos: position, at: now };
    }
  }, [position, rideActive]);

  // Speed, computed from consecutive raw GPS samples (distance/time) rather
  // than relying on the device's own coords.speed - that field is null on
  // plenty of real phones/webviews, while a plain delta between two fixes
  // works identically everywhere. Only accumulates once motion is actually
  // confirmed, for the same reason the logged start time waits for it too.
  useEffect(() => {
    if (!rideActive || realRideStartedAtRef.current === null) return;
    const last = lastRawPositionRef.current;
    const now = Date.now();
    if (last) {
      const dtMs = now - last.at;
      const dM = distanceMeters(last.pos, position);
      if (dtMs > 0) {
        const kmh = dM / 1000 / (dtMs / 3_600_000);
        if (isFinite(kmh) && kmh > 0 && kmh <= SPEED_OUTLIER_KMH) {
          const stats = speedStatsRef.current;
          stats.totalDistanceM += dM;
          stats.totalTimeMs += dtMs;
          stats.maxKmh = Math.max(stats.maxKmh, kmh);
        }
      }
    }
    lastRawPositionRef.current = { pos: position, at: now };
  }, [position, rideActive]);

  // Prize auto-collect: passive, works anytime (not just while riding) -
  // roaming near a prize on foot is just as valid as riding past it.
  useEffect(() => {
    for (const p of prizes) {
      if (collectedPrizeIdsRef.current.has(p.id)) continue;
      if (distanceMeters(position, p.position) <= PRIZE_COLLECT_RADIUS_M) {
        collectedPrizeIdsRef.current.add(p.id);
        collectPrize(p.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, prizes]);

  // Meetup arrival: periodically refresh which RSVP'd meetups are happening
  // roughly now, then just watch GPS distance to each - same passive,
  // ride-independent shape as prize collection above.
  useEffect(() => {
    if (!isBackendConfigured || !user.id) return;
    let cancelled = false;
    const refresh = () => {
      fetchMyGoingMeetups(user.id)
        .then((list) => {
          if (!cancelled) goingMeetupsRef.current = list;
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, GOING_MEETUPS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user.id]);

  useEffect(() => {
    if (!isBackendConfigured) return;
    const now = Date.now();
    for (const m of goingMeetupsRef.current) {
      if (arrivedMeetupIdsRef.current.has(m.id)) continue;
      const windowEnd = m.endsAt ?? m.startsAt + MEETUP_ARRIVAL_FALLBACK_WINDOW_MS;
      if (now < m.startsAt || now > windowEnd) continue;
      if (distanceMeters(position, m.position) <= MEETUP_ARRIVAL_RADIUS_M) {
        arrivedMeetupIdsRef.current.add(m.id);
        awardMeetupArrivalPoints(m.id);
      }
    }
  }, [position, awardMeetupArrivalPoints]);

  const startRide = () => {
    if (startedAtRef.current !== null) return; // already running - ignore a duplicate start
    primeRideAudio(); // called from the click handler - a real user gesture
    speak("יוצאים לדרך", settings.voiceURI);
    alertedRef.current.clear();
    confirmQueueRef.current = [];
    setPendingConfirmHazard(null);
    pathRef.current = [position];
    lastSampleRef.current = { pos: position, at: Date.now() };
    motionSamplesRef.current = [];
    setIsMoving(false);
    realRideStartedAtRef.current = null;
    lastRawPositionRef.current = null;
    speedStatsRef.current = { totalDistanceM: 0, totalTimeMs: 0, maxKmh: 0 };
    startedAtRef.current = Date.now();
    setRideActive(true);
    if (isBackendConfigured && user.id) {
      setRidingStatus(user.id, true).catch(() => {});
      startBackgroundRide(user.id, settings.rideAlertRadiusM);
    }
  };

  const stopRide = () => {
    if (startedAtRef.current === null) return; // nothing running - ignore a duplicate stop
    startedAtRef.current = null;
    setRideActive(false);
    if (pathRef.current[pathRef.current.length - 1] !== position) pathRef.current.push(position);

    // Only log a ride at all if motion was actually confirmed at some point -
    // start-then-immediately-stop with zero movement (e.g. pressed at home)
    // isn't a real ride and shouldn't show up in the rider's history or the
    // admin "popular hours"/speed analytics.
    const realStartedAt = realRideStartedAtRef.current;
    if (realStartedAt !== null) {
      const stats = speedStatsRef.current;
      const avgSpeedKmh = stats.totalTimeMs > 0 ? stats.totalDistanceM / 1000 / (stats.totalTimeMs / 3_600_000) : undefined;
      addRideLogEntry({
        startedAt: realStartedAt,
        endedAt: Date.now(),
        hazardsAvoided: alertedRef.current.size,
        path: pathRef.current,
        avgSpeedKmh,
        maxSpeedKmh: stats.maxKmh > 0 ? stats.maxKmh : undefined,
      });
    }

    if (isBackendConfigured && user.id) setRidingStatus(user.id, false).catch(() => {});
    stopBackgroundRide();
    confirmQueueRef.current = [];
    setPendingConfirmHazard(null);
  };

  return { rideActive, startRide, stopRide, pendingConfirmHazard, resolvePendingConfirm, isMoving };
}
