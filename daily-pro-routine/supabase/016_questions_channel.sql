-- Repline 1.11: #ask-a-question is a normal text channel now (no forum).
-- ask_threads keeps one row per channel as the read cursor; ask_answers remembers what the bot told whom,
-- so it doesn't repeat itself within an hour. Safe to run more than once.

create table if not exists public.ask_answers (
  id bigint generated always as identity primary key,
  user_id text not null,
  faq text not null,
  at timestamptz not null default now()
);
create index if not exists ask_answers_user_idx on public.ask_answers (user_id, at desc);
alter table public.ask_answers enable row level security;
revoke all on public.ask_answers from authenticated, anon;

delete from public.ask_threads where thread_id <> '1572188220970635324';
delete from public.ask_answers where at < now() - interval '30 days';
