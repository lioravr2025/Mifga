-- Mifga - round 9: a "not there anymore" vote used to extend a hazard's life
-- instead of shortening it.
--
-- deny_hazard() (schema.sql:154-172) set last_vote_at = now() on every deny
-- vote, same as confirm_hazard() does on a confirm. Since a police/inspector
-- report's 20-minute visibility window (HAZARD_EXPIRY_MS in
-- src/data/hazardTypes.ts) is measured from last_vote_at, a deny vote that
-- didn't cross the 5-denial removal threshold was actually resetting the
-- clock and keeping a stale report alerting other riders for another 20
-- minutes - the opposite of what a "it's not there" vote should do. Only a
-- confirm (which really does mean "I just saw it, it's still there") should
-- extend the window now; a deny either fully removes the report (5th denial)
-- or does nothing to its freshness.

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
        removed = (denials + 1) >= 5
    where id = p_hazard_id;
  end if;
end;
$$;

grant execute on function public.deny_hazard(uuid) to authenticated;
