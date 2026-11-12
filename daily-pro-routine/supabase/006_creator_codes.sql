-- Repline: creator codes (like "Support a Creator").
-- Every player has a code (referral_codes.code, optionally a vanity code for partners). Any player can set,
-- change or remove the creator they support at any time, also with an active subscription.
-- On every paid invoice the payment webhook calls record_invoice_commission(): the creator supported at
-- that moment gets commission_rate() (40 %) of the amount. Safe to run more than once.

alter table public.referral_codes add column if not exists vanity text;
create unique index if not exists referral_codes_vanity_idx on public.referral_codes (lower(vanity)) where vanity is not null;

alter table public.profiles
  add column if not exists creator_id uuid references auth.users (id) on delete set null,
  add column if not exists creator_set_at timestamptz;

create or replace function public.commission_rate() returns numeric language sql immutable set search_path = '' as $$ select 0.40::numeric $$;

-- Commissions, one row per paid invoice. Written only by the payment webhook (service role).
create table if not exists public.commissions (
  id bigint generated always as identity primary key,
  creator_id uuid not null references auth.users (id) on delete cascade,
  payer_id uuid references auth.users (id) on delete set null,
  invoice_id text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  commission_cents integer not null check (commission_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  created_at timestamptz not null default now(),
  paid_out_at timestamptz
);
alter table public.commissions enable row level security;
drop policy if exists "creator reads own commissions" on public.commissions;
create policy "creator reads own commissions" on public.commissions for select to authenticated using ((select auth.uid()) = creator_id);

create or replace function public.creator_by_code(c text)
returns uuid language sql stable security definer set search_path = '' as $$
  select user_id from public.referral_codes
  where code = lower(trim(c)) or (vanity is not null and lower(vanity) = lower(trim(c))) limit 1;
$$;

-- Set (or change) the creator you support. Returns the creator's name, or an error word.
create or replace function public.set_creator_code(c text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); cr uuid; nm text;
begin
  if me is null then return jsonb_build_object('error', 'signed_out'); end if;
  cr := public.creator_by_code(c);
  if cr is null then return jsonb_build_object('error', 'not_found'); end if;
  if cr = me then return jsonb_build_object('error', 'self'); end if;
  update public.profiles set creator_id = cr, creator_set_at = now() where id = me;
  select username into nm from public.profiles where id = cr;
  return jsonb_build_object('creator', nm, 'code', lower(trim(c)));
end; $$;

create or replace function public.clear_creator_code()
returns void language sql security definer set search_path = '' as $$
  update public.profiles set creator_id = null, creator_set_at = now() where id = auth.uid();
$$;

-- The creator I support, and my own creator stats.
create or replace function public.my_creator()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'creator', (select p2.username from public.profiles p join public.profiles p2 on p2.id = p.creator_id where p.id = auth.uid()),
    'code', (select coalesce(rc.vanity, rc.code) from public.profiles p join public.referral_codes rc on rc.user_id = p.creator_id where p.id = auth.uid()),
    'since', (select creator_set_at from public.profiles where id = auth.uid()),
    'my_code', (select coalesce(vanity, code) from public.referral_codes where user_id = auth.uid()),
    'supporters', (select count(*) from public.profiles where creator_id = auth.uid()),
    'paying_supporters', (select count(*) from public.profiles where creator_id = auth.uid() and (plan in ('standard', 'pro'))),
    'earned_cents', (select coalesce(sum(commission_cents), 0) from public.commissions where creator_id = auth.uid() and status <> 'refunded'),
    'paid_out_cents', (select coalesce(sum(commission_cents), 0) from public.commissions where creator_id = auth.uid() and status = 'paid'),
    'rate', public.commission_rate()
  );
$$;

-- Called by the payment webhook (service role) for every paid invoice. Idempotent per invoice.
create or replace function public.record_invoice_commission(payer uuid, invoice text, amount_cents integer, cur text default 'eur')
returns boolean language plpgsql security definer set search_path = '' as $$
declare cr uuid;
begin
  select creator_id into cr from public.profiles where id = payer;
  if cr is null or cr = payer then return false; end if;
  insert into public.commissions (creator_id, payer_id, invoice_id, amount_cents, commission_cents, currency)
  values (cr, payer, invoice, amount_cents, floor(amount_cents * public.commission_rate())::int, lower(cur))
  on conflict (invoice_id) do nothing;
  return found;
end; $$;

-- A refund cancels the commission of that invoice.
create or replace function public.refund_invoice_commission(invoice text)
returns void language sql security definer set search_path = '' as $$
  update public.commissions set status = 'refunded' where invoice_id = invoice and status = 'pending';
$$;

-- Signing up through a creator's link makes them your creator (until you change it).
create or replace function public.claim_referral(ref_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); referrer uuid; joined timestamptz;
begin
  if me is null then return false; end if;
  referrer := public.creator_by_code(ref_code);
  if referrer is null or referrer = me then return false; end if;
  select created_at into joined from auth.users where id = me;
  if joined < now() - interval '1 day' then return false; end if;
  insert into public.referral_signups (referred_id, referrer_id) values (me, referrer) on conflict do nothing;
  update public.profiles set creator_id = referrer, creator_set_at = now() where id = me and creator_id is null;
  return true;
end; $$;

revoke all on function public.set_creator_code(text), public.clear_creator_code(), public.my_creator(), public.creator_by_code(text) from public, anon;
grant execute on function public.set_creator_code(text), public.clear_creator_code(), public.my_creator() to authenticated;
revoke all on function public.record_invoice_commission(uuid, text, integer, text), public.refund_invoice_commission(text) from public, anon, authenticated;
