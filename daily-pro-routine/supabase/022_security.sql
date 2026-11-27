-- 022: security check (27 Nov 2026).

-- 1) Playtime can't be written by hand for days before verified runs began (runs_since = 2026-11-17).
--    Before: the clamp skipped those days, so a player could insert or raise minutes there through the API
--    and climb the November board or fake invite progress. Now: new rows for those days start at zero,
--    and existing rows keep their old numbers.
create or replace function public.clamp_training_day()
returns trigger language plpgsql security definer set search_path to ''
as $$
declare cnt integer; mins integer;
begin
  if new.day < public.runs_since() then
    if tg_op = 'INSERT' then
      new.routines := 0; new.minutes := 0;
    else
      new.routines := least(coalesce(new.routines, 0), coalesce(old.routines, 0));
      new.minutes := least(coalesce(new.minutes, 0), coalesce(old.minutes, 0));
    end if;
    return new;
  end if;
  select count(*) filter (where counted),
         coalesce(sum(least(planned_min + 30, extract(epoch from (coalesce(finished_at, least(now(), started_at + interval '12 hours')) - started_at)) / 60))
                  filter (where counted or finished_at is null), 0)::int
    into cnt, mins
  from public.routine_runs where user_id = new.user_id and day = new.day;
  new.routines := least(coalesce(new.routines, 0), cnt);
  new.minutes := least(coalesce(new.minutes, 0), mins, 1440);
  return new;
end; $$;

-- 2) Profile pictures only from Discord's CDN, so nobody can point theirs at a server that logs who looks at the leaderboard.
create or replace function public.guard_avatar()
returns trigger language plpgsql set search_path to ''
as $$
begin
  if new.avatar_url is not null and new.avatar_url !~ '^https://cdn\.discordapp\.com/[A-Za-z0-9_./?=&-]+$' then
    new.avatar_url := case when tg_op = 'UPDATE' then old.avatar_url else null end;
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_avatar on public.profiles;
create trigger profiles_guard_avatar before insert or update of avatar_url on public.profiles
  for each row execute function public.guard_avatar();

-- 3) Internal helpers can't be called from outside (they run inside other functions as the owner).
revoke execute on function public.clamp_training_day() from public, anon, authenticated;
revoke execute on function public.guard_avatar() from public, anon, authenticated;
revoke execute on function public.period_rank(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.effective_plan(uuid) from public, anon, authenticated;
revoke execute on function public.routine_limit(uuid) from public, anon, authenticated;
revoke execute on function public.training_now(uuid) from public, anon, authenticated;
revoke execute on function public.is_friend(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.creator_by_code(text) from public, anon, authenticated;
-- signed-in only: the leaderboard and the dev check (the website shows the board only after sign-in)
revoke execute on function public.leaderboard(text, boolean) from public, anon;
revoke execute on function public.is_dev_user() from public, anon;
