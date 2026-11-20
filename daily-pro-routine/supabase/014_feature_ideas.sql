-- Repline 1.11: feature ideas through the same bot as bug reports (#suggest-a-feature, /idea, Settings → Suggest a feature).
-- Ideas live in bug_reports with kind = 'idea'; everyone can upvote an idea once (idea_votes).
-- Status for ideas: new · working (= planned) · fixed (= done) · notabug (= not now).
-- Safe to run more than once.

alter table public.bug_reports add column if not exists kind text not null default 'bug';
alter table public.bug_reports drop constraint if exists bug_reports_kind_check;
alter table public.bug_reports add constraint bug_reports_kind_check check (kind in ('bug', 'idea'));
alter table public.bug_reports add column if not exists votes integer not null default 0;
alter table public.bug_reports add column if not exists vote_msg text;

create table if not exists public.idea_votes (
  report_id bigint not null references public.bug_reports (id) on delete cascade,
  voter text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, voter)
);
alter table public.idea_votes enable row level security;
revoke all on public.idea_votes from authenticated, anon;

-- Idea from the app.
create or replace function public.suggest_feature(idea_text text, why_text text default null, app_platform text default null, app_version text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); rid bigint; did text; dname text;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  if char_length(coalesce(trim(idea_text), '')) < 3 then return jsonb_build_object('error', 'too_short'); end if;
  if (select count(*) from public.bug_reports where user_id = me and kind = 'idea' and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  select discord_id, username into did, dname from public.profiles where id = me;
  insert into public.bug_reports (kind, source, user_id, discord_id, discord_name, what, before, platform, version)
  values ('idea', 'app', me, did, dname, left(trim(idea_text), 1500), left(why_text, 1000), left(app_platform, 60), left(app_version, 40))
  returning id into rid;
  perform public.ping_bugs();
  return jsonb_build_object('ok', true, 'id', rid);
end; $$;
revoke all on function public.suggest_feature(text, text, text, text) from public, anon;
grant execute on function public.suggest_feature(text, text, text, text) to authenticated;
