-- Launch month: every signed-in player gets Pro (unlimited own routines etc.) until 13 Dec 2026 00:00 Berlin time.
-- After that effective_plan() returns the real plan again, nothing else to do. Safe to run more than once.
create or replace function public.effective_plan(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when p.is_dev or now() < timestamptz '2026-12-13 00:00:00+01' then 'pro'
      when p.plan = 'pro' or (p.bonus_plan = 'pro' and p.bonus_until > now()) then 'pro'
      when p.plan = 'standard' or (p.bonus_plan = 'standard' and p.bonus_until > now()) then 'standard'
      else 'free' end
    from public.profiles p where p.id = uid), 'free');
$$;
