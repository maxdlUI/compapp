-- Repline 1.6: stats, leaderboards, friends, shared routines, badges, rewards and reminders.
-- Safe to run more than once.

-- ---------- Training data per day (stats + points) ----------
alter table public.training_days
  add column if not exists minutes integer not null default 0 check (minutes between 0 and 1440),
  add column if not exists by_type jsonb not null default '{}'::jsonb,
  add column if not exists streak integer not null default 0 check (streak between 0 and 10000),
  add column if not exists frozen boolean not null default false;

-- Points for one day: 1 per minute, +25 for a finished routine, streak bonus +2 per day (max 40), at most 180.
create or replace function public.day_points(minutes integer, routines integer, streak integer, frozen boolean)
returns integer language sql immutable set search_path = '' as $$
  select case when frozen or (coalesce(minutes, 0) <= 0 and coalesce(routines, 0) <= 0) then 0
              else least(180, coalesce(minutes, 0) + case when coalesce(routines, 0) > 0 then 25 else 0 end + least(40, 2 * coalesce(streak, 0))) end;
$$;

-- ---------- Plans won as rewards ----------
alter table public.profiles
  add column if not exists bonus_plan text check (bonus_plan in ('standard', 'pro')),
  add column if not exists bonus_until timestamptz;
-- Names come from Discord and are used to find friends: users can't change them themselves.
revoke update (username) on public.profiles from authenticated;

create or replace function public.effective_plan(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when p.is_dev or p.plan = 'pro' or (p.bonus_plan = 'pro' and p.bonus_until > now()) then 'pro'
      when p.plan = 'standard' or (p.bonus_plan = 'standard' and p.bonus_until > now()) then 'standard'
      else 'free' end
    from public.profiles p where p.id = uid), 'free');
$$;

create or replace function public.routine_limit(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case public.effective_plan(uid) when 'pro' then 100000 when 'standard' then 2 else 1 end;
$$;

-- ---------- Friends ----------
create table if not exists public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friendships enable row level security;
drop policy if exists "own friendships read" on public.friendships;
drop policy if exists "own friendships delete" on public.friendships;
create policy "own friendships read" on public.friendships for select to authenticated using ((select auth.uid()) in (user_a, user_b));
create policy "own friendships delete" on public.friendships for delete to authenticated using ((select auth.uid()) in (user_a, user_b));

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted' and f.user_a = least(a, b) and f.user_b = greatest(a, b));
$$;

create or replace function public.friend_request(discord_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); target uuid; f public.friendships;
begin
  if me is null then return 'signed_out'; end if;
  select id into target from public.profiles where lower(username) = lower(trim(both '@' from trim(discord_name))) limit 1;
  if target is null then return 'not_found'; end if;
  if target = me then return 'self'; end if;
  select * into f from public.friendships where user_a = least(me, target) and user_b = greatest(me, target);
  if found then
    if f.status = 'accepted' then return 'already'; end if;
    if f.requested_by <> me then
      update public.friendships set status = 'accepted' where user_a = f.user_a and user_b = f.user_b;
      return 'accepted';
    end if;
    return 'pending';
  end if;
  if (select count(*) from public.friendships where requested_by = me and status = 'pending') >= 30 then return 'limit'; end if;
  insert into public.friendships (user_a, user_b, requested_by) values (least(me, target), greatest(me, target), me);
  return 'sent';
end; $$;

create or replace function public.friend_respond(other uuid, accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if accept then
    update public.friendships set status = 'accepted'
      where user_a = least(me, other) and user_b = greatest(me, other) and requested_by = other and status = 'pending';
  else
    delete from public.friendships where user_a = least(me, other) and user_b = greatest(me, other);
  end if;
end; $$;

-- Someone is "training now" when their saved routine is running and was updated in the last 4 minutes.
create or replace function public.training_now(uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_state s where s.user_id = uid and s.updated_at > now() - interval '4 minutes'
                 and coalesce((s.session ->> 'active')::boolean, false) and s.session ->> 'status' in ('laeuft', 'wechsel'));
$$;

create or replace function public.my_friends()
returns table (user_id uuid, username text, avatar_url text, status text, incoming boolean, training_now boolean)
language sql stable security definer set search_path = '' as $$
  select o.id, o.username, o.avatar_url, f.status, f.status = 'pending' and f.requested_by <> auth.uid(),
         f.status = 'accepted' and public.training_now(o.id)
  from public.friendships f
  join public.profiles o on o.id = case when f.user_a = auth.uid() then f.user_b else f.user_a end
  where auth.uid() in (f.user_a, f.user_b)
  order by f.status, o.username;
$$;

-- ---------- Leaderboards ----------
-- period: 'week' | 'month' | 'streaks'. Prizes only count eligible players (not dev, account older than 7 days).
create or replace function public.leaderboard(period text, friends_only boolean default false)
returns table (rank bigint, user_id uuid, username text, avatar_url text, points bigint, streak integer, is_me boolean, training_now boolean, total bigint)
language sql stable security definer set search_path = '' as $$
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
  pts as (
    select t.user_id, sum(public.day_points(t.minutes, t.routines, t.streak, t.frozen))::bigint as points
    from public.training_days t where t.day >= (select d0 from bounds) group by t.user_id
  ),
  cur as (
    select t.user_id, max(t.streak) as streak from public.training_days t
    where t.day >= (select d from today) - 1 group by t.user_id
  ),
  board as (
    select pl.id, pl.username, pl.avatar_url, coalesce(pts.points, 0) as points, coalesce(cur.streak, 0) as streak
    from players pl left join pts on pts.user_id = pl.id left join cur on cur.user_id = pl.id
    where pl.id = auth.uid() or (case when period = 'streaks' then coalesce(cur.streak, 0) > 0 else coalesce(pts.points, 0) > 0 end)
  ),
  ranked as (
    select b.*, rank() over (order by case when period = 'streaks' then b.streak::bigint else b.points end desc, b.username) as r,
           count(*) over () as total
    from board b
  )
  select r, id, username, avatar_url, points, streak, id = auth.uid(),
         friends_only and id <> auth.uid() and public.training_now(id), total
  from ranked where r <= 50 or id = auth.uid() order by r limit 51;
$$;

-- ---------- Shared routines (codes like RPL-7KQ2-M9XD) ----------
create table if not exists public.shared_routines (
  code text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sets jsonb not null check (jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) between 1 and 40),
  imports integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.shared_routines enable row level security;  -- read and write only through the functions below

create or replace function public.share_routine(r_name text, r_sets jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  if me is null then raise exception 'signed out'; end if;
  if (select count(*) from public.shared_routines where owner = me) >= 100 then raise exception 'share limit'; end if;
  loop
    c := 'RPL-';
    for i in 1..8 loop
      c := c || substr(abc, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(abc)), 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.shared_routines where code = c);
  end loop;
  insert into public.shared_routines (code, owner, name, sets) values (c, me, left(trim(r_name), 40), r_sets);
  return c;
end; $$;

create or replace function public.get_shared_routine(r_code text)
returns table (code text, name text, sets jsonb, owner_name text, imports integer)
language sql stable security definer set search_path = '' as $$
  select s.code, s.name, s.sets, p.username, s.imports from public.shared_routines s left join public.profiles p on p.id = s.owner
  where s.code = upper(regexp_replace(trim(r_code), '\s', '', 'g'));
$$;

create or replace function public.count_import(r_code text)
returns void language sql security definer set search_path = '' as $$
  update public.shared_routines set imports = imports + 1 where code = upper(trim(r_code)) and owner <> auth.uid();
$$;

create or replace function public.my_share_imports()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(imports), 0)::int from public.shared_routines where owner = auth.uid();
$$;

-- ---------- Badges ----------
create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
drop policy if exists "own badges read" on public.user_badges;
drop policy if exists "own badges add" on public.user_badges;
create policy "own badges read" on public.user_badges for select to authenticated using ((select auth.uid()) = user_id);
-- Training badges are earned in the app; leaderboard badges only come from claim_rewards().
create policy "own badges add" on public.user_badges for insert to authenticated with check ((select auth.uid()) = user_id and badge in
  ('first_rep', 'streak_7', 'streak_14', 'streak_30', 'streak_100', 'early_bird', 'night_owl', 'cup_ready', 'grinder', 'sharpshooter', 'founding', 'builder', 'shared'));

-- ---------- Rewards: monthly prizes, weekly top 3, invites ----------
create table if not exists public.rewards (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  period text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, kind, period)
);
alter table public.rewards enable row level security;
drop policy if exists "own rewards read" on public.rewards;
create policy "own rewards read" on public.rewards for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.period_rank(uid uuid, d0 date, d1 date)
returns bigint language sql stable security definer set search_path = '' as $$
  with board as (
    select t.user_id, sum(public.day_points(t.minutes, t.routines, t.streak, t.frozen)) as points
    from public.training_days t join public.profiles p on p.id = t.user_id
    where t.day >= d0 and t.day < d1 and not p.is_dev and p.created_at <= d1 - interval '7 days'
    group by t.user_id having sum(public.day_points(t.minutes, t.routines, t.streak, t.frozen)) > 0
  ), r as (select user_id, rank() over (order by points desc) as rk from board)
  select rk from r where user_id = uid;
$$;

create or replace function public.grant_plan(uid uuid, new_plan text, days integer)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set
    bonus_plan = case when new_plan = 'pro' or (bonus_plan = 'pro' and bonus_until > now()) then 'pro' else 'standard' end,
    bonus_until = greatest(coalesce(bonus_until, now()), now()) + make_interval(days => days)
  where id = uid;
$$;
revoke all on function public.grant_plan(uuid, text, integer) from public, anon, authenticated;

-- Called by the app after sign-in: hands out anything earned since the last visit. Returns what was new.
create or replace function public.claim_rewards()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Europe/Berlin')::date;
  w0 date := date_trunc('week', today)::date - 7;
  m0 date := (date_trunc('month', today) - interval '1 month')::date;
  m1 date := date_trunc('month', today)::date;
  rk bigint; q int; have int; out jsonb := '[]'::jsonb; n int;
begin
  if me is null then return out; end if;
  -- last week: top 3
  rk := public.period_rank(me, w0, w0 + 7);
  if rk is not null and rk <= 3 then
    insert into public.rewards values (me, 'weekly_top3', w0::text) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then
      insert into public.user_badges (user_id, badge) values (me, 'weekly_top3') on conflict do nothing;
      out := out || jsonb_build_object('kind', 'weekly_top3', 'rank', rk);
    end if;
  end if;
  -- last month: prizes
  rk := public.period_rank(me, m0, m1);
  if rk is not null and rk <= 50 then
    insert into public.rewards values (me, 'monthly', m0::text) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then
      if rk = 1 then perform public.grant_plan(me, 'pro', 90); insert into public.user_badges (user_id, badge) values (me, 'champion') on conflict do nothing;
      elsif rk <= 3 then perform public.grant_plan(me, 'pro', 30); insert into public.user_badges (user_id, badge) values (me, 'podium') on conflict do nothing;
      elsif rk <= 10 then perform public.grant_plan(me, 'standard', 30); insert into public.user_badges (user_id, badge) values (me, 'top10') on conflict do nothing;
      else insert into public.user_badges (user_id, badge) values (me, 'top50') on conflict do nothing; end if;
      out := out || jsonb_build_object('kind', 'monthly', 'rank', rk);
    end if;
  end if;
  -- invites: every 3 friends who signed up with your link and trained on 3 days = 1 month Standard
  select count(*) into q from public.referral_signups s
    where s.referrer_id = me and (select count(*) from public.training_days t where t.user_id = s.referred_id and t.routines > 0) >= 3;
  select count(*) into have from public.rewards where user_id = me and kind = 'invite';
  while have < q / 3 loop
    have := have + 1;
    insert into public.rewards values (me, 'invite', have::text) on conflict do nothing;
    perform public.grant_plan(me, 'standard', 30);
    out := out || jsonb_build_object('kind', 'invite', 'count', have);
  end loop;
  return out;
end; $$;

create or replace function public.invite_progress()
returns table (user_id uuid, username text, avatar_url text, days integer)
language sql stable security definer set search_path = '' as $$
  select s.referred_id, p.username, p.avatar_url,
         (select count(*)::int from public.training_days t where t.user_id = s.referred_id and t.routines > 0)
  from public.referral_signups s join public.profiles p on p.id = s.referred_id
  where s.referrer_id = auth.uid() order by s.created_at;
$$;

-- ---------- Reminders (Discord DM and web push are sent by the "remind" edge function) ----------
create table if not exists public.reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  at_time time not null default '18:00',
  days integer[] not null default '{1,2,3,4,5}',
  tz text not null default 'Europe/Berlin',
  skip_if_trained boolean not null default true,
  danger boolean not null default true,
  via_discord boolean not null default false,
  via_push boolean not null default false,
  push_sub jsonb,
  last_sent date,
  last_danger date,
  updated_at timestamptz not null default now()
);
alter table public.reminders enable row level security;
drop policy if exists "own reminder" on public.reminders;
create policy "own reminder" on public.reminders for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Who may call what ----------
revoke all on function public.friend_request(text), public.friend_respond(uuid, boolean), public.my_friends(),
  public.leaderboard(text, boolean), public.share_routine(text, jsonb), public.get_shared_routine(text), public.count_import(text),
  public.my_share_imports(), public.claim_rewards(), public.invite_progress(), public.period_rank(uuid, date, date),
  public.training_now(uuid), public.is_friend(uuid, uuid), public.effective_plan(uuid) from public, anon;
grant execute on function public.friend_request(text), public.friend_respond(uuid, boolean), public.my_friends(),
  public.leaderboard(text, boolean), public.share_routine(text, jsonb), public.get_shared_routine(text), public.count_import(text),
  public.my_share_imports(), public.claim_rewards(), public.invite_progress(), public.effective_plan(uuid) to authenticated;
