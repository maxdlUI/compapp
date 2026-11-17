-- Repline 1.11: question bot for the #ask-a-question forum on Discord.
-- Discord can't push new forum posts to a website, so every minute the database pings the edge function "ask";
-- it reads new posts in the forum, answers them with the user mentioned, and asks a dev when it doesn't know.
-- Safe to run more than once. Runs on the free plan (one small call a minute).

create table if not exists public.ask_threads (
  thread_id text primary key,
  owner_id text,
  title text,
  last_seen text not null default '0',
  answered text[] not null default '{}',
  devs_pinged boolean not null default false,
  human boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ask_threads enable row level security;
revoke all on public.ask_threads from authenticated, anon;

create or replace function public.ping_questions()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/ask',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"poll": true}'::jsonb
  );
exception when others then null;
end; $$;
revoke all on function public.ping_questions() from public, anon, authenticated;

select cron.unschedule('repline-questions') where exists (select 1 from cron.job where jobname = 'repline-questions');
select cron.schedule('repline-questions', '* * * * *', 'select public.ping_questions()');
