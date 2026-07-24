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
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 8000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
