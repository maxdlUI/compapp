-- Repline Drops: one wheel spin per finished routine (3 a day at most), drawn on the server.
-- Prizes: leaderboard points, streak freezes, collection items (themes, backgrounds, titles, name colors),
-- 3 days Pro, 1 month Pro, Pro forever. Every spin is also a ticket for the monthly 1-year-Pro draw.
-- Item-or-better spins and jackpots are posted in Discord #drops by the "remind" edge function.
-- Safe to run more than once.

-- ---------- What can drop ----------
create table if not exists public.drop_items (
  id text primary key,
  kind text not null check (kind in ('theme', 'bg', 'title', 'color')),
  name text not null,
  value text not null,
  exclusive boolean not null default false   -- only from "Pro forever"
);
alter table public.drop_items enable row level security;
drop policy if exists "drop items read" on public.drop_items;
create policy "drop items read" on public.drop_items for select to anon, authenticated using (true);
insert into public.drop_items (id, kind, name, value, exclusive) values
  ('theme_violet', 'theme', 'Violet theme', '#a855f7', false),
  ('theme_ember',  'theme', 'Ember theme',  '#ff6a2b', false),
  ('theme_mint',   'theme', 'Mint theme',   '#2ee6a6', false),
  ('theme_rose',   'theme', 'Rose theme',   '#ff4fa3', false),
  ('theme_gold',   'theme', 'Gold theme',   '#ffcf4a', true),
  ('bg_aurora',    'bg',    'Aurora background', 'aurora', false),
  ('bg_grid',      'bg',    'Grid background',   'grid', false),
  ('bg_stars',     'bg',    'Starfield background', 'stars', false),
  ('bg_sunset',    'bg',    'Sunset background', 'sunset', false),
  ('title_edit',   'title', 'Title: Edit Machine', 'Edit Machine', false),
  ('title_box',    'title', 'Title: Box God', 'Box God', false),
  ('title_aim',    'title', 'Title: Aim Lab Rat', 'Aim Lab Rat', false),
  ('title_grind',  'title', 'Title: No Days Off', 'No Days Off', false),
  ('title_clutch', 'title', 'Title: Clutch King', 'Clutch King', false),
  ('title_piece',  'title', 'Title: Piece Control Pro', 'Piece Control Pro', false),
  ('color_cyan',   'color', 'Cyan name', '#38e0ff', false),
  ('color_violet', 'color', 'Violet name', '#c084fc', false),
  ('color_pink',   'color', 'Pink name', '#ff4fa3', false),
  ('color_mint',   'color', 'Mint name', '#2ee6a6', false),
  ('color_gold',   'color', 'Gold name', '#ffcf4a', true)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, value = excluded.value, exclusive = excluded.exclusive;

create table if not exists public.user_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  item text not null references public.drop_items (id) on delete cascade,
  got_at timestamptz not null default now(),
  primary key (user_id, item)
);
alter table public.user_items enable row level security;
drop policy if exists "own items read" on public.user_items;
create policy "own items read" on public.user_items for select to authenticated using ((select auth.uid()) = user_id);

-- Shown on leaderboards. Set only through equip_item().
alter table public.profiles add column if not exists title text, add column if not exists name_color text;

-- ---------- Spins ----------
create table if not exists public.drops (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  prize text not null check (prize in ('pts10', 'pts15', 'pts25', 'pts50', 'freeze', 'item', 'pro3d', 'pro1m', 'prolife')),
  item text references public.drop_items (id) on delete set null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  posted_at timestamptz
);
create index if not exists drops_user_day_idx on public.drops (user_id, day);
create index if not exists drops_created_idx on public.drops (created_at);
alter table public.drops enable row level security;
drop policy if exists "own drops read" on public.drops;
create policy "own drops read" on public.drops for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.jackpots (
  month text primary key,            -- 'YYYY-MM' of the month the tickets came from
  user_id uuid references auth.users (id) on delete set null,
  tickets integer not null default 0,
  drawn_at timestamptz not null default now(),
  posted_at timestamptz
);
alter table public.jackpots enable row level security;
drop policy if exists "jackpots read" on public.jackpots;
create policy "jackpots read" on public.jackpots for select to authenticated using (true);

create or replace function public.drop_tier(prize text)
returns integer language sql immutable set search_path = '' as $$
  select case prize when 'pts50' then 1 when 'freeze' then 1 when 'item' then 2 when 'pro3d' then 3 when 'pro1m' then 4 when 'prolife' then 5 else 0 end;
$$;

-- Ask the edge function to post new drops in Discord (runs after the transaction; never blocks a spin).
create or replace function public.ping_drops()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://wjwjvwjwlipjxsgufffj.supabase.co/functions/v1/remind',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"drops": true}'::jsonb
  );
exception when others then null;
end; $$;
revoke all on function public.ping_drops() from public, anon, authenticated;

-- One spin. client_day is the player's local date (the day their routines count for).
-- freezes_full: the player already holds the most streak freezes, so a freeze becomes +50 points.
create or replace function public.spin_drop(client_day date, freezes_full boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date; earned int; used int; since int; r double precision; k text; it text; pts int := 0; t int;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  if not exists (select 1 from public.profiles where id = me and discord_id is not null) then return jsonb_build_object('error', 'no_discord'); end if;
  perform pg_advisory_xact_lock(hashtext('spin:' || me::text));
  d := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  select least(3, coalesce(max(routines), 0)) into earned from public.training_days where user_id = me and day = d;
  select count(*) into used from public.drops where user_id = me and day = d;
  if used >= earned then return jsonb_build_object('error', 'no_spins', 'earned', earned, 'used', used); end if;

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
  insert into public.drops (user_id, day, prize, item, points) values (me, d, k, it, pts);
  t := public.drop_tier(k);
  if t >= 2 then perform public.ping_drops(); end if;
  return jsonb_build_object('prize', k, 'item', it, 'item_name', (select name from public.drop_items where id = it),
    'points', pts, 'left', earned - used - 1, 'earned', earned, 'until', (select bonus_until from public.profiles where id = me));
end; $$;
revoke all on function public.spin_drop(date, boolean) from public, anon;
grant execute on function public.spin_drop(date, boolean) to authenticated;

-- Everything the Drops page shows.
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
    'earned', (select least(3, coalesce(max(routines), 0)) from public.training_days where user_id = me and day = d),
    'used', (select count(*) from public.drops where user_id = me and day = d),
    'since', (select count(*) from public.drops where user_id = me and id > coalesce((select max(id) from public.drops where user_id = me and public.drop_tier(prize) >= 2), 0)),
    'tickets', (select count(*) from public.drops where user_id = me and day >= m0),
    'all_tickets', (select count(*) from public.drops where day >= m0),
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

-- Wear a title or name color you own (item null = take it off).
create or replace function public.equip_item(item_kind text, item_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); v text;
begin
  if me is null or item_kind not in ('title', 'color') then return jsonb_build_object('error', 'bad_input'); end if;
  if item_id is not null then
    select i.value into v from public.drop_items i join public.user_items u on u.item = i.id and u.user_id = me
      where i.id = item_id and i.kind = item_kind;
    if v is null then return jsonb_build_object('error', 'not_owned'); end if;
  end if;
  if item_kind = 'title' then update public.profiles set title = v where id = me;
  else update public.profiles set name_color = v where id = me; end if;
  return jsonb_build_object('ok', true, 'value', v);
end; $$;
revoke all on function public.equip_item(text, text) from public, anon;
grant execute on function public.equip_item(text, text) to authenticated;

-- Monthly draw: one ticket (= one spin last month) wins a year of Pro. Idempotent per month.
create or replace function public.draw_jackpot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  bday date := (now() at time zone 'Europe/Berlin')::date;
  m0 date := (date_trunc('month', bday) - interval '1 month')::date;
  m1 date := date_trunc('month', bday)::date;
  key text := to_char(m0, 'YYYY-MM'); w uuid; n int;
begin
  if exists (select 1 from public.jackpots where month = key) then return null; end if;
  select count(*) into n from public.drops dr join public.profiles p on p.id = dr.user_id where dr.day >= m0 and dr.day < m1 and not p.is_dev;
  if n = 0 then insert into public.jackpots (month, user_id, tickets, posted_at) values (key, null, 0, now()); return null; end if;
  select dr.user_id into w from public.drops dr join public.profiles p on p.id = dr.user_id
    where dr.day >= m0 and dr.day < m1 and not p.is_dev order by random() limit 1;
  insert into public.jackpots (month, user_id, tickets) values (key, w, n);
  perform public.grant_plan(w, 'pro', 365);
  insert into public.rewards (user_id, kind, period) values (w, 'jackpot', key) on conflict do nothing;
  -- the gift notice also sends the winner a Discord DM
  insert into public.notices (user_id, kind, payload) values (w, 'gift', jsonb_build_object('plan', 'pro', 'months', 12, 'from', 'the Golden Ticket draw', 'note', 'You won the monthly jackpot.'));
  perform public.ping_drops();
  return jsonb_build_object('month', key, 'tickets', n);
end; $$;
revoke all on function public.draw_jackpot() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'repline-jackpot';
select cron.schedule('repline-jackpot', '10 0 * * *', $job$ select public.draw_jackpot(); $job$);

-- ---------- Leaderboards: drop points count, titles and name colors show ----------
create or replace function public.period_rank(uid uuid, d0 date, d1 date)
returns bigint language sql stable security definer set search_path = '' as $$
  with pts as (
    select x.user_id, sum(x.p) as points from (
      select t.user_id, public.day_points(t.minutes, t.routines, t.streak, t.frozen) as p from public.training_days t where t.day >= d0 and t.day < d1
      union all
      select dr.user_id, dr.points from public.drops dr where dr.day >= d0 and dr.day < d1 and dr.points > 0
    ) x group by x.user_id
  ), board as (
    select pts.user_id, pts.points from pts join public.profiles p on p.id = pts.user_id
    where not p.is_dev and p.created_at <= d1 - interval '7 days' and pts.points > 0
  ), r as (select user_id, rank() over (order by points desc) as rk from board)
  select rk from r where user_id = uid;
$$;

drop function if exists public.leaderboard(text, boolean);
create or replace function public.leaderboard(period text, friends_only boolean default false)
returns table (rank bigint, user_id uuid, username text, avatar_url text, points bigint, streak integer, is_me boolean, training_now boolean, total bigint, title text, name_color text)
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
  board as (
    select pl.id, pl.username, pl.avatar_url, pl.title, pl.name_color, coalesce(pts.points, 0) as points, coalesce(cur.streak, 0) as streak
    from players pl left join pts on pts.user_id = pl.id left join cur on cur.user_id = pl.id
    where pl.id = auth.uid() or (case when period = 'streaks' then coalesce(cur.streak, 0) > 0 else coalesce(pts.points, 0) > 0 end)
  ),
  ranked as (
    select b.*, rank() over (order by case when period = 'streaks' then b.streak::bigint else b.points end desc, b.username) as r,
           count(*) over () as total
    from board b
  )
  select r, id, username, avatar_url, points, streak, id = auth.uid(),
         friends_only and id <> auth.uid() and public.training_now(id), total, title, name_color
  from ranked where r <= 50 or id = auth.uid() order by r limit 51;
$$;
grant execute on function public.leaderboard(text, boolean) to authenticated;
