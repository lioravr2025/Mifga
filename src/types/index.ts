// Core domain types for Mifga.
// Kept platform-agnostic (no DOM/Capacitor types) so this file can be shared
// as-is when a native (iOS) client or a future backend gets added.

export type HazardTypeId =
  | "police"
  | "inspector"
  | "pothole"
  | "car"
  | "sidewalk"
  | "camera"
  | "accident"
  | "roadwork"
  | "closure"
  | "flood"
  | "animal";

export interface HazardTypeDef {
  id: HazardTypeId;
  label: string;
  /** lucide-react icon name, resolved in HazardIcon.tsx */
  icon: string;
  color: string; // tailwind color token key used for the marker glow
  /** hazards flagged as high-priority get a pulsing marker + push priority */
  highPriority?: boolean;
  /** shown in the primary quick-report grid; the rest live behind "עוד" */
  primary?: boolean;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface HazardReport {
  id: string;
  type: HazardTypeId;
  position: LatLng;
  createdAt: number;
  reporterId: string;
  reporterName: string;
  hasPhoto: boolean;
  photoDataUrl?: string;
  confirmations: number; // "still there" votes
  denials: number; // "not there anymore" votes
  /** once denials reaches REMOVAL_THRESHOLD the hazard is filtered out */
  removed?: boolean;
  /** optional nickname for a specific police/inspector hazard, e.g. a description that helps friends recognize them */
  nickname?: string;
  /** epoch ms of the last "still there" / "not there" vote, shown as "last like" */
  lastVoteAt?: number;
}

export type VehicleTypeId = "scooter" | "ebike" | "emotorcycle";

export interface UserProfile {
  id: string;
  name: string;
  avatarEmoji: string;
  /** data URL of an uploaded photo; when set it's shown instead of avatarEmoji */
  avatarPhoto?: string;
  points: number;
  reportsCount: number;
  reportsWithPhoto: number;
  createdAt: number;
  vehicleType?: VehicleTypeId;
  vehicleModel?: string;
}

export interface Friend {
  id: string;
  name: string;
  avatarEmoji: string;
  online: boolean;
  points: number;
  position: LatLng;
  shareLocation: boolean;
  allowWalkie: boolean;
  /** epoch ms of last activity - shown as "מחובר עכשיו" / "לפני X דק'" */
  lastSeenAt: number;
  /** starred for the home-screen quick row - capped at MAX_FAVORITE_FRIENDS */
  favorite?: boolean;
}

/** Membership status of a friend inside a WalkieGroup - joining requires their approval. */
export type GroupMemberStatus = "pending" | "accepted";

export interface GroupMessageReceipt {
  friendId: string;
  deliveredAt: number | null; // null until delivery is simulated/confirmed
}

export interface GroupMessage {
  id: string;
  sentAt: number;
  receipts: GroupMessageReceipt[];
}

export interface WalkieGroup {
  id: string;
  name: string;
  createdAt: number;
  members: { friendId: string; status: GroupMemberStatus }[];
  messages: GroupMessage[];
}

export type ThemeMode = "dark" | "light";

export interface NotifyTypePrefs {
  police: boolean;
  inspector: boolean;
  other: boolean;
}

export type NotifyDailyLimit = "limited" | "unlimited";

export interface AppSettings {
  theme: ThemeMode;
  notificationsEnabled: boolean;
  notifyTypes: NotifyTypePrefs;
  notifyRadiusM: number;
  /** "limited" = free tier (3/day), "unlimited" is a locked paid feature not yet purchasable in this prototype */
  notifyDailyLimit: NotifyDailyLimit;
}
