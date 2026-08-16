-- Mifga - round 11: push token upsert was silently failing on re-registration.
--
-- push_tokens (schema_v6.sql) had insert/update/delete policies but no
-- SELECT policy at all - the comment there reasoned "a rider never needs to
-- read anyone's token" and left it default-deny. That's true for ad-hoc
-- reads, but the client's upsert() (register on every app start, harmless
-- idempotent re-registration when the FCM token hasn't rotated) compiles to
-- INSERT ... ON CONFLICT (user_id, token) DO UPDATE - and Postgres RLS
-- requires SELECT privileges on the table to even evaluate whether a
-- conflicting row exists. With no SELECT policy, a fresh token (no existing
-- row, no conflict) inserted fine, but re-sending an unrotated token failed
-- outright - exactly the "push: saving token failed" errors showing up in
-- client_error_logs. Scoped the same way every other policy on this table
-- already is: a rider can only ever see their own token rows.

drop policy if exists "users can read their own push tokens" on public.push_tokens;
create policy "users can read their own push tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);
