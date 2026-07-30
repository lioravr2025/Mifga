-- Mifga - round 3 of mobile-app-facing schema changes (social links, meetups,
-- marketplace). Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP
-- POLICY IF EXISTS throughout, same convention as the other schema files.

-- ============================================================================
-- profiles.instagram / profiles.tiktok - handle only (no @, no URL), shown as
-- a clickable link to whoever views this rider's profile (friends list for
-- now). Covered by the existing "users can update their own profile" policy.
-- ============================================================================
alter table public.profiles add column if not exists instagram text;
alter table public.profiles add column if not exists tiktok text;

-- ============================================================================
-- meetups - rider-organized events (Facebook-events-style). RSVP is a single
-- "going" row per (meetup, user) - simpler than a going/maybe/not-going tier
-- since the ask was specifically "who's confirmed attending", not a full
-- invite-response system.
-- ============================================================================
create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  location_text text not null,
  lat double precision,
  lng double precision,
  cover_photo_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  privacy text not null default 'public' check (privacy in ('public', 'private')),
  capacity integer,
  created_at timestamptz not null default now()
);

create index if not exists meetups_starts_at_idx on public.meetups (starts_at);

create table if not exists public.meetup_rsvps (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

-- meetups' own SELECT policy below references meetup_rsvps, so that table
-- has to exist first - both tables are created above, policies follow here.

alter table public.meetups enable row level security;

-- Public meetups are visible to everyone signed in; private ones only to
-- their host and whoever already RSVP'd (so a private meetup doesn't leak
-- to the whole app, but someone who was told about it and RSVP'd can still
-- see it again later).
drop policy if exists "meetups visibility" on public.meetups;
create policy "meetups visibility"
  on public.meetups for select
  using (
    privacy = 'public'
    or host_id = auth.uid()
    or exists (select 1 from public.meetup_rsvps r where r.meetup_id = id and r.user_id = auth.uid())
  );

drop policy if exists "users can create meetups" on public.meetups;
create policy "users can create meetups"
  on public.meetups for insert
  with check (auth.uid() = host_id);

drop policy if exists "hosts can update their own meetups" on public.meetups;
create policy "hosts can update their own meetups"
  on public.meetups for update
  using (auth.uid() = host_id);

drop policy if exists "hosts can delete their own meetups" on public.meetups;
create policy "hosts can delete their own meetups"
  on public.meetups for delete
  using (auth.uid() = host_id);

alter table public.meetup_rsvps enable row level security;

drop policy if exists "rsvps are readable by any signed-in user" on public.meetup_rsvps;
create policy "rsvps are readable by any signed-in user"
  on public.meetup_rsvps for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can rsvp for themselves" on public.meetup_rsvps;
create policy "users can rsvp for themselves"
  on public.meetup_rsvps for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can cancel their own rsvp" on public.meetup_rsvps;
create policy "users can cancel their own rsvp"
  on public.meetup_rsvps for delete
  using (auth.uid() = user_id);

select public.ensure_realtime('public', 'meetups');
select public.ensure_realtime('public', 'meetup_rsvps');

-- ============================================================================
-- marketplace_listings - simple buy/sell board for vehicles/gear. One photo,
-- a price, a contact phone, free-text location for the same lightweight
-- city-search pattern used elsewhere (no PostGIS, just substring match).
-- ============================================================================
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric,
  vehicle_type text check (vehicle_type in ('scooter', 'ebike', 'emotorcycle', 'other')),
  photo_url text,
  phone text not null,
  location_text text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_active_idx on public.marketplace_listings (active, created_at desc);

alter table public.marketplace_listings enable row level security;

drop policy if exists "listings are readable by any signed-in user" on public.marketplace_listings;
create policy "listings are readable by any signed-in user"
  on public.marketplace_listings for select
  using (auth.role() = 'authenticated');

drop policy if exists "users can create their own listings" on public.marketplace_listings;
create policy "users can create their own listings"
  on public.marketplace_listings for insert
  with check (auth.uid() = seller_id);

drop policy if exists "sellers can update their own listings" on public.marketplace_listings;
create policy "sellers can update their own listings"
  on public.marketplace_listings for update
  using (auth.uid() = seller_id);

drop policy if exists "sellers can delete their own listings" on public.marketplace_listings;
create policy "sellers can delete their own listings"
  on public.marketplace_listings for delete
  using (auth.uid() = seller_id);

select public.ensure_realtime('public', 'marketplace_listings');

-- ============================================================================
-- Storage buckets for the two new features' photos.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('meetup-covers', 'meetup-covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('marketplace-photos', 'marketplace-photos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated users can upload meetup covers" on storage.objects;
create policy "authenticated users can upload meetup covers"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'meetup-covers');

drop policy if exists "authenticated users can upload marketplace photos" on storage.objects;
create policy "authenticated users can upload marketplace photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'marketplace-photos');

-- ============================================================================
-- Round 4: remove-friend, multi-photo listings, view counters, meetup expiry
-- is handled client-side (same pattern as hazard 20-minute expiry) so no
-- schema change was needed for that one.
-- ============================================================================

-- remove_friend - there was previously no way to delete an *accepted*
-- friendship at all (only decline a pending request) - either side of the
-- friendship can end it.
create or replace function public.remove_friend(p_friendship_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.friendships
  where id = p_friendship_id
    and status = 'accepted'
    and (requester_id = auth.uid() or addressee_id = auth.uid());
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;

-- Up to 5 photos per listing now, instead of one. photo_url stays for any
-- rows already written by the previous version - the client just reads
-- photo_urls[0] as the cover when present, falling back to the old column.
alter table public.marketplace_listings add column if not exists photo_urls text[];

alter table public.marketplace_listings add column if not exists views integer not null default 0;
alter table public.meetups add column if not exists views integer not null default 0;

-- Both view-counters are bumped by anyone who opens the detail view, not
-- just the owner/host - the marketplace/meetup UPDATE policies are
-- owner-only, so this needs its own SECURITY DEFINER path.
create or replace function public.increment_listing_views(p_listing_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.marketplace_listings set views = views + 1 where id = p_listing_id;
end;
$$;

create or replace function public.increment_meetup_views(p_meetup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.meetups set views = views + 1 where id = p_meetup_id;
end;
$$;

grant execute on function public.increment_listing_views(uuid) to authenticated;
grant execute on function public.increment_meetup_views(uuid) to authenticated;

-- friend_ride_count - ride_log itself is locked to "own rows only" (real
-- route data), but a bare count for someone's profile card is no more
-- sensitive than the points total everyone can already see, so this is
-- open to any authenticated user rather than gated on being friends first.
create or replace function public.friend_ride_count(p_uid uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::integer from public.ride_log where user_id = p_uid and not hidden_from_user;
$$;

grant execute on function public.friend_ride_count(uuid) to authenticated;

-- lat/lng for listings too, same reason as meetups - lets the location field
-- use the real address-autocomplete instead of a freeform string.
alter table public.marketplace_listings add column if not exists lat double precision;
alter table public.marketplace_listings add column if not exists lng double precision;

-- ============================================================================
-- Admin dashboard access to meetups/marketplace: search, edit, remove, stats.
-- Multiple permissive policies for the same command are OR'd together in
-- Postgres RLS, so these add admin visibility/control on top of the existing
-- rider-scoped policies rather than replacing them - a private meetup is
-- still invisible to other riders, just not to admins.
-- ============================================================================
drop policy if exists "admins can read all meetups" on public.meetups;
create policy "admins can read all meetups"
  on public.meetups for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can update any meetup" on public.meetups;
create policy "admins can update any meetup"
  on public.meetups for update
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can delete any meetup" on public.meetups;
create policy "admins can delete any meetup"
  on public.meetups for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can update any listing" on public.marketplace_listings;
create policy "admins can update any listing"
  on public.marketplace_listings for update
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can delete any listing" on public.marketplace_listings;
create policy "admins can delete any listing"
  on public.marketplace_listings for delete
  using (public.is_admin(auth.uid()));

-- Hosts hard-delete their own meetups (unchanged - that's the existing,
-- expected behavior when a rider deletes their own event). An admin takedown
-- is soft instead, so the dashboard's "הוסרו" stat can actually count it -
-- a hard-deleted row leaves no trace to count.
alter table public.meetups add column if not exists removed boolean not null default false;

create or replace function public.admin_remove_meetup(p_meetup_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  update public.meetups set removed = true where id = p_meetup_id;
end;
$$;

grant execute on function public.admin_remove_meetup(uuid) to authenticated;
