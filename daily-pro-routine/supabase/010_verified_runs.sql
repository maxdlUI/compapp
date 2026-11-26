-- Repline 1.8: routines that really count, and KovaaK's progress.
--  * The server notes when a routine starts. At the end enough real time must have passed (the device clock doesn't count).
--  * Windows app: Fortnite / KovaaK's must have been running in at least 80 % of the game sets (process list only).
--    Such a routine is "Verified": it shows on the leaderboard and its spin gives 2 Golden Tickets.
--  * Only counted routines give spins, the +25 routine points and leaderboard minutes (from runs_since() on).
--  * aim_scores: KovaaK's results the Windows app reads from KovaaK's own stats files.
-- Safe to run more than once.

-- The first day the new rules apply: the day after this file was first run (Berlin time).
do $$ begin
  if to_regprocedure('public.runs_since()') is null then
    execute format('create function public.runs_since() returns date language sql immutable set search_path = '''' as $f$ select %L::date $f$',
      ((now() at time zone 'Europe/Berlin')::date + 1)::text);
  end if;
end $$;
grant execute on function public.runs_since() to authenticated;

-- ---------- One row per routine started ----------
create table if not exists public.routine_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  goal text not null default '' check (char_length(goal) <= 80),
  len text not null default '' check (char_length(len) <= 40),
  planned_min integer not null check (planned_min between 0 and 1440),
  source text not null default 'web' check (source in ('web', 'win')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  detect boolean not null default false,
  game_sec integer not null default 0,
  need_sec integer not null default 0,
  counted boolean not null default false,
  verified boolean not null default false,
  reason text
);
create index if not exists routine_runs_user_day_idx on public.routine_runs (user_id, day);
alter table public.routine_runs enable row level security;
drop policy if exists "own runs read" on public.routine_runs;
create policy "own runs read" on public.routine_runs for select to authenticated using ((select auth.uid()) = user_id);
-- writes only through run_start / run_finish
revoke insert, update, delete on public.routine_runs from authenticated, anon;

create or replace function public.run_start(client_day date, goal_id text, len_id text, planned integer, src text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  rid bigint;
begin
  if me is null then return null; end if;
  if (select count(*) from public.routine_runs where user_id = me and day = d) >= 30 then return null; end if;
  insert into public.routine_runs (user_id, day, goal, len, planned_min, source)
  values (me, d, left(coalesce(goal_id, ''), 80), left(coalesce(len_id, ''), 40), greatest(0, least(1440, coalesce(planned, 0))),
          case when src = 'win' then 'win' else 'web' end)
  returning id into rid;
  return rid;
end; $$;
revoke all on function public.run_start(date, text, text, integer, text) from public, anon;
grant execute on function public.run_start(date, text, text, integer, text) to authenticated;

-- detect: game detection was on in the Windows app. game_sec / need_sec: seconds the right game ran / seconds of game sets.
create or replace function public.run_finish(run_id bigint, detect_on boolean, game_s integer, need_s integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.routine_runs;
  real_s integer; plan_s integer; g integer; n integer; t_ok boolean; g_ok boolean; ok boolean; ver boolean; why text; cnt integer;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  select * into r from public.routine_runs where id = run_id and user_id = me for update;
  if not found then return jsonb_build_object('error', 'no_run'); end if;
  if r.finished_at is not null then
    return jsonb_build_object('counted', r.counted, 'verified', r.verified, 'reason', r.reason, 'real_sec', extract(epoch from r.finished_at - r.started_at)::int,
      'planned_sec', r.planned_min * 60, 'game_sec', r.game_sec, 'need_sec', r.need_sec, 'again', true);
  end if;
  real_s := extract(epoch from now() - r.started_at)::int;
  plan_s := r.planned_min * 60;
  n := greatest(0, least(coalesce(need_s, 0), plan_s, real_s));
  g := greatest(0, least(coalesce(game_s, 0), n));
  t_ok := real_s >= plan_s * 0.95 - 30;
  g_ok := r.source <> 'win' or not coalesce(detect_on, false) or n = 0 or g >= n * 0.8;
  ok := t_ok and g_ok;
  ver := ok and r.source = 'win' and coalesce(detect_on, false) and n > 0;
  why := case when not t_ok then 'too_fast' when not g_ok then 'no_game' end;
  update public.routine_runs set finished_at = now(), detect = coalesce(detect_on, false), game_sec = g, need_sec = n, counted = ok, verified = ver, reason = why
  where id = r.id;
  if ok then
    select count(*) into cnt from public.routine_runs where user_id = me and day = r.day and counted;
    insert into public.training_days (user_id, day, routines) values (me, r.day, cnt)
    on conflict (user_id, day) do update set routines = greatest(public.training_days.routines, excluded.routines);
  end if;
  return jsonb_build_object('counted', ok, 'verified', ver, 'reason', why, 'real_sec', real_s, 'planned_sec', plan_s, 'game_sec', g, 'need_sec', n);
end; $$;
revoke all on function public.run_finish(bigint, boolean, integer, integer) from public, anon;
grant execute on function public.run_finish(bigint, boolean, integer, integer) to authenticated;

-- ---------- training_days can't claim more than the runs show ----------
create or replace function public.clamp_training_day()
returns trigger language plpgsql security definer set search_path = '' as $$
declare cnt integer; mins integer;
begin
  if new.day < public.runs_since() then return new; end if;
  select count(*) filter (where counted),
         coalesce(sum(least(planned_min + 30, extract(epoch from (coalesce(finished_at, least(now(), started_at + interval '12 hours')) - started_at)) / 60))
                  filter (where counted or finished_at is null), 0)::int
    into cnt, mins
  from public.routine_runs where user_id = new.user_id and day = new.day;
  new.routines := least(coalesce(new.routines, 0), cnt);
  new.minutes := least(coalesce(new.minutes, 0), mins, 1440);
  return new;
end; $$;
drop trigger if exists training_days_clamp on public.training_days;
create trigger training_days_clamp before insert or update on public.training_days
  for each row execute function public.clamp_training_day();

-- ---------- Spins come from counted runs; a Verified run's spin gives 2 Golden Tickets ----------
alter table public.drops add column if not exists tickets integer not null default 1 check (tickets between 0 and 5);

create or replace function public.spins_earned(uid uuid, d date)
returns integer language sql stable security definer set search_path = '' as $$
  select least(3, case when d < public.runs_since()
    then (select coalesce(max(routines), 0) from public.training_days where user_id = uid and day = d)
    else (select count(*)::int from public.routine_runs where user_id = uid and day = d and counted) end);
$$;
revoke all on function public.spins_earned(uuid, date) from public, anon, authenticated;

create or replace function public.spin_drop(client_day date, freezes_full boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date; earned int; used int; since int; r double precision; k text; it text; pts int := 0; t int; tk int := 1;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  if not exists (select 1 from public.profiles where id = me and discord_id is not null) then return jsonb_build_object('error', 'no_discord'); end if;
  perform pg_advisory_xact_lock(hashtext('spin:' || me::text));
  d := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  earned := public.spins_earned(me, d);
  select count(*) into used from public.drops where user_id = me and day = d;
  if used >= earned then return jsonb_build_object('error', 'no_spins', 'earned', earned, 'used', used); end if;
  -- the (used+1)-th counted run of the day pays this spin: Verified gives 2 tickets
  select case when x.verified then 2 else 1 end into tk from (
    select verified from public.routine_runs where user_id = me and day = d and counted order by finished_at, id offset used limit 1) x;
  tk := coalesce(tk, 1);

  -- bad-luck protection: at the latest every 10th spin is an item or better
  select count(*) into since from public.drops
    where user_id = me and id > coalesce((select max(id) from public.drops where user_id = me and public.drop_tier(prize) >= 2), 0);
  r := random() * 100;
  if since >= 9 then r := 80 + random() * 20; end if;
  if r < 55 then k := (array['pts10', 'pts15', 'pts25'])[1 + floor(random() * 3)::int];
  elsif r < 80 then k := case when random() < 0.5 then 'freeze' else 'pts50' end;
  elsif r < 94 then k := 'item';
  elsif r < 99 then k := 'pro3d';
  elsif r < 99.998 then k := 'pro1m';
  else k := 'prolife'; end if;

  if k = 'freeze' and freezes_full then k := 'pts50'; end if;
  if k = 'item' then
    select i.id into it from public.drop_items i
      where not i.exclusive and not exists (select 1 from public.user_items u where u.user_id = me and u.item = i.id)
      order by random() limit 1;
    if it is null then k := 'pts50'; else insert into public.user_items (user_id, item) values (me, it) on conflict do nothing; end if;
  end if;
  pts := case k when 'pts10' then 10 when 'pts15' then 15 when 'pts25' then 25 when 'pts50' then 50 else 0 end;
  if k = 'pro3d' then perform public.grant_plan(me, 'pro', 3);
  elsif k = 'pro1m' then perform public.grant_plan(me, 'pro', 30);
  elsif k = 'prolife' then
    perform public.grant_plan(me, 'pro', 36500);
    insert into public.user_items (user_id, item) values (me, 'theme_gold'), (me, 'color_gold') on conflict do nothing;
  end if;
  insert into public.drops (user_id, day, prize, item, points, tickets) values (me, d, k, it, pts, tk);
  t := public.drop_tier(k);
  if t >= 2 then perform public.ping_drops(); end if;
  return jsonb_build_object('prize', k, 'item', it, 'item_name', (select name from public.drop_items where id = it),
    'points', pts, 'left', earned - used - 1, 'earned', earned, 'tickets', tk, 'until', (select bonus_until from public.profiles where id = me));
end; $$;
revoke all on function public.spin_drop(date, boolean) from public, anon;
grant execute on function public.spin_drop(date, boolean) to authenticated;

create or replace function public.drop_status(client_day date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  m0 date := date_trunc('month', bday)::date;
begin
  if me is null then return null; end if;
  return jsonb_build_object(
    'earned', public.spins_earned(me, d),
    'used', (select count(*) from public.drops where user_id = me and day = d),
    'since', (select count(*) from public.drops where user_id = me and id > coalesce((select max(id) from public.drops where user_id = me and public.drop_tier(prize) >= 2), 0)),
    'tickets', (select coalesce(sum(tickets), 0) from public.drops where user_id = me and day >= m0),
    'all_tickets', (select coalesce(sum(tickets), 0) from public.drops where day >= m0),
    'items', coalesce((select jsonb_agg(item order by got_at) from public.user_items where user_id = me), '[]'::jsonb),
    'title', (select title from public.profiles where id = me),
    'name_color', (select name_color from public.profiles where id = me),
    'feed', coalesce((select jsonb_agg(f) from (
        select p.username as u, dr.prize, i.name as item_name, dr.created_at as at
        from public.drops dr join public.profiles p on p.id = dr.user_id left join public.drop_items i on i.id = dr.item
        where public.drop_tier(dr.prize) >= 2 order by dr.id desc limit 8) f), '[]'::jsonb),
    'last_jackpot', (select jsonb_build_object('month', j.month, 'username', p.username) from public.jackpots j left join public.profiles p on p.id = j.user_id order by j.month desc limit 1)
  );
end; $$;
revoke all on function public.drop_status(date) from public, anon;
grant execute on function public.drop_status(date) to authenticated;

-- Monthly draw, weighted by tickets (a Verified spin counts twice).
create or replace function public.draw_jackpot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  bday date := (now() at time zone 'Europe/Berlin')::date;
  m0 date := (date_trunc('month', bday) - interval '1 month')::date;
  m1 date := date_trunc('month', bday)::date;
  key text := to_char(m0, 'YYYY-MM'); w uuid; n int;
begin
  if exists (select 1 from public.jackpots where month = key) then return null; end if;
  select coalesce(sum(dr.tickets), 0) into n from public.drops dr join public.profiles p on p.id = dr.user_id where dr.day >= m0 and dr.day < m1 and not p.is_dev;
  if n = 0 then insert into public.jackpots (month, user_id, tickets, posted_at) values (key, null, 0, now()); return null; end if;
  select dr.user_id into w from public.drops dr join public.profiles p on p.id = dr.user_id
    where dr.day >= m0 and dr.day < m1 and not p.is_dev and dr.tickets > 0
    order by -ln(1 - random()) / dr.tickets limit 1;
  insert into public.jackpots (month, user_id, tickets) values (key, w, n);
  perform public.grant_plan(w, 'pro', 365);
  insert into public.rewards (user_id, kind, period) values (w, 'jackpot', key) on conflict do nothing;
  insert into public.notices (user_id, kind, payload) values (w, 'gift', jsonb_build_object('plan', 'pro', 'months', 12, 'from', 'the Golden Ticket draw', 'note', 'You won the monthly jackpot.'));
  perform public.ping_drops();
  return jsonb_build_object('month', key, 'tickets', n);
end; $$;
revoke all on function public.draw_jackpot() from public, anon, authenticated;

-- ---------- Leaderboard: + verified (a Verified routine in this period) ----------
drop function if exists public.leaderboard(text, boolean);
create or replace function public.leaderboard(period text, friends_only boolean default false)
returns table (rank bigint, user_id uuid, username text, avatar_url text, points bigint, streak integer, is_me boolean, training_now boolean, total bigint, title text, name_color text, verified boolean)
language sql stable security definer set search_path = '' as $$
  with today as (select (now() at time zone 'Europe/Berlin')::date as d),
  bounds as (
    select case period when 'month' then date_trunc('month', (select d from today))::date
                       else date_trunc('week', (select d from today))::date end as d0
  ),
  players as (
    select p.id, p.username, p.avatar_url, p.title, p.name_color from public.profiles p
    where case when friends_only then p.id = auth.uid() or public.is_friend(auth.uid(), p.id)
               else not p.is_dev and p.created_at <= now() - interval '7 days' end
  ),
  pts as (
    select x.user_id, sum(x.p)::bigint as points from (
      select t.user_id, public.day_points(t.minutes, t.routines, t.streak, t.frozen) as p from public.training_days t where t.day >= (select d0 from bounds)
      union all
      select dr.user_id, dr.points from public.drops dr where dr.day >= (select d0 from bounds) and dr.points > 0
    ) x group by x.user_id
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
    select pl.id, pl.username, pl.avatar_url, pl.title, pl.name_color, coalesce(pts.points, 0) as points, coalesce(cur.streak, 0) as streak,
           (ver.user_id is not null) as verified
    from players pl left join pts on pts.user_id = pl.id left join cur on cur.user_id = pl.id left join ver on ver.user_id = pl.id
    where pl.id = auth.uid() or (case when period = 'streaks' then coalesce(cur.streak, 0) > 0 else coalesce(pts.points, 0) > 0 end)
  ),
  ranked as (
    select b.*, rank() over (order by case when period = 'streaks' then b.streak::bigint else b.points end desc, b.username) as r,
           count(*) over () as total
    from board b
  )
  select r, id, username, avatar_url, points, streak, id = auth.uid(),
         friends_only and id <> auth.uid() and public.training_now(id), total, title, name_color, verified
  from ranked where r <= 50 or id = auth.uid() order by r limit 51;
$$;
grant execute on function public.leaderboard(text, boolean) to authenticated;

-- ---------- KovaaK's results (read by the Windows app from KovaaK's own stats files) ----------
create table if not exists public.aim_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  scenario text not null check (char_length(scenario) between 1 and 120),
  played_at timestamptz not null,
  score real not null,
  acc real check (acc between 0 and 100),
  sens text check (char_length(sens) <= 40),
  primary key (user_id, scenario, played_at)
);
alter table public.aim_scores enable row level security;
drop policy if exists "own aim read" on public.aim_scores;
drop policy if exists "own aim insert" on public.aim_scores;
drop policy if exists "own aim delete" on public.aim_scores;
create policy "own aim read" on public.aim_scores for select to authenticated using ((select auth.uid()) = user_id);
create policy "own aim insert" on public.aim_scores for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own aim delete" on public.aim_scores for delete to authenticated using ((select auth.uid()) = user_id);
