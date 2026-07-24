import type { LatLng } from "../types";

// Free, keyless public services used only for this local prototype:
// - Nominatim for geocoding a typed destination into coordinates
// - OSRM's public demo router for turn-by-turn driving routes
// Swap both for Google Geocoding + Directions API when porting to
// production, to stay consistent with the Google Maps base layer.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

export interface RouteResult {
  points: LatLng[];
  distanceM: number;
  durationS: number;
}

export async function geocode(query: string, biasNear: LatLng): Promise<LatLng | null> {
  const url = `${NOMINATIM_URL}?format=json&q=${encodeURIComponent(query)}&limit=1&viewbox=${biasNear.lng - 0.3},${biasNear.lat + 0.3},${
    biasNear.lng + 0.3
  },${biasNear.lat - 0.3}&bounded=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const url = `${OSRM_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) return null;
  const coords: [number, number][] = route.geometry.coordinates;
  return {
    points: coords.map(([lng, lat]) => ({ lat, lng })),
    distanceM: route.distance,
    durationS: route.duration,
  };
}

/** Perpendicular-ish distance in meters from a point to the nearest vertex of a polyline (good enough at this scale). */
export function minDistanceToPath(point: LatLng, path: LatLng[]): number {
  let min = Infinity;
  for (const p of path) {
    const d = haversine(point, p);
    if (d < min) min = d;
  }
  return min;
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
