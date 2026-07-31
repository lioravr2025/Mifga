-- Mifga - round 4: prize collect modes (single/multi), a per-user points
-- ledger (prize_collections + meetup_arrivals) so "My Points" can show a
-- real breakdown instead of just the running total, and automatic
-- meetup-arrival points. Safe to re-run, same convention as the other
-- schema files.

-- ============================================================================
-- prizes.collect_mode - 'single' (today's behavior: first tap/pass wins,
-- then the prize is gone for everyone) vs 'multi' (stays on the map, every
-- rider who passes within range collects it once, for themselves).
-- ============================================================================
alter table public.prizes add column if not exists collect_mode text not null default 'single' check (collect_mode in ('single', 'multi'));

-- ============================================================================
-- prize_collections - a per-user record of every prize collected, in EITHER
-- mode. This is what "My Points" sums for the "prizes" tile - profiles.points
-- alone is just a running total with no breakdown by source.
-- ============================================================================
create table if not exists public.prize_collections (
  prize_id uuid not null references public.prizes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  collected_at timestamptz not null default now(),
  primary key (prize_id, user_id)
);

alter table public.prize_collections enable row level security;

drop policy if exists "users can read their own prize collections" on public.prize_collections;
create policy "users can read their own prize collections"
  on public.prize_collections for select
  using (auth.uid() = user_id);

-- no insert/update policy for regular users - only written by collect_prize() below.

-- ============================================================================
-- collect_prize - rewritten to branch on collect_mode. Single mode keeps the
-- exact same atomic "first one wins" semantics as before (still logs to
-- prize_collections too, so the points breakdown works for single-mode
-- prizes as well). Multi mode never touches the prizes row itself - it just
-- records this user's own collection, once, via the primary key.
-- ============================================================================
create or replace function public.collect_prize(p_prize_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_points integer;
  v_mode text;
begin
  select points, collect_mode into v_points, v_mode from public.prizes where id = p_prize_id;
  if v_points is null then
    return -1; -- prize doesn't exist
  end if;

  if v_mode = 'multi' then
    insert into public.prize_collections (prize_id, user_id, points)
    values (p_prize_id, auth.uid(), v_points)
    on conflict (prize_id, user_id) do nothing;

    if not found then
      return -1; -- already collected by this rider
    end if;

    update public.profiles set points = points + v_points where id = auth.uid();
    return v_points;
  end if;

  -- single mode: atomic first-wins, same as before.
  update public.prizes
  set collected_by = auth.uid(), collected_at = now()
  where id = p_prize_id and collected_at is null
  returning points into v_points;

  if v_points is null then
    return -1; -- someone else already grabbed it
  end if;

  insert into public.prize_collections (prize_id, user_id, points) values (p_prize_id, auth.uid(), v_points);
  update public.profiles set points = points + v_points where id = auth.uid();
  return v_points;
end;
$$;

grant execute on function public.collect_prize(uuid) to authenticated;

-- ============================================================================
-- admin_seed_prizes - add p_collect_mode (default 'single' so nothing about
-- existing admin calls changes unless the dashboard explicitly asks for
-- 'multi'). Dropped and recreated (not just "or replace") for the same
-- reason as before: PostgREST needs exactly one overload to disambiguate.
-- ============================================================================
drop function if exists public.admin_seed_prizes(text, integer, double precision, double precision, integer, integer, text);

create or replace function public.admin_seed_prizes(
  p_icon text,
  p_points integer,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_count integer,
  p_icon_image_url text default null,
  p_collect_mode text default 'single'
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
  if p_collect_mode not in ('single', 'multi') then
    raise exception 'collect_mode must be single or multi';
  end if;

  for i in 1..p_count loop
    v_angle := random() * 2 * pi();
    v_dist := random() * p_radius_m;
    v_lat := p_lat + (v_dist * cos(v_angle)) / 111320.0;
    v_lng := p_lng + (v_dist * sin(v_angle)) / (111320.0 * cos(radians(p_lat)));
    insert into public.prizes (icon, icon_image_url, points, lat, lng, collect_mode)
    values (p_icon, p_icon_image_url, p_points, v_lat, v_lng, p_collect_mode);
  end loop;
  return p_count;
end;
$$;

grant execute on function public.admin_seed_prizes(text, integer, double precision, double precision, integer, integer, text, text) to authenticated;

-- ============================================================================
-- meetup_arrivals - automatic "you made it" points, awarded once per rider
-- per meetup when they're physically close to a meetup they RSVP'd to while
-- it's actually happening (checked client-side via GPS, awarded here
-- atomically so a flaky connection retry can't double-pay).
-- ============================================================================
create table if not exists public.meetup_arrivals (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points integer not null,
  arrived_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

alter table public.meetup_arrivals enable row level security;

drop policy if exists "users can read their own meetup arrivals" on public.meetup_arrivals;
create policy "users can read their own meetup arrivals"
  on public.meetup_arrivals for select
  using (auth.uid() = user_id);

-- Same value as a photo report (POINTS_PER_REPORT_WITH_PHOTO on the client) -
-- kept as a literal here rather than a lookup since it's a one-line constant,
-- not a config table.
create or replace function public.award_meetup_arrival(p_meetup_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_points integer := 5;
  v_going boolean;
begin
  select exists(
    select 1 from public.meetup_rsvps where meetup_id = p_meetup_id and user_id = auth.uid()
  ) into v_going;

  if not v_going then
    raise exception 'not rsvped to this meetup';
  end if;

  insert into public.meetup_arrivals (meetup_id, user_id, points)
  values (p_meetup_id, auth.uid(), v_points)
  on conflict (meetup_id, user_id) do nothing;

  if not found then
    return -1; -- already awarded
  end if;

  update public.profiles set points = points + v_points where id = auth.uid();
  return v_points;
end;
$$;

grant execute on function public.award_meetup_arrival(uuid) to authenticated;

-- ============================================================================
-- walkie_group_members.pinned - group-side equivalent of a friend's
-- favorite_by_requester/favorite_by_addressee flag: per-viewer, not a group
-- property, since two members can each pin a different subset of their own
-- groups to the top of their own Groups tab. Capped at 3 client-side, same
-- convention as MAX_FAVORITE_FRIENDS today.
-- ============================================================================
alter table public.walkie_group_members add column if not exists pinned boolean not null default false;

create or replace function public.toggle_group_pin(p_group_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.walkie_group_members
  set pinned = not pinned
  where group_id = p_group_id and member_id = auth.uid();
end;
$$;

grant execute on function public.toggle_group_pin(uuid) to authenticated;
