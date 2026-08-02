import { useEffect, useRef, useState } from "react";
import { distanceMeters } from "../lib/geo";
import type { RouteStep } from "../lib/googleRouting";
import type { LatLng } from "../types";

// Same forward-only proximity-tracking logic as useTurnByTurn.ts, retargeted
// at googleRouting.ts's simpler RouteStep shape (Google's own instructions
// text needs no maneuver-type translation table, unlike the OSRM version).
const ARRIVAL_THRESHOLD_M = 25;

export interface TurnByTurnState {
  activeIndex: number;
  upcoming: RouteStep | null;
  distanceToUpcomingM: number;
  isArrived: boolean;
}

export function useGoogleTurnByTurn(position: LatLng, steps: RouteStep[]): TurnByTurnState {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepsRef = useRef(steps);

  useEffect(() => {
    if (stepsRef.current !== steps) {
      stepsRef.current = steps;
      setActiveIndex(0);
    }
  }, [steps]);

  useEffect(() => {
    if (steps.length === 0) return;
    setActiveIndex((idx) => {
      let next = idx;
      while (next < steps.length - 1 && distanceMeters(position, steps[next + 1].location) <= ARRIVAL_THRESHOLD_M) {
        next++;
      }
      return next;
    });
  }, [position, steps]);

  if (steps.length === 0) {
    return { activeIndex: 0, upcoming: null, distanceToUpcomingM: 0, isArrived: false };
  }

  const isArrived = activeIndex >= steps.length - 1;
  const upcoming = isArrived ? steps[steps.length - 1] : steps[activeIndex + 1];
  const distanceToUpcomingM = distanceMeters(position, upcoming.location);

  return { activeIndex, upcoming, distanceToUpcomingM, isArrived };
}
