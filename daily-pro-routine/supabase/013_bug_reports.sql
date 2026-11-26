-- Repline 1.11: bug reports from Discord (#report-a-bug, /bug) and from the app (Settings → Report a bug).
-- The edge function "discord" sorts each report, opens a thread, asks the reporter follow-up questions by DM,
-- DMs the devs, and thanks the reporter when a dev marks it fixed. A daily check by Claude reads new reports.
-- Safe to run more than once.

create table if not exists public.bug_reports (
  id bigint generated always as identity primary key,
  source text not null check (source in ('discord', 'app')),
  user_id uuid references auth.users (id) on delete set null,
  discord_id text,
  discord_name text,
  where_ text check (char_length(where_) <= 100),
  what text not null check (char_length(what) between 3 and 1500),
  before text check (char_length(before) <= 1000),
  version text check (char_length(version) <= 40),
  platform text check (char_length(platform) <= 60),
  browser text check (char_length(browser) <= 300),
  page text check (char_length(page) <= 80),
  last_error text check (char_length(last_error) <= 600),
  freq text,
  extra text check (char_length(extra) <= 1500),
  area text,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  similar_count integer not null default 0,
  status text not null default 'new' check (status in ('new', 'working', 'fixed', 'notabug')),
  thread_id text,
  posted_at timestamptz,
  analyzed_at timestamptz,
  analysis text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bug_reports_new_idx on public.bug_reports (posted_at) where posted_at is null;
create index if not exists bug_reports_user_idx on public.bug_reports (user_id);
alter table public.bug_reports enable row level security;
drop policy if exists "own bugs read" on public.bug_reports;
create policy "own bugs read" on public.bug_reports for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.bug_reports from authenticated, anon;

-- Ask the edge function to handle new reports (it reads them from the table; the body carries nothing to trust).
create or replace function public.ping_bugs()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/discord',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"bugs": true}'::jsonb
  );
exception when others then null;
end; $$;
revoke all on function public.ping_bugs() from public, anon, authenticated;

-- Report from the app. Version, device and the last error come from the app itself.
create or replace function public.report_bug(what_text text, before_text text default null, where_text text default null,
  app_version text default null, app_platform text default null, app_browser text default null, app_page text default null, app_error text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid bigint; did text; dname text;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  if char_length(coalesce(trim(what_text), '')) < 3 then return jsonb_build_object('error', 'too_short'); end if;
  if (select count(*) from public.bug_reports where user_id = me and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  select discord_id, username into did, dname from public.profiles where id = me;
  insert into public.bug_reports (source, user_id, discord_id, discord_name, where_, what, before, version, platform, browser, page, last_error)
  values ('app', me, did, dname, left(where_text, 100), left(trim(what_text), 1500), left(before_text, 1000), left(app_version, 40),
          left(app_platform, 60), left(app_browser, 300), left(app_page, 80), left(app_error, 600))
  returning id into rid;
  perform public.ping_bugs();
  return jsonb_build_object('ok', true, 'id', rid);
end; $$;
revoke all on function public.report_bug(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.report_bug(text, text, text, text, text, text, text, text) to authenticated;
