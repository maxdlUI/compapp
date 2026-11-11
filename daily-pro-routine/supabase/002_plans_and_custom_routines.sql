-- Repline: plans (free / standard / pro) and own routines from the routine builder.
-- Plans are only ever changed by the server (later: the Stripe webhook), never by the user.

alter table public.profiles add column if not exists plan text not null default 'free'
  check (plan in ('free', 'standard', 'pro'));

-- How many own routines a user may keep. Devs and Pro: unlimited.
create or replace function public.routine_limit(uid uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when p.is_dev or p.plan = 'pro' then 100000 when p.plan = 'standard' then 2 else 1 end
    from public.profiles p where p.id = uid
  ), 1);
$$;

create table if not exists public.custom_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  sets jsonb not null default '[]'::jsonb check (jsonb_typeof(sets) = 'array' and jsonb_array_length(sets) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_routines_user_idx on public.custom_routines (user_id);
alter table public.custom_routines enable row level security;

-- Counting inside the policy itself would make Postgres recurse, so the count lives in a definer function.
create or replace function public.can_add_routine()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.custom_routines c where c.user_id = auth.uid()) < public.routine_limit(auth.uid());
$$;
revoke all on function public.can_add_routine() from public, anon;
grant execute on function public.can_add_routine() to authenticated;

drop policy if exists "own routines read" on public.custom_routines;
drop policy if exists "own routines insert within plan" on public.custom_routines;
drop policy if exists "own routines update" on public.custom_routines;
drop policy if exists "own routines delete" on public.custom_routines;
create policy "own routines read" on public.custom_routines for select to authenticated using ((select auth.uid()) = user_id);
create policy "own routines insert within plan" on public.custom_routines for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_add_routine());
create policy "own routines update" on public.custom_routines for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own routines delete" on public.custom_routines for delete to authenticated using ((select auth.uid()) = user_id);
