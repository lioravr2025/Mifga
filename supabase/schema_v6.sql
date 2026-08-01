-- Mifga - round 6: real push notifications (Android first - see the
-- session notes on why iOS needs a separate Apple Developer Program setup
-- before it can follow). Two parts: a token registry the app writes to
-- directly, and a scheduled job that reminds riders about meetups they're
-- actually attending, happening today.

-- ============================================================================
-- push_tokens - one row per (rider, device). A rider can have more than one
-- device registered at once (primary key covers that); FCM tokens rotate
-- occasionally, so this is an upsert target, not append-only.
-- ============================================================================
create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

-- No SELECT policy for regular users at all (default-deny) - a rider never
-- needs to read anyone's token, including their own; only the Edge
-- Functions (via the service-role key, which bypasses RLS entirely) ever
-- read this table.
drop policy if exists "users manage their own push tokens" on public.push_tokens;
create policy "users manage their own push tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "users can update their own push tokens" on public.push_tokens;
create policy "users can update their own push tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "users can delete their own push tokens" on public.push_tokens;
create policy "users can delete their own push tokens"
  on public.push_tokens for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Scheduled trigger for the meetup-reminders Edge Function, once daily.
-- pg_cron/pg_net are Supabase-managed Postgres extensions available on every
-- tier including free. The shared secret below must match the CRON_SECRET
-- environment variable set on the meetup-reminders function - it's the only
-- thing stopping a random request from triggering a mass-notification blast
-- (this endpoint has no per-user auth, since pg_cron calls it server-side
-- with nobody "logged in").
--
-- This repo is public, so the real secret is deliberately NOT written here -
-- replace <CRON_SECRET> below with the actual value (see the deployment
-- notes) before running this file, so it never enters git history.
--
-- 06:00 UTC ≈ 08:00-09:00 Israel time depending on daylight saving - close
-- enough for a morning reminder without needing real timezone-aware
-- scheduling.
-- ============================================================================
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('mifga-meetup-morning-reminders')
where exists (select 1 from cron.job where jobname = 'mifga-meetup-morning-reminders');

select cron.schedule(
  'mifga-meetup-morning-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://tmmyimiubfnpkujulqll.supabase.co/functions/v1/meetup-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
