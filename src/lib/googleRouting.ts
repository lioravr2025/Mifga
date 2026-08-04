import type { LatLng, VehicleTypeId } from "../types";

// Google Maps experiment equivalent of routing.ts - swaps OSRM for Google's
// Directions API. Travel mode is BICYCLING on purpose: same reasoning as the
// routed-bike OSRM switch on main - it's the closest built-in Google profile
// that actually excludes motorways/highways (illegal/inappropriate for a
// scooter or e-bike), rather than the DRIVING profile which would happily
// route through them. Directions API also returns turn-by-turn instructions
// already translated into Hebrew (language: "he"), so there's no need for
// our own describeManeuver() translation table like the OSRM version needed.

export interface RouteStep {
  location: LatLng;
  /** Google's own instructions text (HTML stripped), already in Hebrew - use directly, no translation table needed. */
  instruction: string;
  /** e.g. "turn-left", "roundabout-right", "merge", "" for a plain continue - see NavigationBanner's icon map. */
  maneuver: string;
  distanceM: number;
  durationS: number;
}

export interface RouteResult {
  points: LatLng[];
  distanceM: number;
  durationS: number;
  steps: RouteStep[];
}

const AVG_SPEED_KMH: Record<VehicleTypeId, number> = {
  scooter: 17,
  ebike: 20,
  emotorcycle: 32,
};
const DEFAULT_AVG_SPEED_KMH = 18;

/** Same reasoning as routing.ts's estimateDurationS - Google's own duration is tuned for a generic cyclist, not specifically an e-scooter/e-bike. */
export function estimateDurationS(distanceM: number, vehicleType?: VehicleTypeId): number {
  const speedKmh = vehicleType ? AVG_SPEED_KMH[vehicleType] : DEFAULT_AVG_SPEED_KMH;
  return (distanceM / 1000 / speedKmh) * 3600;
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? "";
}

let directionsService: google.maps.DirectionsService | null = null;

export async function fetchGoogleRoute(
  routesLib: google.maps.RoutesLibrary,
  from: LatLng,
  to: LatLng
): Promise<RouteResult | null> {
  if (!directionsService) directionsService = new routesLib.DirectionsService();

  return new Promise((resolve) => {
    directionsService!.route(
      {
        origin: { lat: from.lat, lng: from.lng },
        destination: { lat: to.lat, lng: to.lng },
        travelMode: google.maps.TravelMode.BICYCLING,
        region: "il",
        language: "he",
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.[0]) {
          resolve(null);
          return;
        }
        const route = result.routes[0];
        const points: LatLng[] = [];
        const steps: RouteStep[] = [];
        let distanceM = 0;
        let durationS = 0;

        for (const leg of route.legs) {
          distanceM += leg.distance?.value ?? 0;
          durationS += leg.duration?.value ?? 0;
          for (const step of leg.steps) {
            points.push({ lat: step.start_location.lat(), lng: step.start_location.lng() });
            steps.push({
              location: { lat: step.start_location.lat(), lng: step.start_location.lng() },
              instruction: stripHtml(step.instructions),
              maneuver: step.maneuver ?? "",
              distanceM: step.distance?.value ?? 0,
              durationS: step.duration?.value ?? 0,
            });
            // path is the detailed polyline for this step - denser than just start points, for a smooth drawn route
            for (const p of step.path ?? []) {
              points.push({ lat: p.lat(), lng: p.lng() });
            }
          }
          const lastStep = leg.steps[leg.steps.length - 1];
          if (lastStep) points.push({ lat: lastStep.end_location.lat(), lng: lastStep.end_location.lng() });
        }

        resolve({ points, distanceM, durationS, steps });
      }
    );
  });
}

export function minDistanceToPath(point: LatLng, path: LatLng[]): number {
  let min = Infinity;
  for (const p of path) {
    const d = haversine(point, p);
    if (d < min) min = d;
  }
  return min;
}

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
