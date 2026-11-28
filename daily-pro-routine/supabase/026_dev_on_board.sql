-- 026: the owner's dev account shows on the leaderboard like any player (owner, 28 Nov 2026). Prizes still skip dev accounts (period_rank).
create or replace function public.leaderboard(period text, friends_only boolean default false)
returns table(rank bigint, user_id uuid, username text, avatar_url text, points bigint, streak integer, is_me boolean, training_now boolean, total bigint, title text, name_color text, verified boolean)
language sql stable security definer set search_path to ''
as $$
  with today as (select (now() at time zone 'Europe/Berlin')::date as d),
  bounds as (
    select case period when 'month' then date_trunc('month', (select d from today))::date
                       else date_trunc('week', (select d from today))::date end as d0
  ),
  players as (
    select p.id, p.username, p.avatar_url from public.profiles p
    where case when friends_only then p.id = auth.uid() or public.is_friend(auth.uid(), p.id) else true end
  ),
  mins as (
    select t.user_id, sum(t.minutes)::bigint as m from public.training_days t
    where t.day >= (select d0 from bounds) group by t.user_id
  ),
  ver as (
    select distinct rr.user_id from public.routine_runs rr
    where rr.verified and rr.day >= (select d0 from bounds)
  ),
  board as (
    select pl.id, pl.username, pl.avatar_url, coalesce(mins.m, 0) as points, 0 as streak, (ver.user_id is not null) as verified
    from players pl left join mins on mins.user_id = pl.id left join ver on ver.user_id = pl.id
    where pl.id = auth.uid() or coalesce(mins.m, 0) > 0
  ),
  ranked as (
    select b.*, rank() over (order by b.points desc, b.username) as r, count(*) over () as total from board b
  )
  select r, id, username, avatar_url, points, streak, id = auth.uid(),
         friends_only and id <> auth.uid() and public.training_now(id), total, null::text, null::text, verified
  from ranked where r <= 50 or id = auth.uid() order by r limit 51;
$$;
revoke execute on function public.leaderboard(text, boolean) from public, anon;
grant execute on function public.leaderboard(text, boolean) to authenticated;
