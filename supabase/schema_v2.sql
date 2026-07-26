-- Mifga - schema v2: friends, groups/walkie-talkie, photo/avatar/audio storage,
-- ride log, feedback, and live presence.
-- Run this in the SQL Editor AFTER schema.sql. Safe to re-run (IF NOT EXISTS /
-- CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS throughout).

-- ============================================================================
-- profiles: live presence (position + last-active, used to show "online" /
-- distance for friends on the map)
-- ============================================================================
alter table public.profiles add column if not exists live_lat double precision;
alter table public.profiles add column if not exists live_lng double precision;
alter table public.profiles add column if not exists last_active_at timestamptz;

-- ============================================================================
-- friendships - request/accept model. One row per pair, direction matters
-- only for who has to approve; "favorite" is per-viewer since it's subjective.
-- ============================================================================
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  favorite_by_requester boolean not null default false,
  favorite_by_addressee boolean not null default false,
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id), greatest(requester_id, addressee_id)
);

alter table public.friendships enable row level security;

drop policy if exists "see my own friendships" on public.friendships;
create policy "see my own friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "request a friendship" on public.friendships;
create policy "request a friendship"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

-- status/favorite changes only via the RPCs below (security definer) - no
-- direct client UPDATE policy, same pattern as hazards' vote counters.

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted'
    where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
    where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

create or replace function public.toggle_friend_favorite(p_friendship_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  fr record;
begin
  select * into fr from public.friendships
  where id = p_friendship_id and (requester_id = auth.uid() or addressee_id = auth.uid()) and status = 'accepted';
  if not found then return; end if;

  if fr.requester_id = auth.uid() then
    update public.friendships set favorite_by_requester = not favorite_by_requester where id = p_friendship_id;
  else
    update public.friendships set favorite_by_addressee = not favorite_by_addressee where id = p_friendship_id;
  end if;
end;
$$;

grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.toggle_friend_favorite(uuid) to authenticated;

alter publication supabase_realtime add table public.friendships;
alter publication supabase_realtime add table public.profiles;

-- ============================================================================
-- walkie_groups / walkie_group_members - real invite/accept flow (the
-- creator invites, the invited friend has to accept themselves - no more
-- simulated auto-accept).
-- ============================================================================
alter table public.walkie_groups enable row level security;

drop policy if exists "members and owner can see the group" on public.walkie_groups;
create policy "members and owner can see the group"
  on public.walkie_groups for select
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.walkie_group_members m where m.group_id = id and m.member_id = auth.uid())
  );

drop policy if exists "create a group as its owner" on public.walkie_groups;
create policy "create a group as its owner"
  on public.walkie_groups for insert
  with check (owner_id = auth.uid());

drop policy if exists "owner can delete their group" on public.walkie_groups;
create policy "owner can delete their group"
  on public.walkie_groups for delete
  using (owner_id = auth.uid());

alter table public.walkie_group_members enable row level security;

drop policy if exists "see members of my groups" on public.walkie_group_members;
create policy "see members of my groups"
  on public.walkie_group_members for select
  using (
    member_id = auth.uid()
    or exists (select 1 from public.walkie_groups g where g.id = group_id and g.owner_id = auth.uid())
    or exists (
      select 1 from public.walkie_group_members me
      where me.group_id = group_id and me.member_id = auth.uid() and me.status = 'accepted'
    )
  );

drop policy if exists "owner invites members" on public.walkie_group_members;
create policy "owner invites members"
  on public.walkie_group_members for insert
  with check (exists (select 1 from public.walkie_groups g where g.id = group_id and g.owner_id = auth.uid()));

drop policy if exists "owner or the member themself can remove a membership" on public.walkie_group_members;
create policy "owner or the member themself can remove a membership"
  on public.walkie_group_members for delete
  using (
    member_id = auth.uid()
    or exists (select 1 from public.walkie_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create or replace function public.respond_group_invite(p_group_id uuid, p_accept boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_accept then
    update public.walkie_group_members set status = 'accepted'
    where group_id = p_group_id and member_id = auth.uid() and status = 'pending';
  else
    delete from public.walkie_group_members
    where group_id = p_group_id and member_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

grant execute on function public.respond_group_invite(uuid, boolean) to authenticated;

alter publication supabase_realtime add table public.walkie_groups;
alter publication supabase_realtime add table public.walkie_group_members;

-- ============================================================================
-- walkie_group_messages - real push-to-talk voice messages (audio_url points
-- at a file in the `walkie-audio` storage bucket, created below).
-- ============================================================================
alter table public.walkie_group_messages add column if not exists audio_url text not null default '';

alter table public.walkie_group_messages enable row level security;

drop policy if exists "accepted members can see group messages" on public.walkie_group_messages;
create policy "accepted members can see group messages"
  on public.walkie_group_messages for select
  using (
    exists (
      select 1 from public.walkie_group_members m
      where m.group_id = walkie_group_messages.group_id and m.member_id = auth.uid() and m.status = 'accepted'
    )
  );

-- sending is only via the RPC below, so the message row and its fan-out of
-- receipts are created atomically in one transaction.

alter table public.walkie_group_message_receipts enable row level security;

drop policy if exists "see my own receipts, or receipts for messages I sent" on public.walkie_group_message_receipts;
create policy "see my own receipts, or receipts for messages I sent"
  on public.walkie_group_message_receipts for select
  using (
    member_id = auth.uid()
    or exists (
      select 1 from public.walkie_group_messages msg
      where msg.id = walkie_group_message_receipts.message_id and msg.sender_id = auth.uid()
    )
  );

create or replace function public.send_group_message(p_group_id uuid, p_audio_url text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_message_id uuid;
begin
  if not exists (
    select 1 from public.walkie_group_members
    where group_id = p_group_id and member_id = auth.uid() and status = 'accepted'
  ) then
    raise exception 'not an accepted member of this group';
  end if;

  insert into public.walkie_group_messages (group_id, sender_id, audio_url)
  values (p_group_id, auth.uid(), p_audio_url)
  returning id into v_message_id;

  insert into public.walkie_group_message_receipts (message_id, member_id, delivered_at)
  select v_message_id, member_id, null
  from public.walkie_group_members
  where group_id = p_group_id and status = 'accepted' and member_id <> auth.uid();

  return v_message_id;
end;
$$;

create or replace function public.mark_message_delivered(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.walkie_group_message_receipts
  set delivered_at = now()
  where message_id = p_message_id and member_id = auth.uid() and delivered_at is null;
end;
$$;

grant execute on function public.send_group_message(uuid, text) to authenticated;
grant execute on function public.mark_message_delivered(uuid) to authenticated;

alter publication supabase_realtime add table public.walkie_group_messages;
alter publication supabase_realtime add table public.walkie_group_message_receipts;

-- ============================================================================
-- friend_messages - direct (non-group) walkie-talkie voice messages. Simpler
-- than group messages: exactly one recipient, so delivery is a single column
-- instead of a separate receipts table.
-- ============================================================================
create table if not exists public.friend_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  audio_url text not null,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz
);

alter table public.friend_messages enable row level security;

drop policy if exists "see messages I sent or received" on public.friend_messages;
create policy "see messages I sent or received"
  on public.friend_messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "send a message to a friend" on public.friend_messages;
create policy "send a message to a friend"
  on public.friend_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (requester_id = auth.uid() and addressee_id = recipient_id)
          or (addressee_id = auth.uid() and requester_id = recipient_id)
        )
    )
  );

create or replace function public.mark_friend_message_delivered(p_message_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.friend_messages set delivered_at = now()
  where id = p_message_id and recipient_id = auth.uid() and delivered_at is null;
end;
$$;

grant execute on function public.mark_friend_message_delivered(uuid) to authenticated;

alter publication supabase_realtime add table public.friend_messages;

-- ============================================================================
-- ride_log (WIRED)
-- ============================================================================
alter table public.ride_log enable row level security;

drop policy if exists "read own ride log" on public.ride_log;
create policy "read own ride log"
  on public.ride_log for select
  using (user_id = auth.uid());

drop policy if exists "insert own ride log" on public.ride_log;
create policy "insert own ride log"
  on public.ride_log for insert
  with check (user_id = auth.uid());

-- ============================================================================
-- feedback (WIRED) - write-only from the client, nobody reads it back in-app
-- ============================================================================
alter table public.feedback enable row level security;

drop policy if exists "insert own feedback" on public.feedback;
create policy "insert own feedback"
  on public.feedback for insert
  with check (user_id = auth.uid() or user_id is null);

-- ============================================================================
-- storage - a bucket for walkie-talkie audio (hazard-photos/avatars already
-- exist from schema.sql), plus the upload policies every bucket needs: a
-- public bucket only makes *reads* public, uploads still need an explicit
-- RLS policy on storage.objects.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('walkie-audio', 'walkie-audio', true)
on conflict (id) do nothing;

drop policy if exists "authenticated users can upload hazard photos" on storage.objects;
create policy "authenticated users can upload hazard photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hazard-photos');

drop policy if exists "authenticated users can upload avatars" on storage.objects;
create policy "authenticated users can upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "authenticated users can upload walkie audio" on storage.objects;
create policy "authenticated users can upload walkie audio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'walkie-audio');
