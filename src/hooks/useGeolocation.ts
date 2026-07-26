import { useEffect, useState } from "react";
import type { LatLng } from "../types";
import { DEFAULT_CENTER } from "../data/mockData";

interface GeoState {
  position: LatLng;
  accuracy: number | null;
  status: "prompt" | "granted" | "denied" | "unsupported";
}

/**
 * Wraps the browser Geolocation API. Falls back to DEFAULT_CENTER (Tel Aviv)
 * whenever permission is denied or unavailable (e.g. desktop dev, no HTTPS)
 * so the map always has something sensible to center on.
 */
export function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>({
    position: DEFAULT_CENTER,
    accuracy: null,
    status: "prompt",
  });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState((s) => ({ ...s, status: "unsupported" }));
      return;
    }

    // A rough network/cell-based fix usually comes back in under a second,
    // long before GPS locks on - use it to get off the hardcoded Tel Aviv
    // default quickly, while the accurate watch below keeps refining it.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState((s) =>
          s.status === "granted"
            ? s
            : { position: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracy: pos.coords.accuracy, status: "granted" }
        );
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          status: "granted",
        });
      },
      () => {
        setState((s) => ({ ...s, status: "denied" }));
      },
      // A fresh install has no cached GPS fix yet ("cold start"), which can
      // genuinely take 15-20s+ with enableHighAccuracy - 8s was too eager to
      // give up, leaving `position` stuck at the Tel Aviv fallback (the error
      // callback never updates position, only `status`) until some later
      // watch tick happened to succeed.
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 25_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
