import type { LatLng } from "../types";

/** Haversine distance in meters between two coordinates. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Small random jitter around a center point, for seeding demo hazards/friends. */
export function jitter(center: LatLng, maxMeters: number): LatLng {
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((center.lat * Math.PI) / 180);
  const dLat = ((Math.random() - 0.5) * 2 * maxMeters) / metersPerDegLat;
  const dLng = ((Math.random() - 0.5) * 2 * maxMeters) / metersPerDegLng;
  return { lat: center.lat + dLat, lng: center.lng + dLng };
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} מ׳`;
  return `${(m / 1000).toFixed(1)} ק"מ`;
}

export function timeAgo(ts: number): string {
  const diffS = Math.floor((Date.now() - ts) / 1000);
  if (diffS < 60) return "עכשיו";
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `לפני ${diffM} דק'`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `לפני ${diffH} שע'`;
  const diffD = Math.floor(diffH / 24);
  return `לפני ${diffD} ימים`;
}
