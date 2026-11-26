-- Repline 1.17: players join the Repline Discord when they sign in (scope guilds.join, edge function "join"),
-- so the bot can actually DM them (Discord only allows DMs between users who share a server).
-- comeback_*: reminder DMs for players who stopped training (sent by the edge function "ask").
-- Joining the Discord pays one bonus spin on the day you join. Safe to run more than once.

alter table public.profiles add column if not exists discord_joined_at timestamptz;
alter table public.profiles add column if not exists comeback_dm_at timestamptz;
alter table public.profiles add column if not exists comeback_count integer not null default 0;

-- spins: counted runs (max 3) + first routine bonus (017) + one bonus spin on the day you joined the Discord
create or replace function public.spins_earned(uid uuid, d date)
returns integer language sql stable security definer set search_path = '' as $$
  select least(3, case when d < public.runs_since()
    then (select coalesce(max(routines), 0) from public.training_days where user_id = uid and day = d)
    else (select count(*)::int from public.routine_runs where user_id = uid and day = d and counted) end)
  + case when d >= public.runs_since() and d = (select min(day) from public.routine_runs where user_id = uid and counted) then 1 else 0 end
  + case when d = (select (discord_joined_at at time zone 'Europe/Berlin')::date from public.profiles where id = uid) then 1 else 0 end;
$$;
