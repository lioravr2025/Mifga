import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { rideAlertKind } from "../data/hazardTypes";
import { distanceMeters } from "../lib/geo";
import { playRideAlert, primeRideAudio } from "../lib/sound";
import { isBackendConfigured } from "../lib/supabaseClient";
import { setRidingStatus } from "../lib/backend/friends";
import type { LatLng } from "../types";

// Sample the route sparsely (not on every position update) so a long ride
// doesn't build a huge array - a point roughly every 15m moved or 8s elapsed
// is plenty to redraw a recognizable route afterward.
const PATH_MIN_DISTANCE_M = 15;
const PATH_MIN_INTERVAL_MS = 8000;

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
}

export function useRideMonitor(position: LatLng): RideMonitor {
  const { hazards, settings, addRideLogEntry, user } = useApp();
  const [rideActive, setRideActive] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());
  // null (not 0) so "no ride running" is unambiguous - 0 is a valid (if
  // absurd) timestamp and using it as the sentinel risked a falsy-check bug.
  const startedAtRef = useRef<number | null>(null);
  const pathRef = useRef<LatLng[]>([]);
  const lastSampleRef = useRef<{ pos: LatLng; at: number } | null>(null);

  useEffect(() => {
    if (!rideActive) return;
    for (const h of hazards) {
      if (alertedRef.current.has(h.id)) continue;
      if (distanceMeters(position, h.position) <= settings.rideAlertRadiusM) {
        alertedRef.current.add(h.id);
        playRideAlert(rideAlertKind(h.type));
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

  const startRide = () => {
    if (startedAtRef.current !== null) return; // already running - ignore a duplicate start
    primeRideAudio(); // called from the click handler - a real user gesture
    alertedRef.current.clear();
    pathRef.current = [position];
    lastSampleRef.current = { pos: position, at: Date.now() };
    startedAtRef.current = Date.now();
    setRideActive(true);
    if (isBackendConfigured && user.id) setRidingStatus(user.id, true).catch(() => {});
  };

  const stopRide = () => {
    if (startedAtRef.current === null) return; // nothing running - ignore a duplicate stop
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    setRideActive(false);
    if (pathRef.current[pathRef.current.length - 1] !== position) pathRef.current.push(position);
    addRideLogEntry({ startedAt, endedAt: Date.now(), hazardsAvoided: alertedRef.current.size, path: pathRef.current });
    if (isBackendConfigured && user.id) setRidingStatus(user.id, false).catch(() => {});
  };

  return { rideActive, startRide, stopRide };
}
