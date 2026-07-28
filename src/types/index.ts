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
  phone?: string;
  /** unique handle used for friend search - checked for uniqueness against friends locally, see lib/username.ts */
  username?: string;
  /** 4-digit code shown once at signup - lets the rider recover this account (phone + code) after a reinstall */
  recoveryCode?: string;
}

export interface Friend {
  id: string;
  name: string;
  username: string;
  avatarEmoji: string;
  /** uploaded profile photo URL - only set in backend mode; falls back to avatarEmoji everywhere when absent */
  avatarPhoto?: string;
  online: boolean;
  points: number;
  position: LatLng;
  shareLocation: boolean;
  allowWalkie: boolean;
  /** epoch ms of last activity - shown as "מחובר עכשיו" / "לפני X דק'" */
  lastSeenAt: number;
  /** starred for the home-screen quick row - capped at MAX_FAVORITE_FRIENDS */
  favorite?: boolean;
  /** id of the underlying `friendships` row - only set in backend mode, needed to call the favorite/respond RPCs */
  friendshipId?: string;
}

/** A pending friend request someone else sent me - backend mode only. */
export interface IncomingFriendRequest {
  friendshipId: string;
  fromUid: string;
  fromName: string;
  fromUsername: string;
  fromAvatarEmoji: string;
  fromAvatarPhoto?: string;
  createdAt: number;
}

/** A pending invite to join a WalkieGroup - backend mode only. */
export interface IncomingGroupInvite {
  groupId: string;
  groupName: string;
  invitedAt: number;
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
  /** URL of the recorded voice clip - only set in backend mode (local mode never persists audio) */
  audioUrl?: string;
  /** profile id of whoever sent it - backend mode only, used to skip auto-play/receipt-marking on your own outgoing message */
  senderId?: string;
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
  /** "limited" = free tier (3/day), "unlimited" is a locked paid feature not yet purchasable in this prototype */
  notifyDailyLimit: NotifyDailyLimit;
  /** how close a hazard needs to be, in meters, to trigger an audio alert during an active ride - alerts only fire while riding, never just from having hazards nearby on the map */
  rideAlertRadiusM: number;
  /** once the walkie-talkie tip on the Friends screen is dismissed, it stays gone */
  walkieTipDismissed: boolean;
}

export interface RideLogEntry {
  id: string;
  startedAt: number;
  endedAt: number;
  /** count of distinct hazards that triggered a beep alert during this ride */
  hazardsAvoided: number;
  /** sparse breadcrumb trail sampled during the ride, for redrawing the route afterward - may be empty for very short rides */
  path?: LatLng[];
}

export interface FeedbackEntry {
  id: string;
  liked: boolean;
  note: string;
  submittedAt: number;
}
