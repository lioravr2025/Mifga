export interface ProfileRow {
  id: string;
  name: string;
  username: string;
  points: number;
  reports_count: number;
  reports_with_photo: number;
  vehicle_type: "scooter" | "ebike" | "emotorcycle" | null;
  phone: string | null;
  created_at: string;
  live_lat: number | null;
  live_lng: number | null;
  last_active_at: string | null;
  riding_since: string | null;
}

export interface HazardRow {
  id: string;
  type: string;
  lat: number;
  lng: number;
  reporter_id: string | null;
  reporter_name: string;
  has_photo: boolean;
  confirmations: number;
  denials: number;
  removed: boolean;
  created_at: string;
}

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  liked: boolean;
  note: string | null;
  submitted_at: string;
}

export interface RideLogRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  hazards_avoided: number;
  path: { lat: number; lng: number }[] | null;
}

export interface ClientErrorRow {
  id: string;
  user_id: string | null;
  message: string;
  stack: string | null;
  app_version: string | null;
  platform: string | null;
  created_at: string;
}

export interface ClickEventRow {
  element: string;
}

export interface SupportTicketRow {
  id: string;
  phone: string | null;
  message: string;
  created_at: string;
  resolved: boolean;
}

export interface BroadcastRow {
  id: string;
  message: string;
  created_at: string;
  active: boolean;
}

export interface AppConfigRow {
  min_required_version: string | null;
  latest_version: string | null;
  update_message: string | null;
}
