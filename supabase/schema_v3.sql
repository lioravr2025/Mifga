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
