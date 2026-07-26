-- Mifga - production schema for self-hosted Supabase
-- Run this once against a fresh Supabase Postgres instance (via the Studio
-- SQL editor, or `psql`). Safe to re-run: everything is IF NOT EXISTS /
-- CREATE OR REPLACE.
--
-- Status of each table for the CLIENT app (src/context/AppContext.tsx):
--   WIRED    - the app reads/writes this table today when a backend is configured
--   RESERVED - schema is ready; client still uses localStorage for this domain
--              (friends/groups/ride log/feedback) - a deliberate scope decision
--              to ship one correct, tested vertical slice (auth + hazards)
--              before converting everything else on the same pattern.

create extension if not exists pgcrypto;

-- ============================================================================
-- profiles  (WIRED)
-- One row per authenticated user (auth.users), created at end of onboarding.
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  avatar_emoji text not null default '🧑',
  avatar_photo_url text, -- currently a base64 data URI too, see note on hazards.photo_url
  points integer not null default 0,
  reports_count integer not null default 0,
  reports_with_photo integer not null default 0,
  vehicle_type text check (vehicle_type in ('scooter', 'ebike', 'emotorcycle')),
  vehicle_model text,
  phone text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by any signed-in user" on public.profiles;
create policy "profiles are readable by any signed-in user"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- atomic point award on report submission (avoids a read-modify-write race
-- if the same account has two tabs/devices open); security definer, but
-- still scoped to the caller's own row so nobody can credit another user.
create or replace function public.award_report_points(p_uid uuid, p_points integer, p_with_photo boolean)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() <> p_uid then
    raise exception 'cannot award points to another user';
  end if;

  update public.profiles
  set points = points + p_points,
      reports_count = reports_count + 1,
      reports_with_photo = reports_with_photo + (case when p_with_photo then 1 else 0 end)
  where id = p_uid;
end;
$$;

grant execute on function public.award_report_points(uuid, integer, boolean) to authenticated;

-- ============================================================================
-- hazards  (WIRED)
-- ============================================================================
create table if not exists public.hazards (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reporter_name text not null,
  has_photo boolean not null default false,
  -- NOTE: the client currently writes a base64 data URI here, not a real
  -- Storage URL - the `hazard-photos` bucket below is provisioned and ready,
  -- but the upload flow hasn't been wired up yet (see README "מה נשאר").
  -- Fine functionally for a small beta group; revisit before a wider launch
  -- since base64-in-Postgres doesn't scale.
  photo_url text,
  confirmations integer not null default 0,
  denials integer not null default 0,
  removed boolean not null default false,
  nickname text,
  last_vote_at timestamptz
);

create index if not exists hazards_active_idx on public.hazards (removed, created_at desc);

alter table public.hazards enable row level security;

drop policy if exists "hazards are readable by any signed-in user" on public.hazards;
create policy "hazards are readable by any signed-in user"
  on public.hazards for select
  using (auth.role() = 'authenticated');

drop policy if exists "signed-in users can report a hazard" on public.hazards;
create policy "signed-in users can report a hazard"
  on public.hazards for insert
  with check (auth.uid() = reporter_id);

-- confirmations/denials/removed are only ever changed via the RPC functions
-- below (atomic, one-vote-per-user) - no direct client UPDATE policy on purpose.

-- one vote per user per hazard, used by the RPCs to reject double-voting
create table if not exists public.hazard_votes (
  hazard_id uuid not null references public.hazards(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  vote_type text not null check (vote_type in ('confirm', 'deny')),
  created_at timestamptz not null default now(),
  primary key (hazard_id, voter_id)
);

alter table public.hazard_votes enable row level security;

drop policy if exists "users can read their own votes" on public.hazard_votes;
create policy "users can read their own votes"
  on public.hazard_votes for select
  using (auth.uid() = voter_id);

-- REMOVAL_THRESHOLD mirrors src/data/hazardTypes.ts - keep the two in sync.
create or replace function public.confirm_hazard(p_hazard_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.hazard_votes (hazard_id, voter_id, vote_type)
  values (p_hazard_id, auth.uid(), 'confirm')
  on conflict (hazard_id, voter_id) do nothing;

  if found then
    update public.hazards
    set confirmations = confirmations + 1,
        last_vote_at = now()
    where id = p_hazard_id;
  end if;
end;
$$;

create or replace function public.deny_hazard(p_hazard_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.hazard_votes (hazard_id, voter_id, vote_type)
  values (p_hazard_id, auth.uid(), 'deny')
  on conflict (hazard_id, voter_id) do nothing;

  if found then
    update public.hazards
    set denials = denials + 1,
        last_vote_at = now(),
        removed = (denials + 1) >= 5
    where id = p_hazard_id;
  end if;
end;
$$;

grant execute on function public.confirm_hazard(uuid) to authenticated;
grant execute on function public.deny_hazard(uuid) to authenticated;

-- realtime: push INSERT/UPDATE on hazards to every connected client live
alter publication supabase_realtime add table public.hazards;

-- ============================================================================
-- RESERVED - designed now, not yet called by the client (see header note).
-- Converting friends/groups/ride log/feedback to this same
-- auth-table + RLS + realtime pattern is the natural next step.
-- ============================================================================

create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create table if not exists public.walkie_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.walkie_group_members (
  group_id uuid not null references public.walkie_groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  primary key (group_id, member_id)
);

create table if not exists public.walkie_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.walkie_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create table if not exists public.walkie_group_message_receipts (
  message_id uuid not null references public.walkie_group_messages(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  primary key (message_id, member_id)
);

create table if not exists public.ride_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  hazards_avoided integer not null default 0
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  liked boolean not null,
  note text,
  submitted_at timestamptz not null default now()
);

-- ============================================================================
-- Storage buckets - photos are NOT yet migrated off base64 data URLs in the
-- client (see README); buckets are pre-created so that follow-up work is
-- config, not schema design.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('hazard-photos', 'hazard-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
