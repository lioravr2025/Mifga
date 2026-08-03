import type { Friend, HazardReport, LatLng, UserProfile } from "../types";
import { jitter } from "../lib/geo";

// Tel Aviv - Ibn Gvirol / Ben Gurion area, matching the design reference.
// Used as the fallback center when geolocation permission isn't granted
// (e.g. first run in a desktop browser).
export const DEFAULT_CENTER: LatLng = { lat: 32.0853, lng: 34.7818 };

export const DEMO_USER: UserProfile = {
  id: "me",
  name: "לביא",
  avatarEmoji: "🧑",
  points: 0,
  reportsCount: 0,
  reportsWithPhoto: 0,
  createdAt: Date.now(),
};

const now = Date.now();

export function seedHazards(center: LatLng = DEFAULT_CENTER): HazardReport[] {
  const defs: { type: HazardReport["type"]; minsAgo: number; photo: boolean }[] = [
    { type: "police", minsAgo: 4, photo: false },
    { type: "inspector", minsAgo: 12, photo: true },
    { type: "pothole", minsAgo: 40, photo: false },
    { type: "car", minsAgo: 8, photo: false },
    { type: "sidewalk", minsAgo: 90, photo: true },
    { type: "accident", minsAgo: 25, photo: true },
    { type: "roadwork", minsAgo: 180, photo: false },
  ];
  return defs.map((d, i) => ({
    id: `seed-${i}`,
    type: d.type,
    position: jitter(center, 550),
    createdAt: now - d.minsAgo * 60_000,
    reporterId: `demo-${i}`,
    reporterName: DEMO_FRIENDS[i % DEMO_FRIENDS.length]?.name ?? "משתמש מפגע",
    hasPhoto: d.photo,
    confirmations: Math.floor(Math.random() * 6),
    denials: Math.floor(Math.random() * 2),
  }));
}

export const DEMO_FRIENDS: Friend[] = [
  {
    id: "f1",
    name: "נועה",
    username: "noa_g",
    avatarEmoji: "👧",
    online: true,
    points: 340,
    reportsCount: 61,
    riding: true,
    position: jitter(DEFAULT_CENTER, 700),
    shareLocation: true,
    allowWalkie: true,
    lastSeenAt: now,
  },
  {
    id: "f2",
    name: "יונתן",
    username: "yonatan_r",
    avatarEmoji: "🧑‍🦱",
    online: true,
    points: 215,
    reportsCount: 39,
    riding: false,
    position: jitter(DEFAULT_CENTER, 900),
    shareLocation: true,
    allowWalkie: true,
    lastSeenAt: now - 3 * 60_000,
  },
  {
    id: "f3",
    name: "מאיה",
    username: "maya.b",
    avatarEmoji: "👩",
    online: false,
    points: 512,
    reportsCount: 94,
    riding: false,
    position: jitter(DEFAULT_CENTER, 1100),
    shareLocation: true,
    allowWalkie: false,
    lastSeenAt: now - 3 * 60 * 60_000,
  },
  {
    id: "f4",
    name: "עידו",
    username: "ido_k",
    avatarEmoji: "🧔",
    online: true,
    points: 88,
    reportsCount: 14,
    riding: false,
    position: jitter(DEFAULT_CENTER, 400),
    shareLocation: false,
    allowWalkie: true,
    lastSeenAt: now - 45 * 60_000,
  },
];
