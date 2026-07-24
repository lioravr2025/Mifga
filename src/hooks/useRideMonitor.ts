import { useEffect, useRef, useState } from "react";
import { useApp } from "../context/AppContext";
import { rideAlertKind } from "../data/hazardTypes";
import { distanceMeters } from "../lib/geo";
import { playRideAlert, primeRideAudio } from "../lib/sound";
import type { LatLng } from "../types";

/**
 * Drives the "active ride" beep-alert loop: while a ride is on, every time
 * the live position updates we check distance to every hazard and play a
 * type-specific beep the first time one enters the configured radius, so a
 * rider can tell police/inspector/other-hazard apart by ear while moving,
 * without looking at the phone. Lives at the App level (not inside a screen)
 * so it keeps running no matter which tab is open.
 */
export interface RideMonitor {
  rideActive: boolean;
  startRide: () => void;
  stopRide: () => void;
}

export function useRideMonitor(position: LatLng): RideMonitor {
  const { hazards, settings, addRideLogEntry } = useApp();
  const [rideActive, setRideActive] = useState(false);
  const alertedRef = useRef<Set<string>>(new Set());
  // null (not 0) so "no ride running" is unambiguous - 0 is a valid (if
  // absurd) timestamp and using it as the sentinel risked a falsy-check bug.
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!rideActive) return;
    for (const h of hazards) {
      if (alertedRef.current.has(h.id)) continue;
      if (distanceMeters(position, h.position) <= settings.rideAlertRadiusM) {
        alertedRef.current.add(h.id);
        playRideAlert(rideAlertKind(h.type));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, rideActive, hazards, settings.rideAlertRadiusM]);

  const startRide = () => {
    if (startedAtRef.current !== null) return; // already running - ignore a duplicate start
    primeRideAudio(); // called from the click handler - a real user gesture
    alertedRef.current.clear();
    startedAtRef.current = Date.now();
    setRideActive(true);
  };

  const stopRide = () => {
    if (startedAtRef.current === null) return; // nothing running - ignore a duplicate stop
    const startedAt = startedAtRef.current;
    startedAtRef.current = null;
    setRideActive(false);
    addRideLogEntry({ startedAt, endedAt: Date.now(), hazardsAvoided: alertedRef.current.size });
  };

  return { rideActive, startRide, stopRide };
}
