-- =====================================================================================
-- KREVO: Team-Modus für Net Damage (Duo / Trio) mit "Team Net Surge"
--
-- Voraussetzung: supabase/001_krevo_profiles.sql ist eingespielt (002 wird nicht benötigt).
-- Einspielen: Supabase Dashboard -> SQL Editor -> New query -> diesen Text einfügen -> Run.
-- Das Skript lässt sich gefahrlos mehrfach ausführen (idempotent) und löscht keine bestehenden Daten.
--
-- Was es anlegt
--   * public.teams          Eine Team-Session: Größe (2 oder 3), Leitung, Status, zufällige Einladungskennung.
--   * public.team_members   Mitglieder mit eigenen Werten (Damage Dealt / Damage Taken). Pro Team und Konto genau eine Zeile.
--   * Funktionen            team_create, team_preview, team_join, team_get, team_mine, team_set, team_leave, team_end.
--                           Das ist die gesamte Schnittstelle. Jede Funktion prüft die Anmeldung und die Mitgliedschaft
--                           selbst und nimmt nie eine Nutzer-ID vom Client entgegen.
--
-- Sicherheit (alles in der Datenbank erzwungen, nicht im Browser)
--   * Die Tabellen sind per Row Level Security geschützt. Direkt lesen kann ein Nutzer nur Teams, in denen er Mitglied ist.
--     Schreiben (insert/update/delete) darf über die Tabellen niemand, auch nicht als angemeldeter Nutzer.
--   * Werte ändert nur team_set(), und nur die eigene Zeile des angemeldeten Nutzers (auth.uid()).
--   * Einladungskennung: 22 Zeichen aus einer kryptografisch zufälligen UUID (122 Bit). Nicht erratbar, nicht fortlaufend.
--     Der Link allein gibt aber nur das Recht zum Beitritt, solange Plätze frei sind. Lesen und Ändern erfordert Mitgliedschaft.
--   * Beitritte zum letzten freien Platz laufen nacheinander (Sperre auf der Team-Zeile): Es gewinnt genau einer.
--   * Ein Konto kann nur in einem aktiven Team gleichzeitig sein und zählt in einem Team genau einmal.
--   * Veraltete Schreibzugriffe werden abgelehnt (Versionsprüfung in team_set), damit nichts unbemerkt überschrieben wird.
--
-- Regeln
--   * Eine Session läuft 12 Stunden ab der letzten Aktivität (Beitritt, Wertänderung). Danach ist der Link abgelaufen.
--   * Verlässt die Leitung das Team und es bleiben Mitglieder übrig, geht die Leitung an das am längsten anwesende Mitglied
--     über. Verlässt das letzte Mitglied das Team, wird die Session gelöscht.
--   * Nur die Leitung kann die Session beenden. Beendete oder abgelaufene Sessions nehmen niemanden mehr auf.
--   * Beendete/abgelaufene Sessions werden beim Anlegen einer neuen Session nach 7 Tagen aufgeräumt.
-- =====================================================================================

begin;

-- ---------- Tabellen ----------
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  invite_code  text not null,
  size         smallint not null,
  leader_id    uuid references auth.users (id) on delete set null,
  status       text not null default 'open',
  rev          bigint not null default 1,                   -- zählt jede sichtbare Änderung hoch (Reihenfolge bei verspäteten Antworten)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '12 hours',
  ended_at     timestamptz,
  constraint teams_invite_code_format check (invite_code ~ '^[A-Za-z0-9_-]{22}$'),
  constraint teams_size_valid         check (size in (2, 3)),
  constraint teams_status_valid       check (status in ('open', 'ended')),
  constraint teams_ended_consistent   check ((status = 'ended') = (ended_at is not null))
);
create unique index if not exists teams_invite_code_key on public.teams (invite_code);

create table if not exists public.team_members (
  team_id     uuid not null references public.teams (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  slot        smallint not null,
  dealt       integer,
  taken       integer,
  net         integer generated always as (dealt - taken) stored,   -- Net Damage = Dealt - Taken (null, solange nicht initialisiert)
  version     integer not null default 0,                           -- zählt bei jeder Wertänderung hoch (Schutz vor veralteten Schreibzugriffen)
  joined_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (team_id, user_id),                                   -- jedes Konto höchstens einmal je Team
  constraint team_members_slot_range   check (slot between 1 and 3),
  constraint team_members_dealt_range  check (dealt is null or dealt between 0 and 999999),
  constraint team_members_taken_range  check (taken is null or taken between 0 and 999999),
  constraint team_members_both_or_none check ((dealt is null) = (taken is null))
);
create unique index if not exists team_members_slot_key on public.team_members (team_id, slot);   -- jeder Platz höchstens einmal
create index if not exists team_members_user_idx on public.team_members (user_id);

-- ---------- Zugriffsschutz (Row Level Security) ----------
create or replace function public.team_is_member(p_team uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.team_members m where m.team_id = p_team and m.user_id = (select auth.uid()));
$$;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
drop policy if exists teams_member_select on public.teams;
create policy teams_member_select on public.teams
  for select to authenticated using (public.team_is_member(id));
drop policy if exists team_members_member_select on public.team_members;
create policy team_members_member_select on public.team_members
  for select to authenticated using (public.team_is_member(team_id));
-- Bewusst keine Policies und keine Rechte für insert/update/delete: Schreiben geht nur über die Funktionen unten.
revoke all on table public.teams, public.team_members from anon, authenticated;
grant select on table public.teams, public.team_members to authenticated;

-- ---------- interne Hilfen (nicht über die API aufrufbar) ----------
create or replace function public.team_err(p_error text, p_extra jsonb default '{}'::jsonb)
returns jsonb
language sql immutable set search_path = public, pg_temp
as $$ select jsonb_build_object('ok', false, 'error', p_error) || p_extra; $$;

-- 22 Zeichen URL-sicheres Base64 aus einer zufälligen UUID (v4, 122 Bit Zufall)
create or replace function public.team_new_code()
returns text
language sql volatile set search_path = public, pg_temp
as $$
  select translate(rtrim(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '='), '+/', '-_');
$$;

-- Der vollständige Zustand eines Teams aus Sicht des Nutzers p_uid (nur an Mitglieder ausgeliefert).
-- Es werden keine Nutzer-IDs herausgegeben: Die eigene Zeile ist mit me=true markiert, die Leitung mit leader=true.
create or replace function public.team_state(p_team uuid, p_uid uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'code',    t.invite_code,
    'size',    t.size,
    'status',  case when t.status = 'open' and t.expires_at <= now() then 'expired' else t.status end,
    'rev',     t.rev,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'expires_at', t.expires_at,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slot', m.slot,
               'name', coalesce(p.username, 'Spieler ' || m.slot),
               'me', m.user_id = p_uid,
               'leader', m.user_id = t.leader_id,
               'initialized', m.dealt is not null,
               'dealt', m.dealt, 'taken', m.taken, 'net', m.net,
               'version', m.version,
               'joined_at', m.joined_at, 'updated_at', m.updated_at) order by m.slot)
        from public.team_members m left join public.profiles p on p.id = m.user_id
       where m.team_id = t.id), '[]'::jsonb),
    -- Team Net Surge: Summe der Net-Damage-Werte aller Mitglieder, die schon Werte haben (jeder genau einmal)
    'surge',   coalesce((select sum(m.net) from public.team_members m where m.team_id = t.id and m.dealt is not null), 0),
    'counted', (select count(*) from public.team_members m where m.team_id = t.id and m.dealt is not null),
    'joined',  (select count(*) from public.team_members m where m.team_id = t.id)
  )
  from public.teams t where t.id = p_team;
$$;

-- Zählt eine sichtbare Änderung und verlängert die Laufzeit (12 Stunden ab der letzten Aktivität)
create or replace function public.team_bump(p_team uuid)
returns void
language sql volatile security definer set search_path = public, pg_temp
as $$
  update public.teams
     set rev = rev + 1, updated_at = now(),
         expires_at = case when status = 'open' then now() + interval '12 hours' else expires_at end
   where id = p_team;
$$;

-- Verlässt jemand das Team (egal wie, auch durch Löschen des Kontos): Leitung übergeben oder Session löschen
create or replace function public.team_member_removed()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare t public.teams; nxt uuid;
begin
  select * into t from public.teams where id = old.team_id for update;
  if not found then return null; end if;   -- das Team wird gerade selbst gelöscht
  select m.user_id into nxt from public.team_members m where m.team_id = old.team_id order by m.joined_at, m.slot limit 1;
  if nxt is null then
    delete from public.teams where id = old.team_id;               -- das letzte Mitglied ist weg
  elsif t.status = 'open' and (t.leader_id is null or t.leader_id = old.user_id) then
    update public.teams set leader_id = nxt, rev = rev + 1, updated_at = now() where id = old.team_id;   -- Übergabe der Leitung
  elsif t.status = 'open' then
    update public.teams set rev = rev + 1, updated_at = now() where id = old.team_id;
  end if;
  return null;
end;
$$;
drop trigger if exists team_member_removed on public.team_members;
create trigger team_member_removed after delete on public.team_members
  for each row execute function public.team_member_removed();

-- ---------- Schnittstelle ----------
-- Alle Funktionen liefern jsonb: {"ok": true, ...} oder {"ok": false, "error": "<code>"}.

-- Session anlegen (Größe 2 = Duo, 3 = Trio). Der Ersteller ist Leitung und Mitglied auf Platz 1.
create or replace function public.team_create(p_size integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams; existing text; code text; tries int := 0;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  if p_size is null or p_size not in (2, 3) then return public.team_err('bad_size'); end if;
  perform pg_advisory_xact_lock(hashtextextended('krevo-team-user:' || uid::text, 0));   -- zwei Tabs desselben Kontos nacheinander
  select tt.invite_code into existing
    from public.teams tt join public.team_members m on m.team_id = tt.id
   where m.user_id = uid and tt.status = 'open' and tt.expires_at > now()
   order by m.joined_at desc limit 1;
  if existing is not null then return public.team_err('already_in_team', jsonb_build_object('code', existing)); end if;
  delete from public.teams where (ended_at is not null and ended_at < now() - interval '7 days') or expires_at < now() - interval '7 days';
  loop
    code := public.team_new_code();
    begin
      insert into public.teams (invite_code, size, leader_id) values (code, p_size, uid) returning * into t;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then return public.team_err('server'); end if;
    end;
  end loop;
  insert into public.team_members (team_id, user_id, slot) values (t.id, uid, 1);
  return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
end;
$$;

-- Vorschau für den Einladungslink (Größe, belegte Plätze, Leitung). Zeigt nur das, was die Beitrittsansicht braucht.
create or replace function public.team_preview(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{22}$' then return public.team_err('team_not_found'); end if;
  select * into t from public.teams where invite_code = p_code;
  if not found then return public.team_err('team_not_found'); end if;
  return jsonb_build_object('ok', true, 'preview', jsonb_build_object(
    'size', t.size,
    'filled', (select count(*) from public.team_members m where m.team_id = t.id),
    'status', case when t.status = 'open' and t.expires_at <= now() then 'expired' else t.status end,
    'joined', exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = uid),
    'leader', (select p.username from public.profiles p where p.id = t.leader_id)));
end;
$$;

-- Beitreten. Wiederholtes Beitreten (Neuladen, zweiter Tab) ist harmlos und liefert dasselbe Mitglied zurück.
create or replace function public.team_join(p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams; existing text; slot_no smallint;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9_-]{22}$' then return public.team_err('team_not_found'); end if;
  perform pg_advisory_xact_lock(hashtextextended('krevo-team-user:' || uid::text, 0));
  select * into t from public.teams where invite_code = p_code for update;      -- Beitritte zu diesem Team laufen nacheinander
  if not found then return public.team_err('team_not_found'); end if;
  if exists (select 1 from public.team_members m where m.team_id = t.id and m.user_id = uid) then
    return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
  end if;
  if t.status = 'ended' then return public.team_err('team_ended'); end if;
  if t.expires_at <= now() then return public.team_err('team_expired'); end if;
  select tt.invite_code into existing
    from public.teams tt join public.team_members m on m.team_id = tt.id
   where m.user_id = uid and tt.status = 'open' and tt.expires_at > now() limit 1;
  if existing is not null then return public.team_err('already_in_team', jsonb_build_object('code', existing)); end if;
  select min(s)::smallint into slot_no
    from generate_series(1, t.size) s
   where not exists (select 1 from public.team_members m where m.team_id = t.id and m.slot = s);
  if slot_no is null then return public.team_err('team_full'); end if;
  insert into public.team_members (team_id, user_id, slot) values (t.id, uid, slot_no);
  perform public.team_bump(t.id);
  return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
end;
$$;

-- Aktueller Zustand (nur Mitglieder). Nicht vorhandene und fremde Teams sind nicht unterscheidbar (not_member).
create or replace function public.team_get(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  select tt.* into t from public.teams tt join public.team_members m on m.team_id = tt.id
   where tt.invite_code = p_code and m.user_id = uid;
  if not found then return public.team_err('not_member'); end if;
  return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
end;
$$;

-- Das aktive Team des angemeldeten Nutzers (oder state = null). Damit findet die App es nach dem Neuladen wieder.
create or replace function public.team_mine()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); tid uuid;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  select tt.id into tid from public.teams tt join public.team_members m on m.team_id = tt.id
   where m.user_id = uid and tt.status = 'open' and tt.expires_at > now()
   order by m.joined_at desc limit 1;
  if tid is null then return jsonb_build_object('ok', true, 'state', null); end if;
  return jsonb_build_object('ok', true, 'state', public.team_state(tid, uid));
end;
$$;

-- Eigene Werte setzen. p_version ist die zuletzt bekannte Version der eigenen Zeile; stimmt sie nicht mehr
-- (zweiter Tab oder anderes Gerät war schneller), wird NICHT geschrieben, sondern conflict mit dem aktuellen Zustand geliefert.
create or replace function public.team_set(p_code text, p_dealt integer, p_taken integer, p_version integer)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams; m public.team_members;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  if p_dealt is null or p_taken is null or p_dealt not between 0 and 999999 or p_taken not between 0 and 999999 then
    return public.team_err('bad_value');
  end if;
  select tt.* into t from public.teams tt join public.team_members mm on mm.team_id = tt.id
   where tt.invite_code = p_code and mm.user_id = uid;
  if not found then return public.team_err('not_member'); end if;
  select * into t from public.teams where id = t.id for update;
  if t.status = 'ended' then return public.team_err('team_ended'); end if;
  if t.expires_at <= now() then return public.team_err('team_expired'); end if;
  select * into m from public.team_members where team_id = t.id and user_id = uid for update;
  if not found then return public.team_err('not_member'); end if;
  if p_version is distinct from m.version then
    return public.team_err('conflict', jsonb_build_object('state', public.team_state(t.id, uid)));
  end if;
  update public.team_members
     set dealt = p_dealt, taken = p_taken, version = version + 1, updated_at = now()
   where team_id = t.id and user_id = uid;
  perform public.team_bump(t.id);
  return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
end;
$$;

-- Team verlassen. Die eigene Zeile verschwindet (und damit der Beitrag zur Summe). Harmlos, wenn man nicht (mehr) Mitglied ist.
create or replace function public.team_leave(p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams; gone int;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  select * into t from public.teams where invite_code = p_code for update;
  if not found then return jsonb_build_object('ok', true, 'left', false); end if;
  delete from public.team_members where team_id = t.id and user_id = uid;
  get diagnostics gone = row_count;
  return jsonb_build_object('ok', true, 'left', gone > 0);
end;
$$;

-- Session beenden (nur Leitung). Danach nimmt sie niemanden mehr auf und lässt keine Änderungen mehr zu.
create or replace function public.team_end(p_code text)
returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare uid uuid := (select auth.uid()); t public.teams;
begin
  if uid is null then return public.team_err('not_authenticated'); end if;
  select tt.* into t from public.teams tt join public.team_members m on m.team_id = tt.id
   where tt.invite_code = p_code and m.user_id = uid;
  if not found then return public.team_err('not_member'); end if;
  select * into t from public.teams where id = t.id for update;
  if t.leader_id is distinct from uid then return public.team_err('not_leader'); end if;
  if t.status = 'open' then
    update public.teams set status = 'ended', ended_at = now(), rev = rev + 1, updated_at = now() where id = t.id;
  end if;
  return jsonb_build_object('ok', true, 'state', public.team_state(t.id, uid));
end;
$$;

-- ---------- Funktionsrechte: Supabase-Standard (alles offen) zurücknehmen, dann gezielt vergeben ----------
revoke all on function public.team_is_member(uuid) from public, anon, authenticated;
revoke all on function public.team_err(text, jsonb) from public, anon, authenticated;
revoke all on function public.team_new_code() from public, anon, authenticated;
revoke all on function public.team_state(uuid, uuid) from public, anon, authenticated;
revoke all on function public.team_bump(uuid) from public, anon, authenticated;
revoke all on function public.team_member_removed() from public, anon, authenticated;
revoke all on function public.team_create(integer) from public, anon, authenticated;
revoke all on function public.team_preview(text) from public, anon, authenticated;
revoke all on function public.team_join(text) from public, anon, authenticated;
revoke all on function public.team_get(text) from public, anon, authenticated;
revoke all on function public.team_mine() from public, anon, authenticated;
revoke all on function public.team_set(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.team_leave(text) from public, anon, authenticated;
revoke all on function public.team_end(text) from public, anon, authenticated;
grant execute on function public.team_is_member(uuid) to authenticated;   -- wird von den Zeilenregeln gebraucht
grant execute on function public.team_create(integer) to authenticated;
grant execute on function public.team_preview(text) to authenticated;
grant execute on function public.team_join(text) to authenticated;
grant execute on function public.team_get(text) to authenticated;
grant execute on function public.team_mine() to authenticated;
grant execute on function public.team_set(text, integer, integer, integer) to authenticated;
grant execute on function public.team_leave(text) to authenticated;
grant execute on function public.team_end(text) to authenticated;

commit;

-- =====================================================================================
-- Hilfsabfragen (optional, im SQL Editor)
--   Aktive Sessions ansehen:
--     select t.size, t.status, t.expires_at, count(m.*) as mitglieder
--       from public.teams t left join public.team_members m on m.team_id = t.id group by t.id order by t.created_at desc;
--   Alle Team-Daten löschen (Konten und Profile bleiben):
--     delete from public.teams;
-- =====================================================================================
