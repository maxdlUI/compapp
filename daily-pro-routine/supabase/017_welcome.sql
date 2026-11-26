-- Repline 1.11: welcome for new players.
-- A popup after sign-up (start a routine or build a Personal Plan, free once even on Free),
-- a bonus spin for the first counted routine, and a welcome DM (+ one reminder after 24 h without training)
-- sent by the edge function "ask" (it already runs every minute). Safe to run more than once.

alter table public.profiles add column if not exists welcome_seen_at timestamptz;
alter table public.profiles add column if not exists welcome_plan_used boolean not null default false;
alter table public.profiles add column if not exists welcome_dm_at timestamptz;
alter table public.profiles add column if not exists nudge_dm_at timestamptz;

-- Players who signed up before this feature don't get welcome DMs.
update public.profiles set welcome_dm_at = coalesce(welcome_dm_at, now()), nudge_dm_at = coalesce(nudge_dm_at, now())
  where created_at < '2026-11-17 13:00:00+00';

-- The day of a player's first counted routine pays one extra spin (bonus spin).
create or replace function public.spins_earned(uid uuid, d date)
returns integer language sql stable security definer set search_path = '' as $$
  select least(3, case when d < public.runs_since()
    then (select coalesce(max(routines), 0) from public.training_days where user_id = uid and day = d)
    else (select count(*)::int from public.routine_runs where user_id = uid and day = d and counted) end)
  + case when d >= public.runs_since() and d = (select min(day) from public.routine_runs where user_id = uid and counted) then 1 else 0 end;
$$;
revoke all on function public.spins_earned(uuid, date) from public, anon, authenticated;

-- Personal Plan: Free players get one, once (the welcome plan).
create or replace function public.coach_use(client_day date, take boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  lim integer; used integer; once boolean := false;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  lim := public.coach_limit(me);
  perform pg_advisory_xact_lock(hashtext('coach:' || me::text));
  select coalesce(max(uses), 0) into used from public.coach_uses where user_id = me and day = d;
  if lim = 0 and not coalesce((select welcome_plan_used from public.profiles where id = me), true) then
    once := true; lim := 1; used := 0;
  end if;
  if take then
    if used >= lim then return jsonb_build_object('ok', false, 'used', used, 'limit', lim, 'plan', public.effective_plan(me)); end if;
    if once then
      update public.profiles set welcome_plan_used = true where id = me;
    else
      insert into public.coach_uses (user_id, day, uses) values (me, d, 1)
      on conflict (user_id, day) do update set uses = public.coach_uses.uses + 1;
    end if;
    used := used + 1;
  end if;
  return jsonb_build_object('ok', true, 'used', used, 'limit', lim, 'plan', public.effective_plan(me), 'once', once);
end; $$;
revoke all on function public.coach_use(date, boolean) from public, anon;
grant execute on function public.coach_use(date, boolean) to authenticated;

-- What the welcome popup needs. show = never trained and never closed the popup.
create or replace function public.welcome_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); p record; trained boolean;
begin
  if me is null then return null; end if;
  select welcome_seen_at, welcome_plan_used into p from public.profiles where id = me;
  trained := exists (select 1 from public.routine_runs where user_id = me and counted)
          or exists (select 1 from public.training_days where user_id = me and routines > 0);
  return jsonb_build_object('show', p.welcome_seen_at is null and not trained, 'trained', trained,
    'free_plan', public.coach_limit(me) = 0 and not coalesce(p.welcome_plan_used, true));
end; $$;
revoke all on function public.welcome_state() from public, anon;
grant execute on function public.welcome_state() to authenticated;

create or replace function public.welcome_seen()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set welcome_seen_at = coalesce(welcome_seen_at, now()) where id = auth.uid();
$$;
revoke all on function public.welcome_seen() from public, anon;
grant execute on function public.welcome_seen() to authenticated;
