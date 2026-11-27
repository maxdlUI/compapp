-- 023: rate limits and input checks (27 Nov 2026, after the "vibe coding security" check).

-- ---------- Input checks: what players can write directly is kept small and well-formed ----------
alter table public.custom_routines add constraint custom_routines_sane check (
  char_length(name) between 1 and 60 and jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) <= 60 and octet_length(sets::text) <= 20000);
alter table public.user_state add constraint user_state_sane check (
  octet_length(coalesce(settings::text, '')) <= 65536 and octet_length(coalesce(focus::text, '')) <= 65536 and octet_length(coalesce(session::text, '')) <= 65536);
alter table public.training_days add constraint training_days_sane check (
  octet_length(coalesce(by_type::text, '')) <= 4096 and coalesce(routines, 0) between 0 and 100 and coalesce(minutes, 0) between 0 and 1440);
alter table public.aim_scores add constraint aim_scores_sane check (
  char_length(coalesce(scenario, '')) <= 120 and char_length(coalesce(sens, '')) <= 40
  and (score is null or (score > -1e7 and score < 1e7)) and (acc is null or (acc >= 0 and acc <= 100)));
-- Push subscriptions may only point at the browsers' own push services, so the reminder function never
-- sends requests to a server a player picked.
alter table public.reminders add constraint reminders_sane check (
  char_length(coalesce(tz, '')) <= 64 and coalesce(array_length(days, 1), 0) <= 7 and days <@ array[1,2,3,4,5,6,7]
  and octet_length(coalesce(push_sub::text, '')) <= 4096
  and (push_sub is null or (push_sub ->> 'endpoint') ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)/'));

-- ---------- Rate limits ----------
-- KovaaK's results: at most 2000 rows a day per player (a real day is a few hundred at most).
create or replace function public.aim_scores_limit()
returns trigger language plpgsql security definer set search_path to ''
as $$
begin
  if (select count(*) from public.aim_scores where user_id = new.user_id and played_at >= now() - interval '1 day') >= 2000 then
    raise exception 'rate_limited';
  end if;
  return new;
end; $$;
drop trigger if exists aim_scores_limit on public.aim_scores;
create trigger aim_scores_limit before insert on public.aim_scores for each row execute function public.aim_scores_limit();
revoke execute on function public.aim_scores_limit() from public, anon, authenticated;

-- Creator code: change it at most once a day (it decides who earns the commission).
create or replace function public.set_creator_code(c text)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare me uuid := auth.uid(); cr uuid; nm text; last timestamptz;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  if char_length(coalesce(c, '')) > 40 then return jsonb_build_object('error', 'not_found'); end if;
  select creator_set_at into last from public.profiles where id = me;
  if last is not null and last > now() - interval '1 day' then return jsonb_build_object('error', 'too_soon'); end if;
  cr := public.creator_by_code(c);
  if cr is null then return jsonb_build_object('error', 'not_found'); end if;
  if cr = me then return jsonb_build_object('error', 'self'); end if;
  update public.profiles set creator_id = cr, creator_set_at = now() where id = me;
  select username into nm from public.profiles where id = cr;
  return jsonb_build_object('creator', nm, 'code', lower(trim(c)));
end; $$;

-- Shared routine imports: each player counts once per routine.
create table if not exists public.share_import_counts (user_id uuid not null, code text not null, at timestamptz not null default now(), primary key (user_id, code));
alter table public.share_import_counts enable row level security;
create or replace function public.count_import(r_code text)
returns void language plpgsql security definer set search_path to ''
as $$
declare n int;
begin
  if auth.uid() is null or char_length(coalesce(r_code, '')) > 40 then return; end if;
  insert into public.share_import_counts (user_id, code) values (auth.uid(), upper(trim(r_code))) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update public.shared_routines set imports = imports + 1 where code = upper(trim(r_code)) and owner <> auth.uid(); end if;
end; $$;

-- Referral link clicks (anyone can call this): at most one counted click per code every 5 seconds.
alter table public.referral_codes add column if not exists last_click_at timestamptz;
create or replace function public.track_ref_click(ref_code text)
returns void language sql security definer set search_path to ''
as $$
  update public.referral_codes set clicks = clicks + 1, last_click_at = now()
  where code = lower(left(coalesce(ref_code, ''), 20)) and (last_click_at is null or last_click_at < now() - interval '5 seconds');
$$;

-- ---------- Our own background calls carry a key, so nobody else can trigger the bot functions ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.app_keys (name text primary key, value text not null);
insert into private.app_keys (name, value) values ('cron', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (name) do nothing;
create or replace function public.check_cron_key(k text)
returns boolean language sql stable security definer set search_path to ''
as $$ select exists (select 1 from private.app_keys where name = 'cron' and value = k); $$;
revoke execute on function public.check_cron_key(text) from public, anon, authenticated;
grant execute on function public.check_cron_key(text) to service_role;
create or replace function private.cron_headers()
returns jsonb language sql stable security definer set search_path to ''
as $$ select jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', (select value from private.app_keys where name = 'cron')); $$;

create or replace function public.ping_questions()
returns void language plpgsql security definer set search_path to ''
as $$
begin
  perform net.http_post(url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/ask', headers := private.cron_headers(), body := '{"poll": true}'::jsonb);
exception when others then null;
end; $$;
create or replace function public.ping_remind(b jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to ''
as $$
begin
  perform net.http_post(url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/remind', headers := private.cron_headers(), body := b);
exception when others then null;
end; $$;
create or replace function public.ping_bugs()
returns void language plpgsql security definer set search_path to ''
as $$
begin
  perform net.http_post(url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/discord', headers := private.cron_headers(), body := '{"bugs": true}'::jsonb);
exception when others then null;
end; $$;
create or replace function public.dev_gift(discord_name text, gift_plan text, months integer, note text default null)
returns jsonb language plpgsql security definer set search_path to ''
as $$
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
  perform public.ping_remind('{"gifts": true}'::jsonb);
  return jsonb_build_object('username', tname, 'until', (select bonus_until from public.profiles where id = target));
end; $$;
revoke execute on function public.ping_bugs() from public, anon, authenticated;
revoke execute on function public.ping_questions() from public, anon, authenticated;
revoke execute on function public.ping_remind(jsonb) from public, anon, authenticated;
select cron.alter_job((select jobid from cron.job where jobname = 'repline-remind'), command := 'select public.ping_remind()');
