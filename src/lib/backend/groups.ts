import { supabase } from "../supabaseClient";
import type { WalkieGroupMemberRow, WalkieGroupMessageReceiptRow, WalkieGroupMessageRow, WalkieGroupRow } from "./types";
import type { GroupMessage, IncomingGroupInvite, WalkieGroup } from "../../types";

async function assembleGroups(uid: string, groupRows: WalkieGroupRow[]): Promise<WalkieGroup[]> {
  if (groupRows.length === 0) return [];
  const groupIds = groupRows.map((g) => g.id);

  const [{ data: memberRows, error: mErr }, { data: messageRows, error: msgErr }] = await Promise.all([
    supabase!.from("walkie_group_members").select("*").in("group_id", groupIds),
    supabase!.from("walkie_group_messages").select("*").in("group_id", groupIds).order("sent_at", { ascending: true }),
  ]);
  if (mErr) throw mErr;
  if (msgErr) throw msgErr;

  const messages = (messageRows ?? []) as WalkieGroupMessageRow[];
  const messageIds = messages.map((m) => m.id);
  let receipts: WalkieGroupMessageReceiptRow[] = [];
  if (messageIds.length > 0) {
    const { data: receiptRows, error: rErr } = await supabase!.from("walkie_group_message_receipts").select("*").in("message_id", messageIds);
    if (rErr) throw rErr;
    receipts = (receiptRows ?? []) as WalkieGroupMessageReceiptRow[];
  }

  const members = (memberRows ?? []) as WalkieGroupMemberRow[];

  return groupRows.map((g) => {
    const groupMembers = members
      .filter((m) => m.group_id === g.id)
      .map((m) => ({ friendId: m.member_id, status: m.status }));
    const groupMessages: GroupMessage[] = messages
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        id: m.id,
        sentAt: new Date(m.sent_at).getTime(),
        audioUrl: m.audio_url,
        senderId: m.sender_id,
        receipts: receipts
          .filter((r) => r.message_id === m.id)
          .map((r) => ({ friendId: r.member_id, deliveredAt: r.delivered_at ? new Date(r.delivered_at).getTime() : null })),
      }));
    return {
      id: g.id,
      name: g.name,
      createdAt: new Date(g.created_at).getTime(),
      members: groupMembers,
      messages: groupMessages,
      pinned: members.find((m) => m.group_id === g.id && m.member_id === uid)?.pinned ?? false,
    };
  });
}

/** Groups I own, plus groups I'm a member of (pending or accepted) - matches what the local prototype showed. */
export async function fetchGroups(uid: string): Promise<WalkieGroup[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: myMemberships, error: memErr } = await supabase.from("walkie_group_members").select("group_id").eq("member_id", uid);
  if (memErr) throw memErr;
  const memberGroupIds = (myMemberships ?? []).map((r) => r.group_id as string);

  const { data: ownedRows, error: ownErr } = await supabase.from("walkie_groups").select("*").eq("owner_id", uid);
  if (ownErr) throw ownErr;

  let memberRows: WalkieGroupRow[] = [];
  if (memberGroupIds.length > 0) {
    const { data, error } = await supabase.from("walkie_groups").select("*").in("id", memberGroupIds);
    if (error) throw error;
    memberRows = data as WalkieGroupRow[];
  }

  const byId = new Map<string, WalkieGroupRow>();
  [...(ownedRows as WalkieGroupRow[]), ...memberRows].forEach((g) => byId.set(g.id, g));
  return assembleGroups(uid, Array.from(byId.values()));
}

export async function fetchIncomingGroupInvites(uid: string): Promise<IncomingGroupInvite[]> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: rows, error } = await supabase.from("walkie_group_members").select("group_id").eq("member_id", uid).eq("status", "pending");
  if (error) throw error;
  const groupIds = (rows ?? []).map((r) => r.group_id as string);
  if (groupIds.length === 0) return [];
  const { data: groups, error: gErr } = await supabase.from("walkie_groups").select("*").in("id", groupIds);
  if (gErr) throw gErr;
  return (groups as WalkieGroupRow[]).map((g) => ({ groupId: g.id, groupName: g.name, invitedAt: new Date(g.created_at).getTime() }));
}

export async function createGroupRemote(ownerId: string, name: string, memberIds: string[]): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.from("walkie_groups").insert({ name, owner_id: ownerId }).select("id").single();
  if (error) throw error;
  const groupId = data.id as string;
  // send_group_message() requires an accepted walkie_group_members row for
  // the sender - owner_id on walkie_groups alone doesn't satisfy that check,
  // so without this the owner could never send to their own group.
  const { error: ownerMemberError } = await supabase
    .from("walkie_group_members")
    .insert({ group_id: groupId, member_id: ownerId, status: "accepted" });
  if (ownerMemberError) throw ownerMemberError;
  if (memberIds.length > 0) await inviteMembersRemote(groupId, memberIds);
  return groupId;
}

export async function inviteMembersRemote(groupId: string, memberIds: string[]): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase
    .from("walkie_group_members")
    .insert(memberIds.map((memberId) => ({ group_id: groupId, member_id: memberId, status: "pending" })));
  if (error) throw error;
}

export async function respondGroupInviteRemote(groupId: string, accept: boolean): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("respond_group_invite", { p_group_id: groupId, p_accept: accept });
  if (error) throw error;
}

export async function removeMemberRemote(groupId: string, memberId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("walkie_group_members").delete().eq("group_id", groupId).eq("member_id", memberId);
  if (error) throw error;
}

export async function removeGroupRemote(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.from("walkie_groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function toggleGroupPinRemote(groupId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("toggle_group_pin", { p_group_id: groupId });
  if (error) throw error;
}

/** Sends a voice message (audioUrl already uploaded to the walkie-audio bucket) and fans out delivery receipts atomically. */
export async function sendGroupMessageRemote(groupId: string, audioUrl: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("send_group_message", { p_group_id: groupId, p_audio_url: audioUrl });
  if (error) throw error;
}

export async function markMessageDeliveredRemote(messageId: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.rpc("mark_message_delivered", { p_message_id: messageId });
  if (error) throw error;
}

/**
 * Membership changes (invited / accepted / removed) touching my groups.
 * No manual filtering needed - Realtime only delivers rows that pass the
 * table's own SELECT policy for this connection, so this already can't see
 * groups I'm not part of.
 */
export function subscribeGroups(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("groups-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "walkie_group_members" }, () => onChange())
    .on("postgres_changes", { event: "*", schema: "public", table: "walkie_groups" }, () => onChange())
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** New voice message in any group I'm an accepted member of (RLS-gated, same as above). */
export function subscribeGroupMessages(onMessage: (row: WalkieGroupMessageRow) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("group-messages-live")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "walkie_group_messages" }, (payload) => {
      onMessage(payload.new as WalkieGroupMessageRow);
    })
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}

/** Delivery-tick updates on messages I sent, so the sender sees checkmarks turn green live. */
export function subscribeMessageReceipts(onChange: (row: WalkieGroupMessageReceiptRow) => void): () => void {
  if (!supabase) return () => {};
  const channel = supabase
    .channel("group-receipts-live")
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "walkie_group_message_receipts" }, (payload) => {
      onChange(payload.new as WalkieGroupMessageReceiptRow);
    })
    .subscribe();
  return () => {
    supabase?.removeChannel(channel);
  };
}
