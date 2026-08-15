-- Mifga - round 10: geo-fenced pilot launch (service area) + a waitlist for
-- riders outside it.
--
-- The service area itself lives in app_config (same singleton-row,
-- remote-controlled pattern already used for min_required_version/
-- update_message) so switching cities, changing the radius, editing the
-- explanation shown to riders, or turning the restriction off entirely is
-- an admin-dashboard edit - never an app release.

alter table public.app_config add column if not exists service_area_enabled boolean not null default true;
alter table public.app_config add column if not exists service_area_city_name text not null default 'חולון';
alter table public.app_config add column if not exists service_area_lat double precision not null default 32.0158;
alter table public.app_config add column if not exists service_area_lng double precision not null default 34.7874;
alter table public.app_config add column if not exists service_area_radius_km double precision not null default 5;
alter table public.app_config add column if not exists service_area_message text not null default 'מפגע פעילה כרגע רק בחולון - בקרוב גם אצלכם!';

-- ============================================================================
-- waitlist_signups - "notify me" list for riders outside the current service
-- area (and reusable later for the iOS-waitlist button on the landing page,
-- distinguished by `source`). Deliberately simple: phone + city is all the
-- product needs, and city aggregation is what tells the admin where to open
-- next.
-- ============================================================================
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  city text not null,
  source text not null default 'app_out_of_area',
  created_at timestamptz not null default now()
);

create index if not exists waitlist_signups_city_idx on public.waitlist_signups (city);

alter table public.waitlist_signups enable row level security;

drop policy if exists "signed-in riders can join the waitlist" on public.waitlist_signups;
create policy "signed-in riders can join the waitlist"
  on public.waitlist_signups for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "admins can read the waitlist" on public.waitlist_signups;
create policy "admins can read the waitlist"
  on public.waitlist_signups for select
  using (public.is_admin(auth.uid()));

drop policy if exists "admins can delete waitlist entries" on public.waitlist_signups;
create policy "admins can delete waitlist entries"
  on public.waitlist_signups for delete
  using (public.is_admin(auth.uid()));
