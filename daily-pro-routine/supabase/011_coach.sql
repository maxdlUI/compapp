-- Repline 1.9: the Coach builds routines from what the player writes.
-- The routine itself is built on the player's device; the server only counts uses per day:
-- Free 0, Standard 1, Pro 3 (effective_plan() already includes the launch month and devs).
-- Safe to run more than once.

create table if not exists public.coach_uses (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  uses integer not null default 0 check (uses between 0 and 100),
  primary key (user_id, day)
);
alter table public.coach_uses enable row level security;
drop policy if exists "own coach read" on public.coach_uses;
create policy "own coach read" on public.coach_uses for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.coach_uses from authenticated, anon;

create or replace function public.coach_limit(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select case public.effective_plan(uid) when 'pro' then 3 when 'standard' then 1 else 0 end;
$$;
revoke all on function public.coach_limit(uuid) from public, anon, authenticated;

-- take = false: just tell how many are left today. take = true: use one (if any are left).
create or replace function public.coach_use(client_day date, take boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  bday date := (now() at time zone 'Europe/Berlin')::date;
  d date := case when client_day between bday - 1 and bday + 1 then client_day else bday end;
  lim integer; used integer;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  lim := public.coach_limit(me);
  perform pg_advisory_xact_lock(hashtext('coach:' || me::text));
  select coalesce(max(uses), 0) into used from public.coach_uses where user_id = me and day = d;
  if take then
    if used >= lim then return jsonb_build_object('ok', false, 'used', used, 'limit', lim, 'plan', public.effective_plan(me)); end if;
    insert into public.coach_uses (user_id, day, uses) values (me, d, 1)
    on conflict (user_id, day) do update set uses = public.coach_uses.uses + 1;
    used := used + 1;
  end if;
  return jsonb_build_object('ok', true, 'used', used, 'limit', lim, 'plan', public.effective_plan(me));
end; $$;
revoke all on function public.coach_use(date, boolean) from public, anon;
grant execute on function public.coach_use(date, boolean) to authenticated;
