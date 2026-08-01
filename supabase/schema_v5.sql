-- Mifga - round 5: prize expiry (admin-configurable, in days) and
-- explicit-position seeding RPCs so the admin dashboard can validate every
-- scatter point against Israel's land boundary client-side before it's ever
-- written to the database (see src/lib/israelBounds.ts) instead of trusting
-- a blind server-side random-radius scatter that can land in the sea.

-- ============================================================================
-- prizes.expires_at - optional, admin-set at seed time. Same client-side
-- filtering pattern as hazard expiry (HAZARD_EXPIRY_TYPES/isHazardExpired)
-- rather than a server-side cleanup job - null means "never expires" (today's
-- behavior, unchanged for anything seeded before this).
-- ============================================================================
alter table public.prizes add column if not exists expires_at timestamptz;

-- ============================================================================
-- admin_seed_hazards_at / admin_seed_prizes_at - insert at explicit
-- positions instead of computing a random scatter server-side. The admin
-- dashboard now generates and land-validates candidate points itself (see
-- israelBounds.ts) and passes only the validated ones here. The original
-- admin_seed_hazards/admin_seed_prizes are left in place, unused by the
-- current UI but not removed - no reason to break anything that might still
-- reference them.
-- ============================================================================
create or replace function public.admin_seed_hazards_at(p_type text, p_positions jsonb)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_pos jsonb;
  v_count integer := 0;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  if jsonb_array_length(p_positions) > 200 then
    raise exception 'count must be 200 or fewer';
  end if;

  for v_pos in select * from jsonb_array_elements(p_positions) loop
    insert into public.hazards (type, lat, lng, reporter_id, reporter_name)
    values (p_type, (v_pos->>'lat')::double precision, (v_pos->>'lng')::double precision, null, 'דיווח מערכת');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.admin_seed_hazards_at(text, jsonb) to authenticated;

create or replace function public.admin_seed_prizes_at(
  p_icon text,
  p_points integer,
  p_positions jsonb,
  p_icon_image_url text default null,
  p_collect_mode text default 'single',
  p_expiry_days integer default null
)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_pos jsonb;
  v_count integer := 0;
  v_expires_at timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not an admin';
  end if;
  if jsonb_array_length(p_positions) > 200 then
    raise exception 'count must be 200 or fewer';
  end if;
  if p_points < 1 then
    raise exception 'points must be positive';
  end if;
  if p_collect_mode not in ('single', 'multi') then
    raise exception 'collect_mode must be single or multi';
  end if;
  if p_expiry_days is not null and p_expiry_days < 1 then
    raise exception 'expiry_days must be positive';
  end if;

  v_expires_at := case when p_expiry_days is not null then now() + (p_expiry_days || ' days')::interval else null end;

  for v_pos in select * from jsonb_array_elements(p_positions) loop
    insert into public.prizes (icon, icon_image_url, points, lat, lng, collect_mode, expires_at)
    values (p_icon, p_icon_image_url, p_points, (v_pos->>'lat')::double precision, (v_pos->>'lng')::double precision, p_collect_mode, v_expires_at);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.admin_seed_prizes_at(text, integer, jsonb, text, text, integer) to authenticated;
