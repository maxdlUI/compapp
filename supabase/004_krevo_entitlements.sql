-- =====================================================================================
-- KREVO: Grundlage für spätere Käufe und Berechtigungen (Entitlements)
--
-- Voraussetzung: supabase/001_krevo_profiles.sql ist eingespielt.
-- Einspielen: Supabase Dashboard -> SQL Editor -> New query -> diesen Text einfügen -> Run.
-- Das Skript lässt sich gefahrlos mehrfach ausführen (idempotent) und löscht keine bestehenden Daten.
--
-- Grundsatz
--   * Jede Berechtigung gehört zur internen KREVO-Nutzer-ID (auth.users.id, UUID). Diese ID ändert sich nie,
--     auch nicht, wenn jemand Discord verbindet, trennt oder seinen Discord-Namen ändert. Discord, E-Mail und
--     künftige Anmeldewege sind nur Identitäten, die an diesem Konto hängen (auth.identities, Discord über die
--     feste Discord-User-ID). Käufe gehen dadurch nie verloren.
--   * Heute gibt es noch keine Käufe. Die Tabelle ist leer, die App liest sie noch nicht.
--
-- Sicherheit
--   * Row Level Security: Ein angemeldeter Nutzer liest nur seine eigenen Zeilen. Anonyme Besucher lesen nichts.
--   * Schreiben darf über die API niemand (auch nicht der eigene Nutzer). Einträge entstehen nur im SQL Editor oder
--     später serverseitig, z. B. in einem Webhook des Zahlungsanbieters mit dem service_role-Schlüssel, der nie ins
--     Frontend gehört.
--   * (source, external_ref) ist eindeutig: Ein Kauf-Ereignis, das der Zahlungsanbieter doppelt meldet, legt keine
--     zweite Berechtigung an.
-- =====================================================================================

begin;

create table if not exists public.entitlements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,  -- interne KREVO-ID, nie ein Anzeigename
  product       text not null,                     -- z. B. 'premium'
  source        text not null default 'manual',    -- z. B. 'manual', später der Zahlungsanbieter
  external_ref  text,                              -- Kennung beim Zahlungsanbieter (Bestellung, Abo)
  granted_at    timestamptz not null default now(),
  expires_at    timestamptz,                       -- null = unbefristet
  revoked_at    timestamptz,                       -- gesetzt statt löschen, damit der Verlauf erhalten bleibt
  created_at    timestamptz not null default now(),
  constraint entitlements_product_format check (product ~ '^[a-z0-9][a-z0-9_.-]{1,63}$'),
  constraint entitlements_source_format  check (source ~ '^[a-z0-9][a-z0-9_.-]{1,31}$'),
  constraint entitlements_ref_length     check (external_ref is null or length(external_ref) between 1 and 200),
  constraint entitlements_dates          check (expires_at is null or expires_at > granted_at)
);
create index if not exists entitlements_user_idx on public.entitlements (user_id);
create unique index if not exists entitlements_source_ref_key on public.entitlements (source, external_ref) where external_ref is not null;

alter table public.entitlements enable row level security;
drop policy if exists entitlements_own_select on public.entitlements;
create policy entitlements_own_select on public.entitlements
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.entitlements from anon, authenticated;
grant select on table public.entitlements to authenticated;

-- Hat der angemeldete Nutzer gerade eine gültige Berechtigung für dieses Produkt?
create or replace function public.has_entitlement(p_product text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.entitlements e
     where e.user_id = (select auth.uid()) and e.product = p_product
       and e.revoked_at is null and e.granted_at <= now() and (e.expires_at is null or e.expires_at > now()));
$$;
revoke all on function public.has_entitlement(text) from public, anon, authenticated;
grant execute on function public.has_entitlement(text) to authenticated;

commit;

-- =====================================================================================
-- Beispiele (SQL Editor, nur für den Betreiber)
--   Berechtigung von Hand vergeben (Konto über die E-Mail-Adresse finden):
--     insert into public.entitlements (user_id, product, source)
--     select id, 'premium', 'manual' from auth.users where email = 'name@example.com';
--   Entziehen (Verlauf bleibt):
--     update public.entitlements set revoked_at = now() where user_id = '<uuid>' and product = 'premium' and revoked_at is null;
--   Discord-Verknüpfungen ansehen (feste Discord-ID statt Name):
--     select user_id, provider_id as discord_user_id, identity_data ->> 'full_name' as discord_name
--       from auth.identities where provider = 'discord';
-- =====================================================================================
