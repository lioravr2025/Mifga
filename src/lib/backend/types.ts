// snake_case row shapes as they come back from Postgres/Supabase, plus
// mappers to/from the camelCase app types in src/types/index.ts. Keeping the
// mapping in one place means AppContext never has to think about column
// naming - it only ever sees HazardReport/UserProfile.
import type { HazardReport, HazardTypeId, UserProfile, VehicleTypeId } from "../../types";

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
  };
}
