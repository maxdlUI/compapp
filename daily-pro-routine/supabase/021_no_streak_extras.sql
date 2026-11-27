-- 021: badges and streak freezes removed (owner, 27 Nov 2026). Players focus on training; the leaderboard is playtime only.
-- Prizes: #1 3 months Pro, #2-3 1 month Pro, #4-10 1 month Standard; weekly Top 3 get a Discord shout-out (no badges any more).

create or replace function public.claim_rewards()
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'Europe/Berlin')::date;
  w0 date := date_trunc('week', today)::date - 7;
  m0 date := (date_trunc('month', today) - interval '1 month')::date;
  m1 date := date_trunc('month', today)::date;
  rk bigint; q int; have int; out jsonb := '[]'::jsonb; n int;
begin
  if me is null then return out; end if;
  -- last week: top 3 (shout-out on Discord)
  rk := public.period_rank(me, w0, w0 + 7);
  if rk is not null and rk <= 3 then
    insert into public.rewards values (me, 'weekly_top3', w0::text) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then out := out || jsonb_build_object('kind', 'weekly_top3', 'rank', rk); end if;
  end if;
  -- last month: prizes for the top 10
  rk := public.period_rank(me, m0, m1);
  if rk is not null and rk <= 10 then
    insert into public.rewards values (me, 'monthly', m0::text) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then
      if rk = 1 then perform public.grant_plan(me, 'pro', 90);
      elsif rk <= 3 then perform public.grant_plan(me, 'pro', 30);
      else perform public.grant_plan(me, 'standard', 30); end if;
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

drop table if exists public.user_badges cascade;
