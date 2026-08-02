-- Mifga - round 7: let a rider undo their own hazard report (mainly for the
-- one-tap police/inspector quick-add, which has no confirmation step at all
-- and is exactly the kind of button a thumb mis-taps while riding) - but
-- only while nobody has confirmed it's actually still there. Once even one
-- other rider has confirmed it, it's no longer just "my mistake to undo",
-- so self-delete is intentionally blocked at that point.

create or replace function public.delete_own_hazard(p_hazard_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.hazards
  set removed = true
  where id = p_hazard_id
    and reporter_id = auth.uid()
    and confirmations = 0
    and removed = false;

  if not found then
    raise exception 'cannot delete this report - it may already be confirmed, removed, or not yours';
  end if;
end;
$$;

grant execute on function public.delete_own_hazard(uuid) to authenticated;
