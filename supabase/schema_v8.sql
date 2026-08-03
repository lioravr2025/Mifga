-- Mifga - round 8: close a real account-takeover hole.
--
-- The original "profiles are readable by any signed-in user" policy
-- (schema.sql:38-41, using auth.role() = 'authenticated') grants full-row
-- reads to ANY authenticated session - including a throwaway anonymous one
-- anyone can create for free via supabase.auth.signInAnonymously(). Postgres
-- RLS is row-level only, so that policy exposed every column, including
-- `phone` and `recovery_code` - the exact two values recover_account() uses
-- to prove account ownership (schema_admin.sql:284-321). In other words,
-- anyone could read another rider's recovery credentials straight off the
-- profiles table and take over their account. Both columns are also stored
-- in plain text (never hashed), so this was a direct, working exploit path,
-- not a theoretical one.
--
-- Fix: tighten profiles SELECT to owner-only, add back an explicit
-- admin-only SELECT policy (the dropped comment at schema_admin.sql:119-120
-- claimed one wasn't needed "because profiles are already readable by any
-- signed-in user, admin included" - that's no longer true and this replaces
-- it), and expose a column-restricted view for the legitimate cases where
-- the app needs to read *other* riders' basic info (friends list, username
-- search, meetup/marketplace attributions) without their phone/recovery
-- code. profiles_public is a plain (non security-invoker) view, so it reads
-- with the view owner's privileges and isn't itself row-restricted by the
-- tightened base policy - it's just column-restricted by its own
-- definition, which is the standard way to do column-level access control
-- on top of Postgres's row-only RLS.

drop policy if exists "profiles are readable by any signed-in user" on public.profiles;

create policy "users can read their own full profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "admins can read all profiles"
  on public.profiles for select
  using (public.is_admin(auth.uid()));

create or replace view public.profiles_public as
select
  id, name, username, avatar_emoji, avatar_photo_url, points,
  reports_count, reports_with_photo, vehicle_type, vehicle_model,
  created_at, live_lat, live_lng, last_active_at, instagram, tiktok,
  riding_since, platform
from public.profiles;

grant select on public.profiles_public to authenticated;
