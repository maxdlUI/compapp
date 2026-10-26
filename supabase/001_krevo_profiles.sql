-- =====================================================================================
-- KREVO: Profile mit global eindeutigen Nutzernamen
--
-- Einspielen: Supabase Dashboard -> SQL Editor -> New query -> diesen Text einfügen -> Run.
-- Das Skript lässt sich gefahrlos mehrfach ausführen (idempotent) und löscht keine Daten.
--
-- Regeln für Nutzernamen (müssen mit public/js/username.js übereinstimmen):
--   * 3 bis 20 Zeichen, nur A-Z, a-z, 0-9 und Unterstrich
--   * beginnt und endet mit Buchstabe oder Ziffer
--   * Groß-/Kleinschreibung bleibt erhalten ("Krevo"), zählt aber nicht für die Eindeutigkeit
--     ("Krevo" und "krevo" sind derselbe Name): eindeutiger Index auf lower(username)
--   * reservierte Namen (Tabelle reserved_usernames) sind für Nutzer gesperrt
-- Die Eindeutigkeit sichert der Datenbank-Index, nicht der Browser.
-- =====================================================================================

begin;

-- ---------- Tabellen ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_format
    check (username ~ '^[A-Za-z0-9][A-Za-z0-9_]{1,18}[A-Za-z0-9]$')
);

-- Globale Eindeutigkeit, unabhängig von der Schreibweise. Das ist die maßgebliche Sperre.
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

create table if not exists public.reserved_usernames (
  name text primary key check (name = lower(name))
);
insert into public.reserved_usernames (name) values
  ('admin'), ('administrator'), ('root'), ('support'), ('system'), ('moderator'), ('mod'), ('staff'),
  ('krevo'), ('krevogg'), ('help'), ('info'), ('contact'), ('team'), ('official'), ('api'), ('www'),
  ('null'), ('undefined'), ('anonymous'), ('everyone'), ('owner'), ('security'), ('abuse'), ('epic'),
  ('fortnite'), ('epicgames')
on conflict do nothing;

-- ---------- Hilfsfunktionen (laufen mit den Rechten des Eigentümers, nicht des Aufrufers) ----------
create or replace function public.username_is_reserved(candidate text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.reserved_usernames r where r.name = lower(candidate));
$$;

-- Aus einem beliebigen Text (Name, E-Mail-Anfang) einen gültigen Nutzernamen-Vorschlag machen.
create or replace function public.suggest_username(raw text)
returns text
language plpgsql immutable set search_path = public
as $$
declare s text;
begin
  s := translate(coalesce(raw, ''),
                 'äöüßÄÖÜáàâãåéèêëíìîïóòôõúùûñçÁÀÂÃÅÉÈÊËÍÌÎÏÓÒÔÕÚÙÛÑÇ',
                 'aousAOUaaaaaeeeeiiiiooooouuuncAAAAAEEEEIIIIOOOOOUUUNC');
  s := regexp_replace(s, '[^A-Za-z0-9_]', '', 'g');
  s := regexp_replace(s, '^_+', '');
  s := left(s, 15);
  s := regexp_replace(s, '_+$', '');
  if length(s) < 3 then s := 'user' || s; end if;
  return s;
end;
$$;

-- Legt das Profil an. Gewünschter Name aus meta.username, sonst oder bei Konflikt ein erzeugter Name.
-- Löst nie einen Fehler wegen eines belegten Namens aus: die Registrierung darf daran nicht scheitern.
create or replace function public.create_profile_for(uid uuid, meta jsonb, mail text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  wanted text := nullif(btrim(coalesce(meta ->> 'username', '')), '');
  base   text;
  cand   text;
  i      int;
begin
  if exists (select 1 from public.profiles where id = uid) then return; end if;

  -- 1) der bei der Registrierung gewünschte Name
  if wanted is not null
     and wanted ~ '^[A-Za-z0-9][A-Za-z0-9_]{1,18}[A-Za-z0-9]$'
     and not public.username_is_reserved(wanted) then
    begin
      insert into public.profiles (id, username) values (uid, wanted);
      return;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = uid) then return; end if;
      -- Name vergeben (auch bei gleichzeitiger Registrierung): weiter mit erzeugtem Namen
    end;
  end if;

  -- 2) erzeugter Name: Wunschname, Anzeigename oder E-Mail-Anfang, bei Bedarf mit Zufallsziffern
  base := public.suggest_username(coalesce(wanted, nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''),
                                           split_part(coalesce(mail, ''), '@', 1)));
  for i in 0..11 loop
    cand := case when i = 0 then base
                 else left(base, 15) || '_' || lpad((floor(random() * 10000))::int::text, 4, '0') end;
    continue when public.username_is_reserved(cand);
    begin
      insert into public.profiles (id, username) values (uid, cand);
      return;
    exception when unique_violation then
      if exists (select 1 from public.profiles where id = uid) then return; end if;
    end;
  end loop;

  -- 3) letzter Ausweg, praktisch nie nötig
  insert into public.profiles (id, username)
  values (uid, 'user_' || substr(md5(uid::text || clock_timestamp()::text), 1, 8))
  on conflict do nothing;
end;
$$;

-- Trigger: jedes neue Konto (E-Mail, Google, ...) bekommt sofort ein Profil. Fehler hier dürfen die Registrierung nicht verhindern.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.create_profile_for(new.id, new.raw_user_meta_data, new.email);
  exception when others then
    raise warning 'KREVO: Profil für % konnte nicht angelegt werden (%). ensure_profile() holt das nach.', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Wächter: Zeitstempel, reservierte Namen. Gilt für Nutzer mit Anmeldung (auth.uid() gesetzt).
-- Direkte Änderungen im Dashboard/SQL-Editor (ohne Nutzer-Token) dürfen reservierte Namen vergeben, z. B. "Krevo" für dich.
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'profile_id_immutable' using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := now();
  if auth.uid() is not null
     and (tg_op = 'INSERT' or lower(new.username) is distinct from lower(old.username))
     and public.username_is_reserved(new.username) then
    raise exception 'username_reserved' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Prüft einen Namen für die Anzeige im Formular: available | taken | invalid | reserved.
-- Aufrufbar ohne Anmeldung (für die Registrierung). Endgültig entscheidet immer der eindeutige Index.
create or replace function public.username_available(candidate text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare c text := btrim(coalesce(candidate, ''));
begin
  if c !~ '^[A-Za-z0-9][A-Za-z0-9_]{1,18}[A-Za-z0-9]$' then return 'invalid'; end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and lower(p.username) = lower(c)) then
    return 'available';   -- der eigene Name (z. B. nur andere Schreibweise)
  end if;
  if public.username_is_reserved(c) then return 'reserved'; end if;
  if exists (select 1 from public.profiles p where lower(p.username) = lower(c)) then return 'taken'; end if;
  return 'available';
end;
$$;

-- Legt das eigene Profil an, falls es fehlt (z. B. Konto vor dieser Migration oder Trigger-Fehler).
create or replace function public.ensure_profile()
returns void
language plpgsql security definer set search_path = public
as $$
declare u record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'invalid_authorization_specification';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return; end if;
  select id, email, raw_user_meta_data into u from auth.users where id = auth.uid();
  if not found then return; end if;
  perform public.create_profile_for(u.id, u.raw_user_meta_data, u.email);
end;
$$;

-- ---------- Trigger ----------
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Zugriffsschutz (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.reserved_usernames enable row level security;   -- ohne Policy: über die API nicht lesbar

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Bewusst keine Policy für insert/delete: Profile entstehen nur über Trigger/ensure_profile und verschwinden
-- mit dem Konto (on delete cascade).

-- Standardrechte von Supabase (alles für anon/authenticated) auf das Nötigste zurücknehmen
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (username) on table public.profiles to authenticated;   -- id, created_at, updated_at nicht änderbar
revoke all on table public.reserved_usernames from anon, authenticated;

revoke all on function public.username_is_reserved(text) from public, anon, authenticated;
revoke all on function public.suggest_username(text) from public, anon, authenticated;
revoke all on function public.create_profile_for(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.profiles_guard() from public, anon, authenticated;
revoke all on function public.username_available(text) from public, anon, authenticated;
revoke all on function public.ensure_profile() from public, anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;

-- ---------- Bestehende Konten nachtragen ----------
do $$
declare u record;
begin
  for u in select a.id, a.raw_user_meta_data, a.email from auth.users a
           where not exists (select 1 from public.profiles p where p.id = a.id) loop
    perform public.create_profile_for(u.id, u.raw_user_meta_data, u.email);
  end loop;
end;
$$;

commit;
