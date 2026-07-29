import { supabase } from "../supabaseClient";
import { prizeFromRow, type PrizeRow } from "./types";
import type { Prize } from "../../types";

export async function fetchPrizes(): Promise<Prize[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("prizes").select("*").is("collected_at", null);
  if (error) throw error;
  return (data as PrizeRow[]).map(prizeFromRow);
}

/** Returns the points awarded, or null if someone else grabbed it first (already collected). */
export async function collectPrizeRemote(id: string): Promise<number | null> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.rpc("collect_prize", { p_prize_id: id });
  if (error) throw error;
  const points = data as number;
  return points >= 0 ? points : null;
}

/** Live updates for prizes - INSERT for new ones, UPDATE for collected (removed client-side once collected_at is set). */
export function subscribePrizes(onInsert: (prize: Prize) => void, onCollected: (id: string) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("prizes-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "prizes" }, (payload) => {
      const row = payload.new as PrizeRow;
      if (!row.collected_at) onInsert(prizeFromRow(row));
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "prizes" }, (payload) => {
      const row = payload.new as PrizeRow;
      if (row.collected_at) onCollected(row.id);
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}
