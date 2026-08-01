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

async function fetchOsrmRoute(waypoints: LatLng[]): Promise<RouteResult | null> {
  const coordsParam = waypoints.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/${coordsParam}?overview=full&geometries=geojson`;
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

export async function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  return fetchOsrmRoute([from, to]);
}

// How close a hazard has to be to the path before it's worth actually
// bending the route around it (tighter than the UI's "hazards near this
// route" display radius - that one's just informational, this one decides
// whether to spend a detour on it).
const AVOID_TRIGGER_M = 60;
// Real street grids don't always have a parallel road exactly where the
// "geometrically correct" perpendicular offset lands - OSRM will happily
// route back through the same corridor if that's the only nearby option.
// Trying a small spread of side/distance combinations and keeping whichever
// one the actual street network cooperates with is what makes this work in
// practice, not just on paper.
const AVOID_PUSH_VARIANTS_M = [90, 180, 350];
// Only detour around the worst few offenders - trying to dodge every
// hazard within a cluster produces an unusable zigzag, and OSRM's public
// demo server isn't meant for long waypoint lists anyway.
const MAX_DETOUR_WAYPOINTS = 3;

const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(atLat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180);
}

/** Local flat-earth offset in meters - accurate enough at city/route scale, avoids pulling in a full geo-projection library for this. */
function offsetMeters(point: LatLng, dxM: number, dyM: number): LatLng {
  return {
    lat: point.lat + dyM / METERS_PER_DEG_LAT,
    lng: point.lng + dxM / metersPerDegLng(point.lat),
  };
}

function toLocalXY(origin: LatLng, point: LatLng): { x: number; y: number } {
  return {
    x: (point.lng - origin.lng) * metersPerDegLng(origin.lat),
    y: (point.lat - origin.lat) * METERS_PER_DEG_LAT,
  };
}

interface NearbyHazard {
  hazard: LatLng;
  /** the "natural" side to push toward: away from wherever the hazard already sits relative to the path's local heading */
  naturalPerp: { x: number; y: number };
  distM: number;
}

/** Finds hazards close enough to the path to be worth detouring around, with the perpendicular direction (in local meters) that pushes away from each one. */
function findNearbyHazards(path: LatLng[], hazardPositions: LatLng[]): NearbyHazard[] {
  if (path.length < 2) return [];
  const found: NearbyHazard[] = [];

  for (const hazard of hazardPositions) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = haversine(hazard, path[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    if (nearestDist > AVOID_TRIGGER_M) continue;

    const prevIdx = Math.max(0, nearestIdx - 1);
    const nextIdx = Math.min(path.length - 1, nearestIdx + 1);
    if (prevIdx === nextIdx) continue; // path too short to get a heading from

    const origin = path[nearestIdx];
    const a = toLocalXY(origin, path[prevIdx]);
    const b = toLocalXY(origin, path[nextIdx]);
    const headingX = b.x - a.x;
    const headingY = b.y - a.y;
    const headingLen = Math.hypot(headingX, headingY);
    if (headingLen < 1) continue;

    const hazardXY = toLocalXY(origin, hazard);
    // Cross product of heading x (hazard offset) - sign tells which side the hazard is on.
    const cross = headingX * hazardXY.y - headingY * hazardXY.x;
    const side = cross >= 0 ? 1 : -1;
    // Perpendicular to the heading, pointing away from the hazard's side.
    const naturalPerp = { x: (-headingY / headingLen) * -side, y: (headingX / headingLen) * -side };

    found.push({ hazard, naturalPerp, distM: nearestDist });
  }

  // Worst (closest) offenders first, capped - trying to dodge every hazard
  // in a cluster produces an unusable zigzag anyway.
  found.sort((a, b) => a.distM - b.distM);
  return found.slice(0, MAX_DETOUR_WAYPOINTS);
}

function waypointsAlongPath(path: LatLng[], points: LatLng[]): LatLng[] {
  const withIdx = points.map((p) => ({
    p,
    idx: path.reduce((bi, pt, i) => (haversine(p, pt) < haversine(p, path[bi]) ? i : bi), 0),
  }));
  withIdx.sort((a, b) => a.idx - b.idx);
  return withIdx.map((w) => w.p);
}

/**
 * Same as fetchRoute, but dynamically bends the path away from whatever
 * hazards are currently reported near it - "safe route planning" was
 * previously just a label, this is what makes it actually true.
 *
 * OSRM's public demo server has no "avoid area" API, so this works by
 * inserting via-waypoints offset from each nearby hazard and letting OSRM
 * route through them - but a real street grid doesn't always have a usable
 * road exactly where the geometrically "correct" offset lands, so a small
 * spread of side/distance variants is tried in parallel and whichever one
 * the street network actually cooperates with (clears the most hazards,
 * shortest if tied) wins. Never returns something worse than the plain
 * direct route.
 */
export async function planSafeRoute(from: LatLng, to: LatLng, hazardPositions: LatLng[]): Promise<RouteResult | null> {
  const direct = await fetchOsrmRoute([from, to]);
  if (!direct) return null;

  const nearby = findNearbyHazards(direct.points, hazardPositions);
  if (nearby.length === 0) return direct;

  const variants: LatLng[][] = [];
  for (const pushM of AVOID_PUSH_VARIANTS_M) {
    for (const flip of [1, -1]) {
      variants.push(
        waypointsAlongPath(
          direct.points,
          nearby.map((n) => offsetMeters(n.hazard, n.naturalPerp.x * pushM * flip, n.naturalPerp.y * pushM * flip))
        )
      );
    }
  }

  const attempts = await Promise.all(variants.map((wp) => fetchOsrmRoute([from, ...wp, to]).catch(() => null)));
  const countNearby = (route: RouteResult) => hazardPositions.filter((h) => minDistanceToPath(h, route.points) <= AVOID_TRIGGER_M).length;

  let best = direct;
  let bestCount = countNearby(direct);
  for (const candidate of attempts) {
    if (!candidate) continue;
    const count = countNearby(candidate);
    if (count < bestCount || (count === bestCount && candidate.distanceM < best.distanceM && best !== direct)) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
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

/** Distance in meters from the route point nearest the rider's current position to the end of the route - a live "how much is left" figure while a ride along this route is active. */
export function remainingDistanceAlongPath(point: LatLng, path: LatLng[]): number {
  if (path.length === 0) return 0;
  let nearestIdx = 0;
  let nearestDist = Infinity;
  path.forEach((p, i) => {
    const d = haversine(point, p);
    if (d < nearestDist) {
      nearestDist = d;
      nearestIdx = i;
    }
  });
  let remaining = 0;
  for (let i = nearestIdx; i < path.length - 1; i++) remaining += haversine(path[i], path[i + 1]);
  return remaining;
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
