-- 020: Drops removed (owner, 27 Nov 2026). Leaderboards rank by playtime: minutes of counted routines.
-- training_days.minutes is already clamped to counted runs (010_verified_runs.sql), so it is the server-checked playtime.

-- Leaderboard: same columns as before so old app versions keep working; "points" now holds minutes.
create or replace function public.leaderboard(period text, friends_only boolean default false)
returns table(rank bigint, user_id uuid, username text, avatar_url text, points bigint, streak integer, is_me boolean,
              training_now boolean, total bigint, title text, name_color text, verified boolean)
language sql stable security definer set search_path to ''
as $$
  with today as (select (now() at time zone 'Europe/Berlin')::date as d),
  bounds as (
    select case period when 'month' then date_trunc('month', (select d from today))::date
                       else date_trunc('week', (select d from today))::date end as d0
  ),
  players as (
    select p.id, p.username, p.avatar_url from public.profiles p
    where case when friends_only then p.id = auth.uid() or public.is_friend(auth.uid(), p.id)
               else not p.is_dev and p.created_at <= now() - interval '7 days' end
  ),
  mins as (
    select t.user_id, sum(t.minutes)::bigint as m from public.training_days t
    where t.day >= (select d0 from bounds) group by t.user_id
  ),
  cur as (
    select t.user_id, max(t.streak) as streak from public.training_days t
    where t.day >= (select d from today) - 1 group by t.user_id
  ),
  ver as (
    select distinct rr.user_id from public.routine_runs rr
    where rr.verified and rr.day >= case when period = 'streaks' then (select d from today) - 6 else (select d0 from bounds) end
  ),
  board as (
    select pl.id, pl.username, pl.avatar_url, coalesce(mins.m, 0) as points, coalesce(cur.streak, 0) as streak,
           (ver.user_id is not null) as verified
    from players pl left join mins on mins.user_id = pl.id left join cur on cur.user_id = pl.id left join ver on ver.user_id = pl.id
    where pl.id = auth.uid() or (case when period = 'streaks' then coalesce(cur.streak, 0) > 0 else coalesce(mins.m, 0) > 0 end)
  ),
  ranked as (
    select b.*, rank() over (order by case when period = 'streaks' then b.streak::bigint else b.points end desc, b.username) as r,
           count(*) over () as total
    from board b
  )
  select r, id, username, avatar_url, points, streak, id = auth.uid(),
         friends_only and id <> auth.uid() and public.training_now(id), total, null::text, null::text, verified
  from ranked where r <= 50 or id = auth.uid() order by r limit 51;
$$;
grant execute on function public.leaderboard(text, boolean) to authenticated;

-- Rank used for the weekly and monthly prizes: playtime too.
create or replace function public.period_rank(uid uuid, d0 date, d1 date)
returns bigint language sql stable security definer set search_path to ''
as $$
  with mins as (
    select t.user_id, sum(t.minutes) as m from public.training_days t
    where t.day >= d0 and t.day < d1 group by t.user_id
  ), board as (
    select mins.user_id, mins.m from mins join public.profiles p on p.id = mins.user_id
    where not p.is_dev and p.created_at <= d1 - interval '7 days' and mins.m > 0
  ), r as (select user_id, rank() over (order by m desc) as rk from board)
  select rk from r where user_id = uid;
$$;

-- Drops: jackpot job, functions, tables. Titles and name colors came from Drops only.
do $$ begin perform cron.unschedule('repline-jackpot'); exception when others then null; end $$;
drop trigger if exists user_items_gold_skin on public.user_items;
drop function if exists public.grant_gold_skin();
drop function if exists public.spin_drop(date, boolean);
drop function if exists public.drop_status(date);
drop function if exists public.equip_item(text, text);
drop function if exists public.draw_jackpot();
drop function if exists public.ping_drops();
drop function if exists public.spins_earned(uuid, date);
drop function if exists public.drop_tier(text);
drop table if exists public.jackpots, public.drops, public.user_items, public.drop_items cascade;
update public.profiles set title = null, name_color = null where title is not null or name_color is not null;
