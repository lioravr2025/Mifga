// snake_case row shapes as they come back from Postgres/Supabase, plus
// mappers to/from the camelCase app types in src/types/index.ts. Keeping the
// mapping in one place means AppContext never has to think about column
// naming - it only ever sees HazardReport/UserProfile.
import type { HazardReport, HazardTypeId, Prize, RideLogEntry, UserProfile, VehicleTypeId } from "../../types";

export interface HazardRow {
  id: string;
  type: string;
  lat: number;
  lng: number;
  created_at: string;
  reporter_id: string | null;
  reporter_name: string;
  has_photo: boolean;
  photo_url: string | null;
  confirmations: number;
  denials: number;
  removed: boolean;
  nickname: string | null;
  last_vote_at: string | null;
}

export function hazardFromRow(row: HazardRow): HazardReport {
  return {
    id: row.id,
    type: row.type as HazardTypeId,
    position: { lat: row.lat, lng: row.lng },
    createdAt: new Date(row.created_at).getTime(),
    reporterId: row.reporter_id ?? "",
    reporterName: row.reporter_name,
    hasPhoto: row.has_photo,
    photoDataUrl: row.photo_url ?? undefined,
    confirmations: row.confirmations,
    denials: row.denials,
    removed: row.removed,
    nickname: row.nickname ?? undefined,
    lastVoteAt: row.last_vote_at ? new Date(row.last_vote_at).getTime() : undefined,
  };
}

export interface PrizeRow {
  id: string;
  icon: string;
  icon_image_url: string | null;
  points: number;
  lat: number;
  lng: number;
  collected_at: string | null;
}

export function prizeFromRow(row: PrizeRow): Prize {
  return {
    id: row.id,
    icon: row.icon,
    iconImageUrl: row.icon_image_url ?? undefined,
    points: row.points,
    position: { lat: row.lat, lng: row.lng },
  };
}

export interface ProfileRow {
  id: string;
  name: string;
  username: string;
  avatar_emoji: string;
  avatar_photo_url: string | null;
  points: number;
  reports_count: number;
  reports_with_photo: number;
  vehicle_type: string | null;
  vehicle_model: string | null;
  phone: string | null;
  created_at: string;
  live_lat?: number | null;
  live_lng?: number | null;
  last_active_at?: string | null;
  recovery_code?: string | null;
}

export function profileFromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    avatarEmoji: row.avatar_emoji,
    avatarPhoto: row.avatar_photo_url ?? undefined,
    points: row.points,
    reportsCount: row.reports_count,
    reportsWithPhoto: row.reports_with_photo,
    createdAt: new Date(row.created_at).getTime(),
    vehicleType: (row.vehicle_type as VehicleTypeId | null) ?? undefined,
    vehicleModel: row.vehicle_model ?? undefined,
    phone: row.phone ?? undefined,
    recoveryCode: row.recovery_code ?? undefined,
  };
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  favorite_by_requester: boolean;
  favorite_by_addressee: boolean;
  created_at: string;
}

export interface WalkieGroupRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WalkieGroupMemberRow {
  group_id: string;
  member_id: string;
  status: "pending" | "accepted";
}

export interface WalkieGroupMessageRow {
  id: string;
  group_id: string;
  sender_id: string;
  sent_at: string;
  audio_url: string;
}

export interface WalkieGroupMessageReceiptRow {
  message_id: string;
  member_id: string;
  delivered_at: string | null;
}

export interface RideLogRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  hazards_avoided: number;
  path: { lat: number; lng: number }[] | null;
}

export function rideLogFromRow(row: RideLogRow): RideLogEntry {
  return {
    id: row.id,
    startedAt: new Date(row.started_at).getTime(),
    endedAt: new Date(row.ended_at).getTime(),
    hazardsAvoided: row.hazards_avoided,
    path: row.path ?? undefined,
  };
}
