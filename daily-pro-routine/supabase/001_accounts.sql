-- Repline accounts: one profile per user, synced app state, training days, referral codes and sign-ups.
-- Every table has row level security: a signed-in user reads and writes only their own rows.
-- Applied to Supabase project "repline" as migration 20261111215042_repline_accounts.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  avatar_url text,
  discord_id text,
  is_dev boolean not null default false,          -- dev accounts (e.g. test routine); only settable by the owner in the dashboard
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,     -- sound, alerts, overlay look …
  focus jsonb,                                     -- today's focus from the last review
  session jsonb,                                   -- the routine in progress today
  updated_at timestamptz not null default now()
);

create table public.training_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  routines integer not null default 1 check (routines >= 0),
  primary key (user_id, day)
);

create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  created_at timestamptz not null default now()
);

create table public.referral_signups (
  referred_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_id <> referrer_id)
);
create index referral_signups_referrer_idx on public.referral_signups (referrer_id);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;
alter table public.training_days enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_signups enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated, anon;
grant update (username, avatar_url, updated_at) on public.profiles to authenticated;

create policy "own state read" on public.user_state for select to authenticated using ((select auth.uid()) = user_id);
create policy "own state insert" on public.user_state for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own state update" on public.user_state for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own days read" on public.training_days for select to authenticated using ((select auth.uid()) = user_id);
create policy "own days insert" on public.training_days for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own days update" on public.training_days for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own days delete" on public.training_days for delete to authenticated using ((select auth.uid()) = user_id);

create policy "own code read" on public.referral_codes for select to authenticated using ((select auth.uid()) = user_id);
create policy "own referrals read" on public.referral_signups for select to authenticated using ((select auth.uid()) = referrer_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_code text;
begin
  insert into public.profiles (id, username, avatar_url, discord_id)
  values (
    new.id,
    coalesce(meta->>'full_name', meta->>'name', meta->>'user_name', split_part(coalesce(new.email, ''), '@', 1)),
    meta->>'avatar_url',
    meta->>'provider_id'
  );
  insert into public.user_state (user_id) values (new.id);
  loop
    new_code := substr(translate(encode(extensions.gen_random_bytes(8), 'base64'), '+/=0O1lI', ''), 1, 6);
    new_code := lower(new_code);
    exit when new_code ~ '^[a-z0-9]{6}$' and not exists (select 1 from public.referral_codes where code = new_code);
  end loop;
  insert into public.referral_codes (user_id, code) values (new.id, new_code);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.claim_referral(ref_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  referrer uuid;
  joined timestamptz;
begin
  if me is null then return false; end if;
  select user_id into referrer from public.referral_codes where code = lower(ref_code);
  if referrer is null or referrer = me then return false; end if;
  select created_at into joined from auth.users where id = me;
  if joined < now() - interval '1 day' then return false; end if;
  insert into public.referral_signups (referred_id, referrer_id) values (me, referrer) on conflict do nothing;
  return true;
end;
$$;

revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
