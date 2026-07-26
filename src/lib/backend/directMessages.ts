import { supabase } from "../supabaseClient";

export interface FriendMessageRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  audio_url: string;
  sent_at: string;
  delivered_at: string | null;
}

/** 1:1 walkie-talkie voice message straight to a friend (not through a group). */
export async function sendFriendMessageRemote(myUid: string, friendId: string, audioUrl: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("friend_messages").insert({ sender_id: myUid, recipient_id: friendId, audio_url: audioUrl });
  if (error) throw error;
}

export async function markFriendMessageDeliveredRemote(messageId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("mark_friend_message_delivered", { p_message_id: messageId });
  if (error) throw error;
}

/** Fires for every new/updated direct message I sent or received - used to auto-play incoming audio and update delivery ticks. */
export function subscribeFriendMessages(myUid: string, onChange: (row: FriendMessageRow) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("friend-messages-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_messages" }, (payload) => {
      const row = (payload.new ?? payload.old) as FriendMessageRow;
      if (row.sender_id === myUid || row.recipient_id === myUid) onChange(row);
    })
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
