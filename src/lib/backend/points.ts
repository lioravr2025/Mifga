import { supabase } from "../supabaseClient";
import { POINTS_PER_REPORT, POINTS_PER_REPORT_WITH_PHOTO } from "../../data/hazardTypes";

export interface PointsBreakdown {
  reportsCount: number;
  reportsPoints: number;
  reportsWithPhotoCount: number;
  reportsWithPhotoPoints: number;
  meetupsCount: number;
  meetupsPoints: number;
  prizesCount: number;
  prizesPoints: number;
}

/**
 * profiles.points is just a running total with no memory of where it came
 * from - reports/photo-bonus are derived from the counters already kept on
 * the profile row, meetups/prizes are summed from their own per-user ledger
 * tables (prize_collections, meetup_arrivals) added in schema_v4.
 */
export async function fetchPointsBreakdown(uid: string, reportsCount: number, reportsWithPhoto: number): Promise<PointsBreakdown> {
  if (!supabase) throw new Error("Supabase not configured");
  const [{ data: prizeRows, error: pErr }, { data: meetupRows, error: mErr }] = await Promise.all([
    supabase.from("prize_collections").select("points").eq("user_id", uid),
    supabase.from("meetup_arrivals").select("points").eq("user_id", uid),
  ]);
  if (pErr) throw pErr;
  if (mErr) throw mErr;

  const sum = (rows: { points: number }[] | null) => (rows ?? []).reduce((total, r) => total + r.points, 0);

  return {
    reportsCount: Math.max(0, reportsCount - reportsWithPhoto),
    reportsPoints: Math.max(0, reportsCount - reportsWithPhoto) * POINTS_PER_REPORT,
    reportsWithPhotoCount: reportsWithPhoto,
    reportsWithPhotoPoints: reportsWithPhoto * POINTS_PER_REPORT_WITH_PHOTO,
    meetupsCount: meetupRows?.length ?? 0,
    meetupsPoints: sum(meetupRows),
    prizesCount: prizeRows?.length ?? 0,
    prizesPoints: sum(prizeRows),
  };
}
