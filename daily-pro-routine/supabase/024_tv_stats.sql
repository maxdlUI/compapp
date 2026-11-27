-- 024: numbers for the owner's TV dashboard (/tv). One read-only call, protected by its own key
-- (private.app_keys name 'tv'; the page takes it from the URL hash, so it never sits in the page source).

insert into private.app_keys (name, value) values ('tv', encode(extensions.gen_random_bytes(18), 'hex')) on conflict (name) do nothing;

create or replace function public.tv_stats(k text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  day0 timestamptz := (date_trunc('day', now() at time zone 'Europe/Berlin')) at time zone 'Europe/Berlin';
  today date := (now() at time zone 'Europe/Berlin')::date;
  week0 date := date_trunc('week', (now() at time zone 'Europe/Berlin'))::date;
begin
  if k is null or not exists (select 1 from private.app_keys where name = 'tv' and value = k) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'now', now(),
    'training', (select count(*) from public.user_state s where s.updated_at > now() - interval '4 minutes'
                  and coalesce((s.session ->> 'active')::boolean, false) and s.session ->> 'status' in ('laeuft', 'wechsel')),
    'online', (select count(*) from public.user_state s where s.updated_at > now() - interval '5 minutes'),
    'players', (select count(*) from public.profiles),
    'new_today', (select count(*) from public.profiles where created_at >= day0),
    'new_week', (select count(*) from public.profiles where created_at >= week0::timestamp at time zone 'Europe/Berlin'),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.commissions where coalesce(status, '') not in ('refunded', 'failed')),
    'minutes_today', (select coalesce(sum(minutes), 0) from public.training_days where day = today),
    'runs_today', (select count(*) from public.routine_runs where counted and day = today),
    'trained_today', (select count(distinct user_id) from public.training_days where day = today and minutes > 0),
    'signups_14d', (select jsonb_agg(c order by d) from (
        select g::date d, (select count(*) from public.profiles p where (p.created_at at time zone 'Europe/Berlin')::date = g::date) c
        from generate_series(today - 13, today, interval '1 day') g) x),
    'top_week', (select coalesce(jsonb_agg(jsonb_build_object('name', username, 'min', m) order by m desc), '[]'::jsonb) from (
        select p.username, sum(t.minutes) m from public.training_days t join public.profiles p on p.id = t.user_id
        where t.day >= week0 group by p.username having sum(t.minutes) > 0 order by m desc limit 3) y),
    'newest', (select username from public.profiles order by created_at desc limit 1)
  );
end $$;

revoke execute on function public.tv_stats(text) from public;
grant execute on function public.tv_stats(text) to anon, authenticated;
