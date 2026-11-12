-- Repline 1.6 (part 2): plans gifted by dev accounts, in-app notices, and the reminder schedule.
-- Safe to run more than once.

-- ---------- Notices shown once in the app (gifts, news) ----------
create table if not exists public.notices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists notices_user_idx on public.notices (user_id) where seen_at is null;
alter table public.notices enable row level security;
drop policy if exists "own notices read" on public.notices;
drop policy if exists "own notices seen" on public.notices;
create policy "own notices read" on public.notices for select to authenticated using ((select auth.uid()) = user_id);
create policy "own notices seen" on public.notices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.notices from authenticated;
grant update (seen_at) on public.notices to authenticated;

-- ---------- Dev accounts gift a plan by Discord name ----------
create or replace function public.dev_gift(discord_name text, gift_plan text, months integer, note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid; tname text; sender text;
begin
  select username into sender from public.profiles where id = me and is_dev;
  if not found then raise exception 'not_dev'; end if;
  if gift_plan not in ('standard', 'pro') or months is null or months < 1 or months > 12 then raise exception 'bad_input'; end if;
  select id, username into target, tname from public.profiles where lower(username) = lower(trim(both '@' from trim(discord_name))) limit 1;
  if target is null then raise exception 'not_found'; end if;
  perform public.grant_plan(target, gift_plan, months * 30);
  insert into public.notices (user_id, kind, payload) values (target, 'gift',
    jsonb_build_object('plan', gift_plan, 'months', months, 'from', sender, 'note', nullif(left(trim(coalesce(note, '')), 140), '')));
  insert into public.rewards (user_id, kind, period) values (target, 'gift', now()::text) on conflict do nothing;
  return jsonb_build_object('username', tname, 'until', (select bonus_until from public.profiles where id = target));
end; $$;
revoke all on function public.dev_gift(text, text, integer, text) from public, anon;
grant execute on function public.dev_gift(text, text, integer, text) to authenticated;

-- ---------- Reminder schedule: every 5 minutes the "remind" edge function sends what is due ----------
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.unschedule(jobid) from cron.job where jobname = 'repline-remind';
select cron.schedule('repline-remind', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/remind',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);
