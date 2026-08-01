import { useEffect, useRef, useState } from "react";
import { distanceMeters } from "../lib/geo";
import type { RouteStep } from "../lib/routing";
import type { LatLng } from "../types";

// Close enough to a maneuver point to consider it "passed" and advance to
// the next instruction - GPS while riding is noisy enough that waiting for
// an exact hit would leave the banner stuck one turn behind.
const ARRIVAL_THRESHOLD_M = 25;

export interface TurnByTurnState {
  /** the step whose road you're currently on - steps[activeIndex + 1] is the upcoming maneuver to announce */
  activeIndex: number;
  /** the next maneuver to perform, or the arrival step once there's nothing left */
  upcoming: RouteStep | null;
  distanceToUpcomingM: number;
  isArrived: boolean;
}

/**
 * Tracks progress through a route's turn-by-turn steps as the live position
 * updates - advances forward only (never back), and can skip more than one
 * step at once if the rider passed several maneuvers between GPS fixes
 * (sparse updates, a fast scooter). No map-matching: a rider who goes
 * off-route entirely just stops advancing until they re-approach the
 * planned path, same limitation the underlying OSRM route itself has.
 */
export function useTurnByTurn(position: LatLng, steps: RouteStep[]): TurnByTurnState {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepsRef = useRef(steps);

  useEffect(() => {
    // A new route (different steps array) resets progress from the top.
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
