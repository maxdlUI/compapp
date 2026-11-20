-- Repline 1.13: shorter first steps for new players.
--  * run_save: a routine ended early still counts after 15 real minutes (streak, +1 spin, points).
--    Same game check as run_finish; marked with reason 'early'.
--  * nudge2_dm_at: a second reminder DM on day 3 (sent by the edge function "ask").
-- Safe to run more than once.

alter table public.profiles add column if not exists nudge2_dm_at timestamptz;
-- players who signed up before 13 Nov never get the day-3 reminder
update public.profiles set nudge2_dm_at = coalesce(nudge2_dm_at, now()) where created_at < '2026-11-13 00:00:00+00';

create or replace function public.run_save(run_id bigint, detect_on boolean, game_s integer, need_s integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.routine_runs;
  real_s integer; plan_s integer; g integer; n integer; t_ok boolean; g_ok boolean; ok boolean; ver boolean; why text; cnt integer; early boolean;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  select * into r from public.routine_runs where id = run_id and user_id = me for update;
  if not found then return jsonb_build_object('error', 'no_run'); end if;
  if r.finished_at is not null then
    return jsonb_build_object('counted', r.counted, 'verified', r.verified, 'reason', r.reason, 'early', r.reason = 'early', 'real_sec', extract(epoch from r.finished_at - r.started_at)::int,
      'planned_sec', r.planned_min * 60, 'game_sec', r.game_sec, 'need_sec', r.need_sec, 'again', true);
  end if;
  real_s := extract(epoch from now() - r.started_at)::int;
  plan_s := r.planned_min * 60;
  early := real_s < plan_s * 0.95 - 30;
  n := greatest(0, least(coalesce(need_s, 0), plan_s, real_s));
  g := greatest(0, least(coalesce(game_s, 0), n));
  t_ok := real_s >= least(plan_s * 0.95 - 30, 870);
  g_ok := r.source <> 'win' or not coalesce(detect_on, false) or n = 0 or g >= n * 0.8;
  ok := t_ok and g_ok;
  ver := ok and r.source = 'win' and coalesce(detect_on, false) and n > 0;
  why := case when not t_ok then 'too_fast' when not g_ok then 'no_game' when early then 'early' end;
  update public.routine_runs set finished_at = now(), detect = coalesce(detect_on, false), game_sec = g, need_sec = n, counted = ok, verified = ver, reason = why
  where id = r.id;
  if ok then
    select count(*) into cnt from public.routine_runs where user_id = me and day = r.day and counted;
    insert into public.training_days (user_id, day, routines) values (me, r.day, cnt)
    on conflict (user_id, day) do update set routines = greatest(public.training_days.routines, excluded.routines);
  end if;
  return jsonb_build_object('counted', ok, 'verified', ver, 'early', ok and early, 'reason', why, 'real_sec', real_s, 'planned_sec', plan_s, 'game_sec', g, 'need_sec', n);
end; $$;
revoke all on function public.run_save(bigint, boolean, integer, integer) from public, anon;
grant execute on function public.run_save(bigint, boolean, integer, integer) to authenticated;
