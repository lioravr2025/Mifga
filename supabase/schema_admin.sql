-- Mifga - admin platform schema (dashboard, broadcasts, analytics, account
-- recovery). Safe to re-run: everything is IF NOT EXISTS / CREATE OR REPLACE
-- / DROP POLICY IF EXISTS, same convention as schema.sql / schema_v2.sql.

-- ============================================================================
-- admin_users - allowlist of who can see admin-only data. Nobody is in this
-- table until the first real (non-anonymous) account signs up through the
-- admin dashboard - see bootstrap_first_admin() below. There is no
-- user-facing way to reach that signup flow from the mobile app (which only
-- ever uses signInAnonymously()), so this can't be triggered accidentally.
-- ============================================================================
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS defaults to enabled with zero policies on new tables in this project,
-- which silently filters every row rather than erroring - useAdminAuth's own
-- "am I an admin" check needs to see its own row to actually work.
alter table public.admin_users enable row level security;

drop policy if exists "users can check their own admin membership" on public.admin_users;
create policy "users can check their own admin membership"
  on public.admin_users for select
  using (auth.uid() = user_id);

create or replace function public.is_admin(p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = p_uid);
$$;

create or replace function public.bootstrap_first_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_anonymous is not true and new.email is not null then
    if not exists (select 1 from public.admin_users) then
      insert into public.admin_users (user_id) values (new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_bootstrap_admin on auth.users;
create trigger on_auth_user_created_bootstrap_admin
  after insert on auth.users
  for each row execute function public.bootstrap_first_admin();

-- ============================================================================
-- Let every profile-referencing foreign key cascade on UPDATE, not just
-- DELETE - recover_account() below needs to change a profile row's id (from
-- an old install's uid to the current one's) and have every table that
-- references it follow automatically in one atomic statement, rather than
-- manually re-pointing a dozen tables by hand.
-- ============================================================================
alter table public.feedback drop constraint if exists feedback_user_id_fkey;
alter table public.feedback add constraint feedback_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null on update cascade;

alter table public.friend_messages drop constraint if exists friend_messages_recipient_id_fkey;
alter table public.friend_messages add constraint friend_messages_recipient_id_fkey
  foreign key (recipient_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.friend_messages drop constraint if exists friend_messages_sender_id_fkey;
alter table public.friend_messages add constraint friend_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.friendships drop constraint if exists friendships_addressee_id_fkey;
alter table public.friendships add constraint friendships_addressee_id_fkey
  foreign key (addressee_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.friendships drop constraint if exists friendships_requester_id_fkey;
alter table public.friendships add constraint friendships_requester_id_fkey
  foreign key (requester_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.hazard_votes drop constraint if exists hazard_votes_voter_id_fkey;
alter table public.hazard_votes add constraint hazard_votes_voter_id_fkey
  foreign key (voter_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.hazards drop constraint if exists hazards_reporter_id_fkey;
alter table public.hazards add constraint hazards_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null on update cascade;

alter table public.ride_log drop constraint if exists ride_log_user_id_fkey;
alter table public.ride_log add constraint ride_log_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.walkie_group_members drop constraint if exists walkie_group_members_member_id_fkey;
alter table public.walkie_group_members add constraint walkie_group_members_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.walkie_group_message_receipts drop constraint if exists walkie_group_message_receipts_member_id_fkey;
alter table public.walkie_group_message_receipts add constraint walkie_group_message_receipts_member_id_fkey
  foreign key (member_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.walkie_group_messages drop constraint if exists walkie_group_messages_sender_id_fkey;
alter table public.walkie_group_messages add constraint walkie_group_messages_sender_id_fkey
  foreign key (sender_id) references public.profiles(id) on delete cascade on update cascade;

alter table public.walkie_groups drop constraint if exists walkie_groups_owner_id_fkey;
alter table public.walkie_groups add constraint walkie_groups_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade on update cascade;

-- ============================================================================
-- profiles additions: live "on a ride right now" flag, and the 4-digit
-- recovery code set at signup.
-- ============================================================================
alter table public.profiles add column if not exists riding_since timestamptz;
alter table public.profiles add column if not exists recovery_code text;

drop policy if exists "admins can read all profiles" on public.profiles;
-- (not needed - profiles are already readable by any signed-in user, admin included)

-- ============================================================================
-- Admin read access on tables that are otherwise scoped to their own owner.
-- ============================================================================
drop policy if exists "admins can read all ride logs" on public.ride_log;
create policy "admins can read all ride logs"
  on public.ride_log for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can read all error logs" on public.client_error_logs;
create policy "admins can read all error logs"
  on public.client_error_logs for select
  using (public.is_admin(auth.uid()));

alter table public.feedback enable row level security;
drop policy if exists "admins can read all feedback" on public.feedback;
create policy "admins can read all feedback"
  on public.feedback for select
  using (public.is_admin(auth.uid()));

-- ============================================================================
-- broadcast_messages - admin -> all-users popup announcements.
-- ============================================================================
create table if not exists public.broadcast_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  active boolean not null default true
);

alter table public.broadcast_messages enable row level security;

drop policy if exists "any signed-in user can read active broadcasts" on public.broadcast_messages;
create policy "any signed-in user can read active broadcasts"
  on public.broadcast_messages for select
  using (auth.role() = 'authenticated');

drop policy if exists "admins can create broadcasts" on public.broadcast_messages;
create policy "admins can create broadcasts"
  on public.broadcast_messages for insert
  with check (public.is_admin(auth.uid()));

drop policy if exists "admins can update broadcasts" on public.broadcast_messages;
create policy "admins can update broadcasts"
  on public.broadcast_messages for update
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can delete broadcasts" on public.broadcast_messages;
create policy "admins can delete broadcasts"
  on public.broadcast_messages for delete
  using (public.is_admin(auth.uid()));

select public.ensure_realtime('public', 'broadcast_messages');

-- ============================================================================
-- ui_click_events - lightweight usage analytics ("what do people actually
-- tap"). Write-only from the client, admin-only read.
-- ============================================================================
create table if not exists public.ui_click_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  element text not null,
  screen text,
  created_at timestamptz not null default now()
);

create index if not exists ui_click_events_element_idx on public.ui_click_events (element);

alter table public.ui_click_events enable row level security;

drop policy if exists "log my own clicks" on public.ui_click_events;
create policy "log my own clicks"
  on public.ui_click_events for insert
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists "admins can read click events" on public.ui_click_events;
create policy "admins can read click events"
  on public.ui_click_events for select
  using (public.is_admin(auth.uid()));

-- ============================================================================
-- app_config - single-row table for version gating (a single JSON-free
-- key/value row keeps the client query trivial: select * limit 1).
-- ============================================================================
create table if not exists public.app_config (
  id boolean primary key default true, -- singleton row, id is always `true`
  min_required_version text,
  latest_version text,
  update_message text,
  check (id)
);

insert into public.app_config (id) values (true) on conflict (id) do nothing;

alter table public.app_config enable row level security;

drop policy if exists "anyone signed in can read app config" on public.app_config;
create policy "anyone signed in can read app config"
  on public.app_config for select
  using (auth.role() = 'authenticated');

drop policy if exists "admins can update app config" on public.app_config;
create policy "admins can update app config"
  on public.app_config for update
  using (public.is_admin(auth.uid()));

select public.ensure_realtime('public', 'app_config');

-- ============================================================================
-- support_tickets - "forgot my recovery code" fallback form, visible to admin.
-- ============================================================================
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  phone text,
  message text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

alter table public.support_tickets enable row level security;

drop policy if exists "anyone signed in can file a support ticket" on public.support_tickets;
create policy "anyone signed in can file a support ticket"
  on public.support_tickets for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "admins can read support tickets" on public.support_tickets;
create policy "admins can read support tickets"
  on public.support_tickets for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can update support tickets" on public.support_tickets;
create policy "admins can update support tickets"
  on public.support_tickets for update
  using (public.is_admin(auth.uid()));

-- ============================================================================
-- recovery_attempts - rate limiting for recover_account() below. No RLS
-- policy at all (default-deny) - only the SECURITY DEFINER function touches
-- this table, never a direct client query.
-- ============================================================================
create table if not exists public.recovery_attempts (
  id bigint generated always as identity primary key,
  phone text not null,
  attempted_at timestamptz not null default now(),
  success boolean not null
);

create index if not exists recovery_attempts_phone_idx on public.recovery_attempts (phone, attempted_at);
alter table public.recovery_attempts enable row level security;

-- ============================================================================
-- recover_account(phone, code) - re-attaches an old account's entire history
-- (reports, points, friendships, groups, ride log...) to whichever uid is
-- calling this - i.e. the CURRENT anonymous session created by this install.
-- Real re-authentication as the *same* Supabase auth identity was evaluated
-- and rejected: it needs either SMS-OTP auth (no provider configured) or a
-- service-role key (never safe to ship to a client). This data-ownership
-- transfer achieves the same practical outcome - "get my account back" -
-- using only the anon-key RPC pattern already used everywhere else in this
-- schema. Rate-limited to 5 attempts per phone number per 15 minutes.
-- ============================================================================
create or replace function public.recover_account(p_phone text, p_code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_uid uuid := auth.uid();
  v_old_uid uuid;
begin
  if v_new_uid is null then
    raise exception 'not signed in';
  end if;

  if (select count(*) from public.recovery_attempts
      where phone = p_phone and attempted_at > now() - interval '15 minutes') >= 5 then
    raise exception 'too many attempts - try again later or contact support';
  end if;

  select id into v_old_uid from public.profiles
    where phone = p_phone and recovery_code = p_code;

  insert into public.recovery_attempts (phone, success) values (p_phone, v_old_uid is not null);

  if v_old_uid is null then
    raise exception 'invalid phone number or code';
  end if;

  if v_old_uid = v_new_uid then
    return; -- already this account, nothing to do
  end if;

  if exists (select 1 from public.profiles where id = v_new_uid) then
    delete from public.profiles where id = v_new_uid;
  end if;

  update public.profiles set id = v_new_uid where id = v_old_uid;
end;
$$;

grant execute on function public.recover_account(text, text) to authenticated;

-- ============================================================================
-- admin_reset_all_profiles() - wipes every rider profile (test/dev cleanup,
-- or a full reset before a real launch). Every profile-referencing foreign key
-- is already "on delete cascade" (or "set null" for hazards.reporter_id), so
-- one delete here cascades through ride_log, hazard_votes, friendships,
-- friend_messages, walkie_groups/members/messages, feedback, ui_click_events
-- and client_error_logs automatically - hazard reports themselves survive,
-- just lose their reporter attribution. There's deliberately no "delete own
-- profile" RLS policy for regular users, so this is the only delete path,
-- and it's admin-gated.
-- ============================================================================
create or replace function public.admin_reset_all_profiles()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;

  select count(*) into v_count from public.profiles;
  delete from public.profiles where true; -- explicit WHERE: this project rejects unqualified DELETEs
  return v_count;
end;
$$;

grant execute on function public.admin_reset_all_profiles() to authenticated;

-- ============================================================================
-- prizes - admin-seeded collectible rewards shown on the map (see the "פיזור"
-- tab in the admin dashboard). A prize disappears for everyone the instant
-- someone collects it (collected_at set), same realtime-driven pattern as
-- hazards. Points are awarded atomically in collect_prize() below so two
-- riders racing for the same one can't both get credited.
-- ============================================================================
create table if not exists public.prizes (
  id uuid primary key default gen_random_uuid(),
  icon text not null,
  -- base64 data URI (same "no Storage bucket wired up yet" tradeoff as
  -- hazards.photo_url) - when set, the mobile app shows this image on the
  -- marker instead of the `icon` emoji.
  icon_image_url text,
  points integer not null,
  lat double precision not null,
  lng double precision not null,
  collected_by uuid references public.profiles(id) on delete set null,
  collected_at timestamptz,
  created_at timestamptz not null default now()
);

-- the table may already exist from before this column was added
alter table public.prizes add column if not exists icon_image_url text;

create index if not exists prizes_uncollected_idx on public.prizes (collected_at);

alter table public.prizes enable row level security;

drop policy if exists "prizes are readable by any signed-in user" on public.prizes;
create policy "prizes are readable by any signed-in user"
  on public.prizes for select
  using (auth.role() = 'authenticated');

-- no insert/update policy for regular users - seeding and collection only
-- happen through the SECURITY DEFINER functions below.

select public.ensure_realtime('public', 'prizes');

create or replace function public.collect_prize(p_prize_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_points integer;
begin
  update public.prizes
  set collected_by = auth.uid(), collected_at = now()
  where id = p_prize_id and collected_at is null
  returning points into v_points;

  if v_points is null then
    return -1; -- already collected (or doesn't exist) - client should just drop the marker
  end if;

  update public.profiles set points = points + v_points where id = auth.uid();
  return v_points;
end;
$$;

grant execute on function public.collect_prize(uuid) to authenticated;

-- ============================================================================
-- admin_seed_hazards / admin_seed_prizes - bulk-scatter fake hazards or
-- prizes randomly within p_radius_m meters of a center point (a city, picked
-- in the admin UI). Capped at 200/call so a typo can't accidentally paper a
-- whole city. Seeded hazards use a distinct, honest reporter_name (never a
-- name that could pass as a real rider) precisely so this data stays
-- distinguishable from genuine crowd-sourced reports later.
-- ============================================================================
create or replace function public.admin_seed_hazards(p_type text, p_lat double precision, p_lng double precision, p_radius_m integer, p_count integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  i integer;
  v_angle double precision;
  v_dist double precision;
  v_lat double precision;
  v_lng double precision;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  if p_count < 1 or p_count > 200 then
    raise exception 'count must be between 1 and 200';
  end if;

  for i in 1..p_count loop
    v_angle := random() * 2 * pi();
    v_dist := random() * p_radius_m;
    v_lat := p_lat + (v_dist * cos(v_angle)) / 111320.0;
    v_lng := p_lng + (v_dist * sin(v_angle)) / (111320.0 * cos(radians(p_lat)));
    insert into public.hazards (type, lat, lng, reporter_id, reporter_name)
    values (p_type, v_lat, v_lng, null, 'דיווח מערכת');
  end loop;
  return p_count;
end;
$$;

grant execute on function public.admin_seed_hazards(text, double precision, double precision, integer, integer) to authenticated;

-- dropped and recreated (not just "or replace") because a p_icon_image_url
-- parameter was added later - PostgREST needs exactly one overload to exist
-- or it can't disambiguate calls by parameter names.
drop function if exists public.admin_seed_prizes(text, integer, double precision, double precision, integer, integer);

create or replace function public.admin_seed_prizes(
  p_icon text,
  p_points integer,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_count integer,
  p_icon_image_url text default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  i integer;
  v_angle double precision;
  v_dist double precision;
  v_lat double precision;
  v_lng double precision;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  if p_count < 1 or p_count > 200 then
    raise exception 'count must be between 1 and 200';
  end if;
  if p_points < 1 then
    raise exception 'points must be positive';
  end if;

  for i in 1..p_count loop
    v_angle := random() * 2 * pi();
    v_dist := random() * p_radius_m;
    v_lat := p_lat + (v_dist * cos(v_angle)) / 111320.0;
    v_lng := p_lng + (v_dist * sin(v_angle)) / (111320.0 * cos(radians(p_lat)));
    insert into public.prizes (icon, icon_image_url, points, lat, lng) values (p_icon, p_icon_image_url, p_points, v_lat, v_lng);
  end loop;
  return p_count;
end;
$$;

grant execute on function public.admin_seed_prizes(text, integer, double precision, double precision, integer, integer, text) to authenticated;

-- admin_remove_hazard - manual takedown of ANY hazard (seeded or genuinely
-- reported) from the admin dashboard, soft-deleted the same way denial-voting
-- already does (removed = true), so it stays consistent with existing stats.
create or replace function public.admin_remove_hazard(p_hazard_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  update public.hazards set removed = true where id = p_hazard_id;
end;
$$;

grant execute on function public.admin_remove_hazard(uuid) to authenticated;

-- admin_remove_hazards - bulk version (e.g. "remove every hazard in this
-- city") so the client doesn't have to make one round trip per id.
create or replace function public.admin_remove_hazards(p_ids uuid[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  update public.hazards set removed = true where id = any(p_ids) and removed = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_remove_hazards(uuid[]) to authenticated;

-- admin_remove_all_hazards - the "מחיקת כל המפגעים" danger button.
create or replace function public.admin_remove_all_hazards()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  update public.hazards set removed = true where removed = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_remove_all_hazards() to authenticated;

-- ============================================================================
-- profiles.platform - captured once at signup (Capacitor.getPlatform():
-- "android" / "ios" / "web") for the admin dashboard's "רוכבים" tab. Covered
-- by the existing "users can update their own profile" policy in schema.sql.
-- ============================================================================
alter table public.profiles add column if not exists platform text;

-- ============================================================================
-- broadcast_reads - one row per (broadcast, rider) once they dismiss the
-- popup ("הבנתי" or the X), so the admin dashboard can show a real read
-- count instead of just "sent". "Reached" is approximated as the current
-- total registered rider count, shown alongside the read count rather than
-- a separate tracked "delivered" event.
-- ============================================================================
create table if not exists public.broadcast_reads (
  broadcast_id uuid not null references public.broadcast_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

alter table public.broadcast_reads enable row level security;

drop policy if exists "users can mark a broadcast as read for themselves" on public.broadcast_reads;
create policy "users can mark a broadcast as read for themselves"
  on public.broadcast_reads for insert
  with check (auth.uid() = user_id);

drop policy if exists "admins can read broadcast read receipts" on public.broadcast_reads;
create policy "admins can read broadcast read receipts"
  on public.broadcast_reads for select
  using (public.is_admin(auth.uid()));

-- admin_remove_prize - manual takedown of an uncollected prize from the map,
-- same idea as admin_remove_hazard (hard delete here since an uncollected
-- prize has no history worth keeping, unlike a hazard's vote counts).
create or replace function public.admin_remove_prize(p_prize_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  delete from public.prizes where id = p_prize_id;
end;
$$;

grant execute on function public.admin_remove_prize(uuid) to authenticated;

-- admin_remove_prizes - bulk version (e.g. "remove every prize in this
-- city"), same rationale as admin_remove_hazards.
create or replace function public.admin_remove_prizes(p_ids uuid[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  delete from public.prizes where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_remove_prizes(uuid[]) to authenticated;

-- admin_remove_all_prizes - the "מחיקת כל הפרסים" danger button.
create or replace function public.admin_remove_all_prizes()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  delete from public.prizes where collected_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.admin_remove_all_prizes() to authenticated;
