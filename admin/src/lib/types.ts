export interface ProfileRow {
  id: string;
  name: string;
  username: string;
  avatar_emoji: string;
  avatar_photo_url: string | null;
  points: number;
  reports_count: number;
  reports_with_photo: number;
  vehicle_type: "scooter" | "ebike" | "emotorcycle" | null;
  vehicle_model: string | null;
  phone: string | null;
  platform: string | null;
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
  last_vote_at: string | null;
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

export interface PrizeRow {
  id: string;
  icon: string;
  icon_image_url: string | null;
  points: number;
  lat: number;
  lng: number;
  collected_by: string | null;
  collected_at: string | null;
}

export interface MeetupRow {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  location_text: string;
  lat: number | null;
  lng: number | null;
  cover_photo_url: string | null;
  starts_at: string;
  ends_at: string | null;
  privacy: string;
  capacity: number | null;
  views: number;
  removed: boolean;
  created_at: string;
}

export interface MarketplaceListingRow {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number | null;
  vehicle_type: string | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  phone: string;
  location_text: string | null;
  views: number;
  active: boolean;
  created_at: string;
}

export interface AppConfigRow {
  min_required_version: string | null;
  latest_version: string | null;
  update_message: string | null;
}
